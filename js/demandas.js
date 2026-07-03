/* ============================================================
   demandas.js — Tela Demandas (somente cards, sem calendário)
   ============================================================ */
import { el, icons, fmtBRL, isoToBR, toISO, toast, confirmDialog } from "./ui.js";
import { Demandas } from "./store.js";
import { openFormModal } from "./modal.js";

export const meta = {
  title: "Demandas",
  subtitle: "Gestão e acompanhamento de demandas",
};

const STATUS = {
  nao_iniciada:      { label: "Não iniciada",       badge: "badge-nao", dot: "nao" },
  em_desenvolvimento:{ label: "Em desenvolvimento",  badge: "badge-dev", dot: "dev" },
  concluida:         { label: "Concluída",           badge: "badge-ok",  dot: "ok" },
};
const STATUS_ORDER = ["nao_iniciada", "em_desenvolvimento", "concluida"];
const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "nao_iniciada", label: "Não iniciadas", dot: "nao" },
  { key: "em_desenvolvimento", label: "Em desenvolvimento", dot: "dev" },
  { key: "concluida", label: "Concluídas", dot: "ok" },
];

let items = [];
let filter = "todas";
let refs = {};
let onChange;

async function load() { items = await Demandas.all(); }

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
  const listCard = el("div", { class: "card", id: "demListCard" });

  view.append(head, kpis, listCard);
  container.appendChild(view);
  refs = { kpis, listCard };

  renderKpis();
  renderList();

  onChange = async () => { await load(); renderKpis(); renderList(); };
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

function renderList() {
  const filtered = filter === "todas" ? items : items.filter((d) => d.status === filter);
  const sorted = [...filtered].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
    (a.dateStart || a.date || "").localeCompare(b.dateStart || b.date || ""));

  const seg = el("div", { class: "segmented dem-filter" },
    ...FILTERS.map((fl) =>
      el("button", { type: "button", class: filter === fl.key ? "active" : "",
        onClick: () => { filter = fl.key; renderList(); } },
        fl.dot ? el("span", { class: "dot", style: `background:var(--status-${fl.dot})` }) : null,
        fl.label)));

  const head = el("div", { class: "card-head", style: "flex-wrap:wrap" },
    el("div", {},
      el("div", { class: "card-title" }, "Demandas"),
      el("div", { class: "card-sub" }, `${filtered.length} demanda(s)`)),
    seg,
  );
  refs.listCard.replaceChildren(head);

  if (!sorted.length) {
    refs.listCard.appendChild(emptyState("Nenhuma demanda.", "Cadastre uma demanda para começar."));
    return;
  }

  const grid = el("div", { class: "demanda-grid" });
  sorted.forEach((d) => grid.appendChild(demandaRow(d)));
  refs.listCard.appendChild(grid);
}

function demandaRow(d) {
  const st = STATUS[d.status] || STATUS.nao_iniciada;

  const statusSel = el("select", { class: "select demanda-status",
    onChange: async (e) => {
      await Demandas.setStatus(d.id, e.target.value);
      toast("Status atualizado.", "success");
    } },
    ...STATUS_ORDER.map((s) => el("option", { value: s, selected: d.status === s ? "selected" : null }, STATUS[s].label)));

  const value = el("span", { class: "demanda-value" + (d.amount ? "" : " text-dim") },
    d.amount ? fmtBRL(d.amount) : "Sem valor");

  const start = d.dateStart || d.date;
  const end = d.dateEnd || start;
  const periodo = start === end ? isoToBR(start) : `${isoToBR(start)} → ${isoToBR(end)}`;
  const periodEl = el("div", { class: "demanda-period" },
    el("span", { html: icons.calWeek, style: "width:13px" }), periodo);

  return el("div", { class: "demanda-card" },
    el("div", { class: "marker", style: `background:var(--status-${st.dot})` }),
    el("div", { class: "demanda-body" },
      el("div", { class: "demanda-title", title: d.title }, d.title),
      periodEl,
      el("div", { class: "demanda-subrow" }, value, statusSel),
      el("div", { class: "demanda-actions" },
        el("button", { class: "btn btn-sm btn-ghost", onClick: () => openEdit(d) },
          el("span", { html: icons.edit, style: "width:15px" }), "Editar"),
        el("button", { class: "btn btn-icon btn-sm btn-ghost", title: "Excluir", html: icons.trash,
          onClick: () => remove(d) }),
      ),
    ),
  );
}

function openNew() {
  openFormModal({
    mode: "demanda",
    defaultDate: toISO(new Date()),
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
function emptyState(title, sub) {
  return el("div", { class: "empty" },
    el("div", { html: icons.inbox }),
    el("h4", {}, title),
    el("div", { style: "font-size:var(--fs-sm)" }, sub),
  );
}
