/* ============================================================
   manutencoes.js — Tela Manutenções
   Calendário com os pagamentos (semanal/mensal/anual) de cada projeto.
   ============================================================ */
import { el, icons, fmtBRL, isoLongLabel, toISO, toast, confirmDialog } from "./ui.js";
import { Maintenances, maintOccurrencesForMonth, maintOccurrencesOnDate, maintMonthTotal } from "./store.js";
import { Calendar } from "./calendar.js";
import { openFormModal } from "./modal.js";

export const meta = {
  title: "Manutenções",
  subtitle: "Pagamentos recorrentes por projeto",
};

const FREQ = {
  semanal: { label: "Semanal", dot: "sem", color: "var(--freq-sem)" },
  mensal:  { label: "Mensal",  dot: "men", color: "var(--freq-men)" },
  anual:   { label: "Anual",   dot: "anu", color: "var(--freq-anu)" },
};

let items = [];
let calendar;
let selectedISO = toISO(new Date());
let refs = {};
let onChange;

async function load() { items = await Maintenances.all(); }

export async function mount(container) {
  await load();
  const view = el("div", { class: "view" });

  const head = el("div", { class: "view-head", style: "justify-content:flex-end" },
    el("div", { class: "view-actions" },
      el("button", { class: "btn btn-primary", onClick: () => openNew() },
        el("span", { html: icons.plus }), "Cadastrar manutenção"),
    ),
  );

  const kpis = el("div", { class: "grid-kpis", id: "maintKpis" });

  const calCard = el("div", { class: "card" });
  const calMount = el("div", {});
  const legend = el("div", { class: "legend" },
    legendItem("var(--freq-sem)", "Semanal"),
    legendItem("var(--freq-men)", "Mensal"),
    legendItem("var(--freq-anu)", "Anual"),
  );
  calCard.append(calMount, legend);

  const dayCard = el("div", { class: "card" });
  const grid = el("div", { class: "grid-2col" }, calCard, dayCard);

  view.append(head, kpis, grid);
  container.appendChild(view);
  refs = { kpis, dayCard };

  calendar = new Calendar({
    initialDate: selectedISO,
    getDayDots: (iso) => {
      const seen = new Set();
      maintOccurrencesOnDate(items, iso).forEach((o) => seen.add(FREQ[o.frequency]?.dot || "men"));
      return ["sem", "men", "anu"].filter((d) => seen.has(d));
    },
    onSelectDay: (iso) => { selectedISO = iso; renderDay(); },
    onMonthChange: () => renderKpis(),
  });
  calMount.appendChild(calendar.el);
  calendar.render();

  renderKpis();
  renderDay();

  onChange = async () => { await load(); calendar.render(); renderKpis(); renderDay(); };
  window.addEventListener("store:changed", onChange);
}

export function unmount() {
  window.removeEventListener("store:changed", onChange);
}

function renderKpis() {
  const y = calendar.year, m = calendar.month;
  const monthLabel = calendar.currentMonthLabel;
  const total = maintMonthTotal(items, y, m);
  const occCount = maintOccurrencesForMonth(items, y, m).length;
  refs.kpis.replaceChildren(
    kpi(icons.wrench, "Projetos com manutenção", String(items.length), "ativos", "var(--brand)"),
    kpi(icons.wallet, "Previsto no mês", fmtBRL(total), monthLabel, "var(--freq-men)"),
    kpi(icons.repeat, "Pagamentos no mês", String(occCount), "ocorrência(s)", "var(--freq-sem)"),
  );
}

function renderDay() {
  const list = maintOccurrencesOnDate(items, selectedISO)
    .sort((a, b) => a.project.localeCompare(b.project));

  const head = el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title" }, "Pagamentos do dia"),
      el("div", { class: "card-sub" }, isoLongLabel(selectedISO)),
    ),
    el("button", { class: "btn btn-sm btn-secondary", onClick: () => openNew(selectedISO) },
      el("span", { html: icons.plus }), "Adicionar"),
  );
  refs.dayCard.replaceChildren(head);

  if (!list.length) {
    refs.dayCard.appendChild(emptyState("Nenhum pagamento neste dia.", "Cadastre uma manutenção para começar."));
    return;
  }

  const wrap = el("div", { class: "list" });
  list.forEach((o) => wrap.appendChild(maintRow(o)));
  refs.dayCard.appendChild(wrap);
}

function maintRow(o) {
  const fr = FREQ[o.frequency] || FREQ.mensal;
  return el("div", { class: "demanda-card" },
    el("div", { class: "marker", style: `background:${fr.color}` }),
    el("div", { class: "demanda-body" },
      el("div", { class: "demanda-title", title: o.project }, o.project),
      el("div", { class: "demanda-subrow" },
        el("span", { class: "demanda-value" }, fmtBRL(o.amount)),
        el("span", { class: "badge", style: `color:${fr.color};background:rgba(255,255,255,0.06)` },
          el("span", { class: "dot" }), fr.label),
      ),
      el("div", { class: "demanda-actions" },
        el("button", { class: "btn btn-sm btn-ghost", onClick: () => openEdit(o) },
          el("span", { html: icons.edit, style: "width:15px" }), "Editar"),
        el("button", { class: "btn btn-icon btn-sm btn-ghost", title: "Excluir", html: icons.trash,
          onClick: () => remove(o) }),
      ),
    ),
  );
}

function openNew(date) {
  openFormModal({
    mode: "manutencao",
    defaultDate: date || selectedISO,
    onSubmit: async (values) => { await Maintenances.create(values); },
  });
}
function openEdit(o) {
  const source = items.find((m) => m.id === (o._sourceId || o.id));
  openFormModal({
    mode: "manutencao",
    record: source,
    onSubmit: async (values) => { await Maintenances.update(source.id, values); },
  });
}
async function remove(o) {
  const source = items.find((m) => m.id === (o._sourceId || o.id));
  if (!(await confirmDialog(`Excluir a manutenção do projeto "${source.project}"? Todos os pagamentos projetados serão removidos.`))) return;
  await Maintenances.remove(source.id);
  toast("Manutenção excluída.", "success");
}

/* helpers */
function kpi(ic, label, value, delta, color) {
  return el("div", { class: "kpi", style: `--accent:${color}` },
    el("div", { class: "kpi-label" }, el("span", { html: ic, style: `width:15px;color:${color}` }), label),
    el("div", { class: "kpi-value" }, value),
    el("div", { class: "kpi-delta", style: "text-transform:capitalize" }, delta),
  );
}
function legendItem(color, label) {
  return el("div", { class: "legend-item" },
    el("span", { class: "swatch", style: `background:${color}` }), label);
}
function emptyState(title, sub) {
  return el("div", { class: "empty" },
    el("div", { html: icons.inbox }),
    el("h4", {}, title),
    el("div", { style: "font-size:var(--fs-sm)" }, sub),
  );
}
