/* ============================================================
   reports.js — Relatórios mensal e anual (tempo real) + export
   ============================================================ */
import { el, icons, fmtBRL, fmtBRLshort, mesesAbbr, meses, toast } from "./ui.js";
import { Transactions, annualSeries, monthlyTotals, dataYears } from "./store.js";

export const meta = {
  title: "Relatórios",
  subtitle: "Rendimento mensal e anual em tempo real",
};

let txs = [];
let year = new Date().getFullYear();
let selMonth = new Date().getMonth();   // mês selecionado no detalhamento
let barChart, lineChart;
let refs = {};
let onChange;

// Cores lidas do tema
const C = {
  entrada: "#22C55E", saida: "#EF4444", brand: "#F4F6F8",
  grid: "rgba(255,255,255,0.06)", text: "#9AA1AC",
};

async function load() { txs = await Transactions.all(); }

export async function mount(container) {
  await load();
  const view = el("div", { class: "view" });

  const years = dataYears(txs);
  if (!years.includes(year)) year = years[0];

  const yearSelect = el("select", { class: "select", style: "width:auto",
    onChange: (e) => { year = Number(e.target.value); renderAll(); } },
    ...years.map((y) => el("option", { value: y, selected: y === year ? "selected" : null }, String(y))));

  const head = el("div", { class: "view-head", style: "justify-content:flex-end" },
    el("div", { class: "view-actions" },
      yearSelect,
      el("button", { class: "btn btn-secondary", onClick: exportDOCX },
        el("span", { html: icons.download }), "Word"),
      el("button", { class: "btn btn-primary", onClick: exportPDF },
        el("span", { html: icons.pdf }), "PDF"),
    ),
  );

  const kpis = el("div", { class: "grid-kpis", id: "repKpis" });

  // Gráficos
  const barCard = el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("div", {}, el("div", { class: "card-title" }, "Entradas x Saídas por mês"),
        el("div", { class: "card-sub", id: "barSub" }, "")),
    ),
    el("div", { class: "chart-box" }, el("canvas", { id: "barCanvas" })),
  );
  const lineCard = el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("div", {}, el("div", { class: "card-title" }, "Saldo acumulado"),
        el("div", { class: "card-sub" }, "Evolução do saldo ao longo do ano")),
    ),
    el("div", { class: "chart-box" }, el("canvas", { id: "lineCanvas" })),
  );
  const charts = el("div", { class: "grid-charts" }, barCard, lineCard);

  // Tabela mensal (com seletor de mês)
  const monthSelect = el("select", { class: "select", style: "width:auto",
    onChange: (e) => { selMonth = Number(e.target.value); renderTable(annualSeries(txs, year)); } },
    ...meses.map((m, i) => el("option", { value: i, selected: i === selMonth ? "selected" : null },
      m.charAt(0).toUpperCase() + m.slice(1))));
  const tableCard = el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("div", { class: "card-title" }, "Detalhamento mensal"),
      el("div", { style: "display:flex;align-items:center;gap:var(--sp-2)" },
        el("span", { class: "label", style: "margin:0" }, "Mês"),
        monthSelect),
    ),
    el("div", { id: "monthTable" }),
  );

  view.append(head, kpis, charts, tableCard);
  container.appendChild(view);

  refs = {
    kpis,
    barSub: barCard.querySelector("#barSub"),
    barCanvas: barCard.querySelector("#barCanvas"),
    lineCanvas: lineCard.querySelector("#lineCanvas"),
    table: tableCard.querySelector("#monthTable"),
  };

  renderAll();

  onChange = async () => { await load(); renderAll(); };
  window.addEventListener("store:changed", onChange);
}

export function unmount() {
  window.removeEventListener("store:changed", onChange);
  if (barChart) { barChart.destroy(); barChart = null; }
  if (lineChart) { lineChart.destroy(); lineChart = null; }
}

function renderAll() {
  const data = annualSeries(txs, year);
  renderKpis(data);
  renderCharts(data);
  renderTable(data);
  if (refs.barSub) refs.barSub.textContent = `Ano de ${year}`;
}

