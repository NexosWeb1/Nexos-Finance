/* ============================================================
   home.js — Tela inicial (visão geral)
   - Card de demandas da semana
   - Resumo do relatório do mês atual
   ============================================================ */
import { el, icons, fmtBRL, meses, toISO, fromISO, isoToBR, diasSemana } from "./ui.js";
import { Transactions, Demandas, monthlyTotals } from "./store.js";

export const meta = {
  title: "Início",
  subtitle: "Visão geral da semana e do mês",
};

const STATUS = {
  nao_iniciada:       { label: "Não iniciada",       badge: "badge-nao", color: "var(--status-nao)" },
  em_desenvolvimento: { label: "Em desenvolvimento", badge: "badge-dev", color: "var(--status-dev)" },
  concluida:          { label: "Concluída",          badge: "badge-ok",  color: "var(--status-ok)" },
};
const STATUS_ORDER = ["nao_iniciada", "em_desenvolvimento", "concluida"];

let txs = [], dems = [], donut, onChange, refs = {};

/* Semana de segunda a domingo contendo `d` */
function weekRange(d = new Date()) {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const diff = (start.getDay() + 6) % 7; // 0 = segunda
  start.setDate(start.getDate() - diff);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function load() {
  txs = await Transactions.all();
  dems = await Demandas.all();
}

export async function mount(container) {
  await load();

  const view = el("div", { class: "view" });

  // KPIs do mês atual
  const kpis = el("div", { class: "grid-kpis", id: "homeKpis" });

  // Layout: relatório do mês | demandas da semana
  const reportCard = el("div", { class: "card", id: "homeReport" });
  const weekCard = el("div", { class: "card", id: "homeWeek" });
  const grid = el("div", { class: "grid-2col" }, reportCard, weekCard);

  view.append(kpis, grid);
  container.appendChild(view);

  refs = { kpis, reportCard, weekCard };

  renderAll();

  onChange = async () => { await load(); renderAll(); };
  window.addEventListener("store:changed", onChange);
}

export function unmount() {
  window.removeEventListener("store:changed", onChange);
  if (donut) { donut.destroy(); donut = null; }
}

function renderAll() {
  const now = new Date();
  renderKpis(now);
  renderReport(now);
  renderWeek(now);
}

/* ---- KPIs do mês ---- */
function renderKpis(now) {
  const t = monthlyTotals(txs, now.getFullYear(), now.getMonth());
  const label = `${meses[now.getMonth()]} ${now.getFullYear()}`;
  refs.kpis.replaceChildren(
    kpi("entrada", icons.arrowUp, "Entradas no mês", fmtBRL(t.entradas), label),
    kpi("saida", icons.arrowDown, "Saídas no mês", fmtBRL(t.saidas), label),
    kpi("saldo", icons.wallet, "Saldo do mês", fmtBRL(t.saldo), `${t.count} lançamento(s)`),
  );
}

/* ---- Relatório do mês ---- */
function renderReport(now) {
  const t = monthlyTotals(txs, now.getFullYear(), now.getMonth());
  const monthLabel = `${meses[now.getMonth()]} ${now.getFullYear()}`;

  const head = el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title", style: "text-transform:capitalize" }, `Relatório de ${monthLabel}`),
      el("div", { class: "card-sub" }, "Desempenho financeiro do mês atual"),
    ),
    el("a", { class: "btn btn-sm btn-secondary", href: "#/relatorios" },
      "Ver completo", el("span", { html: icons.arrowRight, style: "width:15px" })),
  );

  const hasData = t.entradas > 0 || t.saidas > 0;

  const body = el("div", { style: "display:flex;gap:var(--sp-6);align-items:center;flex-wrap:wrap" });

  // Donut entradas x saídas
  const chartWrap = el("div", { style: "width:160px;height:160px;position:relative;flex-shrink:0" });
  const canvas = el("canvas", {});
  chartWrap.appendChild(canvas);

  // Resumo numérico
  const summary = el("div", { style: "flex:1;min-width:200px;display:flex;flex-direction:column;gap:var(--sp-3)" },
    summaryRow("var(--entrada)", "Receita", fmtBRL(t.entradas)),
    summaryRow("var(--saida)", "Despesa", fmtBRL(t.saidas)),
    el("div", { style: "height:1px;background:var(--border);margin:2px 0" }),
    summaryRow(t.saldo >= 0 ? "var(--entrada)" : "var(--saida)", "Saldo", fmtBRL(t.saldo), true),
  );

  body.append(chartWrap, summary);
  refs.reportCard.replaceChildren(head, body);

  // desenhar donut
  if (donut) { donut.destroy(); donut = null; }
  if (typeof Chart !== "undefined" && hasData) {
    donut = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Entradas", "Saídas"],
        datasets: [{
          data: [t.entradas / 100, t.saidas / 100],
          backgroundColor: ["#22C55E", "#EF4444"],
          borderColor: "#16181D", borderWidth: 3, hoverOffset: 4,
        }],
      },
      options: {
        cutout: "68%", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtBRL(c.parsed * 100)}` } } },
      },
    });
  } else {
    chartWrap.replaceChildren(el("div", { class: "empty", style: "height:100%;justify-content:center;padding:var(--sp-4)" },
      el("div", { style: "font-size:var(--fs-sm)" }, "Sem lançamentos no mês")));
  }
}

function summaryRow(color, label, value, strong) {
  return el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4)" },
    el("span", { style: "display:flex;align-items:center;gap:var(--sp-2);color:var(--text-muted)" },
      el("span", { style: `width:9px;height:9px;border-radius:50%;background:${color}` }), label),
    el("span", { class: "mono", style: `font-weight:${strong ? "var(--fw-bold)" : "var(--fw-semibold)"};font-size:${strong ? "var(--fs-lg)" : "var(--fs-md)"};color:${strong ? color : "var(--text)"}` }, value),
  );
}

/* ---- Demandas da semana ---- */
function renderWeek(now) {
  const { start, end } = weekRange(now);
  const startISO = toISO(start), endISO = toISO(end);
  // Demanda entra se o período (início..fim) cruza a semana
  const weekDems = dems
    .filter((d) => {
      const s = d.dateStart || d.date;
      const e = d.dateEnd || s;
      return s <= endISO && e >= startISO;
    })
    .sort((a, b) => (a.dateStart || a.date).localeCompare(b.dateStart || b.date) || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const rangeLabel = `${isoToBR(toISO(start)).slice(0, 5)} – ${isoToBR(toISO(end)).slice(0, 5)}`;

  const head = el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title" }, "Demandas da semana"),
      el("div", { class: "card-sub" }, rangeLabel),
    ),
    el("a", { class: "btn btn-sm btn-secondary", href: "#/demandas" },
      "Ver todas", el("span", { html: icons.arrowRight, style: "width:15px" })),
  );

  refs.weekCard.replaceChildren(head);

  if (!weekDems.length) {
    refs.weekCard.appendChild(el("div", { class: "empty" },
      el("div", { html: icons.calWeek }),
      el("h4", {}, "Nenhuma demanda esta semana."),
      el("a", { class: "btn btn-sm btn-primary", href: "#/demandas", style: "margin-top:var(--sp-2)" },
        el("span", { html: icons.plus }), "Cadastrar demanda"),
    ));
    return;
  }

  const list = el("div", { class: "list" });
  weekDems.forEach((d) => {
    const st = STATUS[d.status] || STATUS.nao_iniciada;
    const dt = fromISO(d.dateStart || d.date);
    list.appendChild(el("a", { class: "list-item", href: "#/demandas" },
      el("div", { class: "marker", style: `background:${st.color}` }),
      el("div", { style: "width:42px;text-align:center;flex-shrink:0" },
        el("div", { style: "font-size:var(--fs-xs);color:var(--text-dim);text-transform:uppercase" }, diasSemana[dt.getDay()]),
        el("div", { style: "font-family:var(--font-display);font-weight:var(--fw-bold);font-size:var(--fs-lg)" }, String(dt.getDate())),
      ),
      el("div", { class: "li-main" },
        el("div", { class: "li-title" }, d.title),
        el("div", { class: "li-meta" }, st.label + (d.amount ? " · " + fmtBRL(d.amount) : "")),
      ),
      el("span", { class: `badge ${st.badge}` }, el("span", { class: "dot" })),
    ));
  });
  refs.weekCard.appendChild(list);
}

/* helper */
function kpi(variant, ic, label, value, delta) {
  return el("div", { class: `kpi kpi--${variant}` },
    el("div", { class: "kpi-label" }, el("span", { html: ic, style: "width:15px" }), label),
    el("div", { class: "kpi-value" }, value),
    el("div", { class: "kpi-delta", style: "text-transform:capitalize" }, delta),
  );
}
