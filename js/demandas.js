/* ============================================================
   demandas.js — Tela Demandas
   ============================================================ */
import { el, icons, fmtBRL, isoLongLabel, toISO, toast, confirmDialog } from "./ui.js";
import { Demandas } from "./store.js";
import { Calendar } from "./calendar.js";
import { openFormModal } from "./modal.js";

export const meta = {
  title: "Demandas",
  subtitle: "Gestão e acompanhamento de demandas",
};

const STATUS = {
  nao_iniciada:      { label: "Não iniciada",      badge: "badge-nao", dot: "nao" },
  em_desenvolvimento:{ label: "Em desenvolvimento", badge: "badge-dev", dot: "dev" },
  concluida:         { label: "Concluída",          badge: "badge-ok",  dot: "ok" },
};
const STATUS_ORDER = ["nao_iniciada", "em_desenvolvimento", "concluida"];

let items = [];
let calendar;
let selectedISO = toISO(new Date());
let refs = {};
let onChange;

async function load() { items = await Demandas.all(); }
const onDate = (iso) => items.filter((d) => d.date === iso);

export async function mount(container) {
  await load();
  const view = el("div", { class: "view" });

  const head = el("div", { class: "view-head", style: "justify-content:flex-end" },
    el("div", { class: "view-actions" },
      el("button", { class: "btn btn-primary", onClick: () => openNew() },
        el("span", { html: icons.plus }), "Cadastrar demanda"),
    ),
  );

  const kpis = el("div", { class: "grid-kpis", id: "demKpis" });

  const calCard = el("div", { class: "card" });
  const calMount = el("div", {});
  const legend = el("div", { class: "legend" },
    legendItem("var(--status-nao)", "Não iniciada"),
    legendItem("var(--status-dev)", "Em desenvolvimento"),
    legendItem("var(--status-ok)", "Concluída"),
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
      onDate(iso).forEach((d) => seen.add(STATUS[d.status]?.dot || "nao"));
      return STATUS_ORDER.map((s) => STATUS[s].dot).filter((dot) => seen.has(dot));
    },
    onSelectDay: (iso) => { selectedISO = iso; renderDay(); },
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
  const counts = { nao_iniciada: 0, em_desenvolvimento: 0, concluida: 0 };
  items.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
  refs.kpis.replaceChildren(
    kpiCount("Total de demandas", items.length, icons.tasks, "var(--brand)"),
    kpiCount("Não iniciadas", counts.nao_iniciada, icons.alert, "var(--status-nao)"),
    kpiCount("Em desenvolvimento", counts.em_desenvolvimento, icons.repeat, "var(--status-dev)"),
    kpiCount("Concluídas", counts.concluida, icons.check, "var(--status-ok)"),
  );
}

function renderDay() {
  const list = onDate(selectedISO).sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const head = el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title" }, "Demandas do dia"),
      el("div", { class: "card-sub" }, isoLongLabel(selectedISO)),
    ),
    el("button", { class: "btn btn-sm btn-secondary", onClick: () => openNew(selectedISO) },
      el("span", { html: icons.plus }), "Adicionar"),
  );
  refs.dayCard.replaceChildren(head);

  if (!list.length) {
    refs.dayCard.appendChild(emptyState("Nenhuma demanda neste dia.", "Cadastre uma demanda para começar."));
    return;
  }

  const wrap = el("div", { class: "list" });
  list.forEach((d) => wrap.appendChild(demandaRow(d)));
  refs.dayCard.appendChild(wrap);
}

function demandaRow(d) {
  const st = STATUS[d.status] || STATUS.nao_iniciada;

  // Select de status inline
  const statusSel = el("select", { class: "select demanda-status",
    onChange: async (e) => {
      await Demandas.setStatus(d.id, e.target.value);
      toast("Status atualizado.", "success");
    } },
    ...STATUS_ORDER.map((s) => el("option", { value: s, selected: d.status === s ? "selected" : null }, STATUS[s].label)));

  const value = el("span", { class: "demanda-value" + (d.amount ? "" : " text-dim") },
    d.amount ? fmtBRL(d.amount) : "Sem valor");

  return el("div", { class: "demanda-card" },
    el("div", { class: "marker", style: `background:var(--status-${st.dot})` }),
    el("div", { class: "demanda-body" },
      el("div", { class: "demanda-title", title: d.title }, d.title),
      el("div", { class: "demanda-subrow" }, value, statusSel),
      el("div", { class: "demanda-actions" },
        el("button", { class: "btn btn-sm btn-ghost", onClick: () => openEdit(d) },
          el("span", { html: icons.edit, style: "width:15px" }), "Editar"),
        el("button", { class: "btn btn-sm btn-ghost", title: "Excluir", html: icons.trash,
          onClick: () => remove(d) }),
      ),
    ),
  );
}

function openNew(date) {
  openFormModal({
    mode: "demanda",
    defaultDate: date || selectedISO,
    onSubmit: async (values) => { await Demandas.create(values); },
  });
}
function openEdit(d) {
  openFormModal({
    mode: "demanda",
    record: d,
    onSubmit: async (values) => { await Demandas.update(d.id, values); },
  });
}
async function remove(d) {
  if (!(await confirmDialog(`Excluir a demanda "${d.title}"?`))) return;
  await Demandas.remove(d.id);
  toast("Demanda excluída.", "success");
}

/* helpers */
function kpiCount(label, value, ic, color) {
  return el("div", { class: "kpi", style: `--accent:${color}` },
    el("div", { class: "kpi-label" }, el("span", { html: ic, style: `width:15px;color:${color}` }), label),
    el("div", { class: "kpi-value" }, String(value)),
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