/* ---- KPIs anuais ---- */
function renderKpis(data) {
  const best = data.series.reduce((acc, x, i) => x.saldo > acc.val ? { val: x.saldo, i } : acc, { val: -Infinity, i: 0 });
  const margem = data.entradas > 0 ? Math.round((data.saldo / data.entradas) * 100) : 0;
  refs.kpis.replaceChildren(
    kpi("entrada", icons.arrowUp, "Receita no ano", fmtBRL(data.entradas)),
    kpi("saida", icons.arrowDown, "Despesa no ano", fmtBRL(data.saidas)),
    kpi("saldo", icons.wallet, "Saldo no ano", fmtBRL(data.saldo)),
    kpi("saldo", icons.chart, "Margem", `${margem}%`, data.saldo >= 0 ? `Melhor mês: ${meses[best.i]}` : "Atenção ao saldo"),
  );
}

/* ---- Gráficos (Chart.js) ---- */
function renderCharts(data) {
  if (typeof Chart === "undefined") {
    refs.barCanvas.parentElement.innerHTML = '<div class="empty" style="height:100%"><div>Gráficos indisponíveis (Chart.js não carregou).</div></div>';
    return;
  }
  Chart.defaults.color = C.text;
  Chart.defaults.font.family = "Inter, sans-serif";

  const labels = mesesAbbr.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  const entradas = data.series.map((x) => x.entradas / 100);
  const saidas = data.series.map((x) => x.saidas / 100);

  // acumulado
  let acc = 0;
  const saldoAcc = data.series.map((x) => (acc += x.saldo) / 100);

  const moneyTick = (v) => "R$ " + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v);
  const tooltipMoney = (ctx) => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y * 100)}`;

  // Bar
  if (barChart) barChart.destroy();
  barChart = new Chart(refs.barCanvas, {
    type: "bar",
    data: { labels, datasets: [
      { label: "Entradas", data: entradas, backgroundColor: C.entrada, borderRadius: 5, maxBarThickness: 22 },
      { label: "Saídas", data: saidas, backgroundColor: C.saida, borderRadius: 5, maxBarThickness: 22 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: tooltipMoney } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: C.grid }, ticks: { callback: moneyTick }, beginAtZero: true },
      },
    },
  });

  // Line
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(refs.lineCanvas, {
    type: "line",
    data: { labels, datasets: [
      { label: "Saldo acumulado", data: saldoAcc, borderColor: C.brand,
        backgroundColor: "rgba(244,246,248,0.08)", fill: true, tension: 0.35,
        pointBackgroundColor: C.brand, pointRadius: 3, borderWidth: 2 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipMoney } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: C.grid }, ticks: { callback: moneyTick } },
      },
    },
  });
}

/* ---- Tabela: mês selecionado + total do ano ---- */
function renderTable(data) {
  const cell = (txt, extra) => el("div", { class: "mono", style: `min-width:120px;text-align:right;${extra || ""}` }, txt);

  const header = el("div", { class: "list-item", style: "background:transparent;border-color:transparent;color:var(--text-dim);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.04em" },
    el("div", { class: "li-main" }, "Mês"),
    el("div", { style: "min-width:120px;text-align:right" }, "Entradas"),
    el("div", { style: "min-width:120px;text-align:right" }, "Saídas"),
    el("div", { style: "min-width:130px;text-align:right" }, "Saldo"),
  );

  const t = data.series[selMonth];
  const clsM = t.saldo >= 0 ? "text-entrada" : "text-saida";
  const monthRow = el("div", { class: "list-item" },
    el("div", { class: "li-main", style: "text-transform:capitalize;font-weight:var(--fw-semibold)" }, meses[selMonth]),
    cell(fmtBRL(t.entradas), "color:var(--entrada)"),
    cell(fmtBRL(t.saidas), "color:var(--saida)"),
    el("div", { class: `mono ${clsM}`, style: "min-width:130px;text-align:right;font-weight:var(--fw-semibold)" }, fmtBRL(t.saldo)),
  );

  const total = el("div", { class: "list-item", style: "background:var(--bg-elev-2);font-weight:var(--fw-bold)" },
    el("div", { class: "li-main" }, "Total " + year),
    cell(fmtBRL(data.entradas), "color:var(--entrada)"),
    cell(fmtBRL(data.saidas), "color:var(--saida)"),
    el("div", { class: `mono ${data.saldo >= 0 ? "text-entrada" : "text-saida"}`, style: "min-width:130px;text-align:right" }, fmtBRL(data.saldo)),
  );

  refs.table.replaceChildren(el("div", { class: "list" }, header, monthRow, total));
}

function kpi(variant, ic, label, value, delta) {
  return el("div", { class: `kpi kpi--${variant}` },
    el("div", { class: "kpi-label" }, el("span", { html: ic, style: "width:15px" }), label),
    el("div", { class: "kpi-value" }, value),
    delta ? el("div", { class: "kpi-delta" }, delta) : null,
  );
}

/* ============================================================
   Exportação — PDF (jsPDF via CDN) e Word (.doc HTML)
   ============================================================ */
function buildReportData() {
  const data = annualSeries(txs, year);
  return { data, year, generatedAt: new Date().toLocaleString("pt-BR") };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });
}

async function exportPDF() {
  try {
    toast("Gerando PDF…", "info", 1500);
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const { data } = buildReportData();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 48; let y = 56;

    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Relatório Financeiro Nexos", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
    y += 18; doc.text(`Ano de ${year} · gerado em ${new Date().toLocaleString("pt-BR")}`, M, y);

    // Resumo
    y += 34; doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Resumo anual", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40);
    y += 20; doc.text(`Receita total: ${fmtBRL(data.entradas)}`, M, y);
    y += 16; doc.text(`Despesa total: ${fmtBRL(data.saidas)}`, M, y);
    y += 16; doc.text(`Saldo do ano: ${fmtBRL(data.saldo)}`, M, y);

    // Tabela mensal
    y += 34; doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Detalhamento mensal", M, y);
    y += 20;
    const cols = [M, M + 150, M + 290, M + 430];
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text("Mês", cols[0], y); doc.text("Entradas", cols[1], y);
    doc.text("Saídas", cols[2], y); doc.text("Saldo", cols[3], y);
    doc.setDrawColor(220); y += 6; doc.line(M, y, 547, y); y += 14;
    doc.setTextColor(40);
    data.series.forEach((t, i) => {
      if (y > 760) { doc.addPage(); y = 56; }
      doc.text(meses[i], cols[0], y);
      doc.text(fmtBRL(t.entradas), cols[1], y);
      doc.text(fmtBRL(t.saidas), cols[2], y);
      doc.text(fmtBRL(t.saldo), cols[3], y);
      y += 16;
    });
    y += 4; doc.line(M, y, 547, y); y += 16;
    doc.setFont("helvetica", "bold");
    doc.text(`Total ${year}`, cols[0], y);
    doc.text(fmtBRL(data.entradas), cols[1], y);
    doc.text(fmtBRL(data.saidas), cols[2], y);
    doc.text(fmtBRL(data.saldo), cols[3], y);

    doc.save(`relatorio-nexos-${year}.pdf`);
    toast("PDF gerado.", "success");
  } catch (err) {
    toast(err.message || "Erro ao gerar PDF.", "error");
  }
}

function exportDOCX() {
  try {
    const { data } = buildReportData();
    const rows = data.series.map((t, i) => `
      <tr>
        <td>${meses[i]}</td>
        <td style="color:#15803d">${fmtBRL(t.entradas)}</td>
        <td style="color:#b91c1c">${fmtBRL(t.saidas)}</td>
        <td><b>${fmtBRL(t.saldo)}</b></td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Relatório Nexos ${year}</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a}
  h1{font-size:22pt;margin:0 0 4pt} .sub{color:#666;font-size:10pt}
  h2{font-size:14pt;border-bottom:1px solid #ccc;padding-bottom:4pt;margin-top:20pt}
  table{border-collapse:collapse;width:100%;font-size:11pt;margin-top:8pt}
  th,td{border:1px solid #ddd;padding:6pt 8pt;text-align:left}
  th{background:#f3f3f3} tr.total td{background:#f9f9f9;font-weight:bold}
</style></head>
<body>
  <h1>Relatório Financeiro Nexos</h1>
  <div class="sub">Ano de ${year} &middot; gerado em ${new Date().toLocaleString("pt-BR")}</div>
  <h2>Resumo anual</h2>
  <p>Receita total: <b>${fmtBRL(data.entradas)}</b><br/>
     Despesa total: <b>${fmtBRL(data.saidas)}</b><br/>
     Saldo do ano: <b>${fmtBRL(data.saldo)}</b></p>
  <h2>Detalhamento mensal</h2>
  <table>
    <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr>
    ${rows}
    <tr class="total"><td>Total ${year}</td><td>${fmtBRL(data.entradas)}</td><td>${fmtBRL(data.saidas)}</td><td>${fmtBRL(data.saldo)}</td></tr>
  </table>
</body></html>`;

    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `relatorio-nexos-${year}.doc` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Documento Word gerado.", "success");
  } catch (err) {
    toast(err.message || "Erro ao gerar Word.", "error");
  }
}
