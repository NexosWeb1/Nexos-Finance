/* ============================================================
   finance.js — Tela Entradas & Saídas
   ============================================================ */
import { el, icons, fmtBRL, isoLongLabel, toISO, fromISO, toast, confirmDialog } from "./ui.js";
import { Transactions, occurrencesForMonth, occurrencesOnDate, monthlyTotals } from "./store.js";
import { Calendar } from "./calendar.js";
import { openFormModal } from "./modal.js";

export const meta = {
  title: "Entradas & Saídas",
  subtitle: "Controle financeiro e despesas recorrentes",
};

let txs = [];
let calendar;
let selectedISO = toISO(new Date());
let refs = {};
let onChange;

async function load() { txs = await Transactions.all(); }

export async function mount(container) {
  await load();

  const view = el("div", { class: "view" });

  // Ações
  const head = el("div", { class: "view-head", style: "justify-content:flex-end" },
    el("div", { class: "view-actions" },
      el("button", { class: "btn btn-primary", onClick: () => openNew() },
        el("span", { html: icons.plus }), "Nova Movimentação"),
    ),
  );

  // KPIs
  const kpis = el("div", { class: "grid-kpis", id: "finKpis" });

  // Layout 2 colunas: calendário | dia selecionado
  const calCard = el("div", { class: "card" });
  const calMount = el("div", {});
  const legend = el("div", { class: "legend" },
    legendItem("var(--entrada)", "Entradas"),
    legendItem("var(--saida)", "Saídas"),
    el("div", { class: "legend-item" },
      el("span", { html: icons.repeat, style: "width:14px;color:var(--text-dim)" }), "Recorrente projetada"),
  );
  calCard.append(calMount, legend);

  const dayCard = el("div", { class: "card" });

  const grid = el("div", { class: "grid-2col" }, calCard, dayCard);

  view.append(head, kpis, grid);
  container.appendChild(view);

  refs = { kpis, dayCard };

  // Calendário
  calendar = new Calendar({
    initialDate: selectedISO,
    getDayDots: (iso) => {
      const occ = occurrencesOnDate(txs, iso);
      const dots = [];
      if (occ.some((o) => o.type === "entrada")) dots.push("entrada");
      if (occ.some((o) => o.type === "saida")) dots.push("saida");
      return dots;
    },
    onSelectDay: (iso) => { selectedISO = iso; renderDay(); },
    // ao trocar o mês, os KPIs do topo acompanham o mês visível
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

/* ---- KPIs do mês visível no calendário ---- */
function renderKpis() {
  const y = calendar.year, m = calendar.month;
  const t = monthlyTotals(txs, y, m);
  const monthName = calendar.currentMonthLabel;
  refs.kpis.replaceChildren(
    kpi("entrada", icons.arrowUp, "Entradas", fmtBRL(t.entradas), monthName),
    kpi("saida", icons.arrowDown, "Saídas", fmtBRL(t.saidas), monthName),
    kpi("saldo", icons.wallet, "Saldo do mês", fmtBRL(t.saldo), `${t.count} lançamento(s)`),
  );
}

/* ---- Lista do dia selecionado ---- */
function renderDay() {
  const occ = occurrencesOnDate(txs, selectedISO)
    .sort((a, b) => (b.type === "entrada") - (a.type === "entrada"));

  const head = el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title" }, "Movimentações do dia"),
      el("div", { class: "card-sub" }, isoLongLabel(selectedISO)),
    ),
    el("button", { class: "btn btn-sm btn-secondary", onClick: () => openNew(undefined, selectedISO) },
      el("span", { html: icons.plus }), "Adicionar"),
  );

  refs.dayCard.replaceChildren(head);

  if (!occ.length) {
    refs.dayCard.appendChild(emptyState("Nenhuma movimentação neste dia.", "Use o botão acima para registrar."));
    return;
  }

  const list = el("div", { class: "list" });
  occ.forEach((o) => list.appendChild(txRow(o)));
  refs.dayCard.appendChild(list);
}

function txRow(o) {
  const isEntrada = o.type === "entrada";
  const sign = isEntrada ? "+" : "−";
  const meta = [];
  if (o._projected) meta.push("recorrente");
  if (o.description) meta.push(o.description);
  if (o.attachment) meta.push("📎 " + o.attachment.name);

  const actions = el("div", { class: "li-actions" },
    el("button", { class: "btn btn-icon btn-ghost btn-sm", title: "Editar", html: icons.edit,
      onClick: () => openEdit(o) }),
    el("button", { class: "btn btn-icon btn-ghost btn-sm", title: "Excluir", html: icons.trash,
      onClick: () => remove(o) }),
  );

  return el("div", { class: "list-item" },
    el("div", { class: `marker ${o.type}` }),
    el("div", { class: "li-main" },
      el("div", { class: "li-title" },
        o.title,
        o._projected ? el("span", { html: icons.repeat, style: "width:13px;color:var(--text-dim)", title: "Lançamento recorrente" }) : null,
      ),
      meta.length ? el("div", { class: "li-meta" }, meta.join(" · ")) : null,
    ),
    el("div", { class: `li-amount ${isEntrada ? "text-entrada" : "text-saida"}` }, `${sign} ${fmtBRL(o.amount)}`),
    actions,
  );
}

/* ---- Ações ---- */
function openNew(type, date) {
  openFormModal({
    mode: "finance",
    record: { type },
    defaultDate: date || selectedISO,
    onSubmit: async (values) => { await Transactions.create(values); },
  });
}

function openEdit(occ) {
  // Recorrentes: editar o lançamento de origem
  const source = txs.find((t) => t.id === (occ._sourceId || occ.id));
  openFormModal({
    mode: "finance",
    record: source,
    onSubmit: async (values) => { await Transactions.update(source.id, values); },
  });
}

async function remove(occ) {
  const source = txs.find((t) => t.id === (occ._sourceId || occ.id));
  const isRec = source?.recurring;
  const ok = await confirmDialog(
    isRec ? `Excluir o lançamento recorrente "${source.title}"? Todas as projeções serão removidas.`
          : `Excluir "${occ.title}"?`);
  if (!ok) return;
  await Transactions.remove(source.id);
  toast("Lançamento excluído.", "success");
}

/* ---- helpers de UI ---- */
function kpi(variant, ic, label, value, delta) {
  return el("div", { class: `kpi kpi--${variant}` },
    el("div", { class: "kpi-label" }, el("span", { html: ic, style: "width:15px" }), label),
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
