/* ============================================================
   contrato.js — Gerar Contrato (modelo Nexos)

   Modelo padrão embutido (baseado em "Contrato molde.docx"). Todas as
   informações que no molde estavam entre aspas viram CAMPOS editáveis,
   preenchidos por projeto. A pré-visualização mostra o contrato com os
   espaços em branco destacados até serem preenchidos.
   Gera PDF (jsPDF) e Word (.doc).
   ============================================================ */
import { el, icons, escapeHtml, toast } from "./ui.js";
import { maskDate, maskCurrency } from "./masks.js";

export const meta = {
  title: "Gerar Contrato",
  subtitle: "Contrato padrão Nexos com campos por projeto",
};

/* Campos por projeto (cada um corresponde a um trecho variável do molde) */
const FIELDS = [
  { group: "Dados da CONTRATANTE" },
  { key: "contratante", label: "Nome / Razão social", required: true, ph: "Ex.: Monsueto Turismo Ltda – ME" },
  { key: "cnpj", label: "CNPJ", ph: "00.000.000/0000-00" },
  { key: "endereco", label: "Endereço (sede)", ph: "Rua, nº - Bairro, Cidade - UF, CEP" },

  { group: "Serviço 1 — Desenvolvimento" },
  { key: "servico1", label: "Descrição do serviço", def: "Desenvolvimento e Setup do Website Exclusivo" },
  { key: "valor1", label: "Valor", currency: true, required: true, ph: "0,00" },
  { key: "venc1", label: "Previsão de vencimento", def: "Vitalício" },

  { group: "Serviço 2 — Manutenção" },
  { key: "servico2", label: "Descrição do serviço", def: "Manutenção do Site (Atualização de pacotes/fotos)" },
  { key: "periodicidade2", label: "Periodicidade", def: "Mensal" },
  { key: "valor2", label: "Valor", currency: true, ph: "0,00" },
  { key: "venc2", label: "Previsão de vencimento", ph: "Ex.: Todo dia 03, a partir de 03/07/2026" },

  { group: "Cláusulas específicas do projeto" },
  { key: "servicoEspecifico", label: "Item específico (Cláusula 2ª)", multiline: true,
    def: "Atualização mensal das fotos e flyers referentes aos planos de viagem disponibilizados pela CONTRATANTE." },
  { key: "hospedagem", label: "Hospedagem (Cláusula 5.1)", multiline: true,
    def: "A hospedagem do site será realizada em servidores globais de alta performance e é cedida de forma gratuita pela CONTRATADA ao longo da vigência deste contrato." },
  { key: "manutencao", label: "Manutenção (Cláusula 5.2)", multiline: true,
    def: "A taxa de manutenção mensal cobre os custos operacionais da CONTRATADA para a substituição manual e atualização periódica das fotos e informações dos planos de viagem ofertados pela CONTRATANTE." },

  { group: "Assinatura" },
  { key: "dataContrato", label: "Data do contrato", date: true, ph: "DD/MM/AAAA" },
];

const FMAP = Object.fromEntries(FIELDS.filter((x) => x.key).map((x) => [x.key, x]));
const f = {};
FIELDS.filter((x) => x.key).forEach((x) => { f[x.key] = x.def || ""; });

let refs = {};

/* Valor de um campo já formatado (moeda com R$) */
function fieldValue(key) {
  let v = (f[key] || "").trim();
  if (FMAP[key]?.currency && v) v = "R$ " + v;
  return v;
}

/* ---- Conteúdo do contrato (HTML) — `blank(label)` decide como mostrar vazio ---- */
function contractHTML(blank) {
  const G = (k, lbl) => { const v = fieldValue(k); return v ? escapeHtml(v) : blank(lbl); };
  return `
<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO WEB E INFRAESTRUTURA DIGITAL</h2>

<p><b>CONTRATADA:</b> 62.852.999 MATHEUS AMARAL LARA - ME, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 62.852.999/0001-54, representando a agência NEXOS WEB, com sede profissional em Betim - MG.</p>

<p><b>CONTRATANTE:</b> ${G("contratante", "NOME DA CONTRATANTE")}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${G("cnpj", "CNPJ")}, com sede na ${G("endereco", "ENDEREÇO")}.</p>

<p>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e prazo descritas abaixo.</p>

<h3>CLÁUSULA PRIMEIRA – DO OBJETO</h3>
<p>1.1. O presente contrato tem por objeto a prestação de serviços de desenvolvimento de um website exclusivo (Landing Page) de alta performance, sob medida, para a CONTRATANTE, bem como a manutenção técnica contínua e hospedagem associada.</p>

<h3>CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DA CONTRATADA</h3>
<p>2.1. A CONTRATADA compromete-se a executar os serviços conforme os padrões de modernidade e otimização acordados, englobando:</p>
<ul>
  <li>Desenvolvimento de código customizado e design exclusivo;</li>
  <li>Otimização de velocidade e responsividade para dispositivos móveis (celulares e tablets);</li>
  <li>Configuração técnica;</li>
  <li>Instalação e configuração de certificado de segurança SSL (HTTPS);</li>
  <li>${G("servicoEspecifico", "ITEM ESPECÍFICO DO PROJETO")}</li>
</ul>

<h3>CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DA CONTRATANTE</h3>
<p>3.1. A CONTRATANTE compromete-se a fornecer todas as informações, logotipos, textos, imagens e dados institucionais necessários para a composição completa do site dentro do prazo combinado.</p>
<p>3.2. Efetuar os pagamentos nas datas e valores estipulados na Cláusula Quarta deste instrumento.</p>

<h3>CLÁUSULA QUARTA – DOS VALORES E CONDIÇÕES DE PAGAMENTO</h3>
<p>4.1. Pelos serviços de desenvolvimento e entrega do website, bem como pelas taxas de manutenção atreladas, a CONTRATANTE pagará os valores estabelecidos na tabela descritiva abaixo:</p>
<table class="ct-table">
  <thead><tr><th>Serviço Contratado</th><th>Periodicidade</th><th>Valor (R$)</th><th>Previsão de Vencimento</th></tr></thead>
  <tbody>
    <tr><td>${G("servico1", "Serviço")}</td><td>Taxa Única</td><td>${G("valor1", "R$ —")}</td><td>${G("venc1", "—")}</td></tr>
    <tr><td>${G("servico2", "Serviço")}</td><td>${G("periodicidade2", "—")}</td><td>${G("valor2", "R$ —")}</td><td>${G("venc2", "—")}</td></tr>
  </tbody>
</table>

<h3>CLÁUSULA QUINTA – DA HOSPEDAGEM E MANUTENÇÃO</h3>
<p>5.1. ${G("hospedagem", "TEXTO DA HOSPEDAGEM")}</p>
<p>5.2. ${G("manutencao", "TEXTO DA MANUTENÇÃO")}</p>

<h3>CLÁUSULA SEXTA – DO FORO</h3>
<p>6.1. Para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, as partes elegem o Foro da Comarca de Betim - MG, com renúncia expressa a qualquer outro por mais privilegiado que seja.</p>

<p class="sign">Betim, MG, ${G("dataContrato", "DD/MM/AAAA")}.</p>
<p class="sign">____________________________________________________
CONTRATADA: 62.852.999 MATHEUS AMARAL LARA - ME (NEXOS WEB)</p>
<p class="sign">____________________________________________________
CONTRATANTE: ${G("contratante", "NOME DA CONTRATANTE")}</p>
`;
}

/* ---- Montagem ---- */
export async function mount(container) {
  const view = el("div", { class: "view" });
  const form = el("div", { class: "card" });
  const preview = el("div", { class: "card contract-preview-card" });
  view.append(el("div", { class: "grid-2col contract-grid" }, form, preview));
  container.appendChild(view);

  buildForm(form);
  refs.preview = preview;
  renderPreview();
}

export function unmount() {}

function buildForm(form) {
  form.appendChild(el("div", { class: "card-head" },
    el("div", {},
      el("div", { class: "card-title" }, "Dados do contrato"),
      el("div", { class: "card-sub" }, "Preencha os campos entre destaque. O modelo é fixo; só muda o que é do projeto.")),
  ));

  let firstGroup = true;
  for (const item of FIELDS) {
    if (item.group) {
      form.appendChild(el("div", { class: "ct-group" + (firstGroup ? " first" : "") }, item.group));
      firstGroup = false;
      continue;
    }
    const input = fieldInput(item);
    form.appendChild(el("div", { class: "field" },
      el("label", { class: "label" }, item.label, item.required ? el("span", { class: "req" }, " *") : null),
      input,
    ));
  }

  form.appendChild(el("div", { class: "contract-actions", style: "margin-top:var(--sp-5)" },
    el("button", { class: "btn btn-secondary", onClick: generateWord },
      el("span", { html: icons.download }), "Gerar Word"),
    el("button", { class: "btn btn-primary", onClick: generatePDF },
      el("span", { html: icons.contract }), "Gerar contrato (PDF)"),
  ));
}

function fieldInput(cfg) {
  if (cfg.multiline) {
    const t = el("textarea", { class: "textarea", placeholder: cfg.ph || "" }, f[cfg.key] || "");
    t.addEventListener("input", () => { f[cfg.key] = t.value; renderPreview(); });
    return t;
  }
  const wrap = cfg.currency
    ? (() => { const i = el("input", { class: "input", type: "text", placeholder: cfg.ph || "" }); return i; })()
    : el("input", { class: "input", type: "text", placeholder: cfg.ph || "", value: f[cfg.key] || "" });
  if (cfg.currency) { maskCurrency(wrap); if (f[cfg.key]) wrap.value = f[cfg.key]; }
  if (cfg.date) maskDate(wrap);
  wrap.addEventListener("input", () => { f[cfg.key] = wrap.value; renderPreview(); });

  if (cfg.currency) {
    return el("div", { class: "input-group" }, el("span", { class: "prefix" }, "R$"), wrap);
  }
  return wrap;
}

/* ---- Pré-visualização ---- */
function renderPreview() {
  if (!refs.preview) return;
  const blank = (lbl) => `<span class="ct-blank">${escapeHtml(lbl || "____")}</span>`;
  refs.preview.replaceChildren(
    el("div", { class: "card-head" },
      el("div", {},
        el("div", { class: "card-title" }, "Pré-visualização"),
        el("div", { class: "card-sub" }, "Os trechos em destaque são preenchidos pelos campos ao lado")),
    ),
    el("div", { class: "contract-doc", html: contractHTML(blank) }),
  );
}

/* ---- Validação e utilidades ---- */
function validate() {
  if (!(f.contratante || "").trim()) { toast("Informe o nome da CONTRATANTE.", "error"); return false; }
  if (!(f.valor1 || "").trim()) { toast("Informe o valor do desenvolvimento (Serviço 1).", "error"); return false; }
  return true;
}
function slug(s) { return (s || "contrato").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Falha ao carregar recurso de geração."));
    document.head.appendChild(s);
  });
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Converte o HTML do contrato em texto simples (para o PDF) */
function contractText() {
  let h = contractHTML(() => "__________");
  return h
    .replace(/<\/(p|h2|h3|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/th>\s*<th>/gi, "  |  ").replace(/<\/td>\s*<td>/gi, "  |  ")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n").map((s) => s.trim()).filter((s, i, a) => !(s === "" && a[i - 1] === "")).join("\n").trim();
}

/* ---- PDF ---- */
async function generatePDF() {
  if (!validate()) return;
  try {
    toast("Gerando PDF…", "info", 1200);
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 52, W = 595 - 2 * M; let y = 60;
    const lines = contractText().split("\n");
    for (const raw of lines) {
      const isTitle = /^CONTRATO DE PRESTAÇÃO/.test(raw);
      const isHead = /^CLÁUSULA /.test(raw) || /^(CONTRATADA:|CONTRATANTE:)/.test(raw);
      doc.setFont("times", isTitle || isHead ? "bold" : "normal");
      doc.setFontSize(isTitle ? 12.5 : 11);
      const wrapped = doc.splitTextToSize(raw || " ", W);
      for (const ln of wrapped) {
        if (y > 800) { doc.addPage(); y = 60; }
        doc.text(ln, isTitle ? 297.5 : M, y, isTitle ? { align: "center" } : undefined);
        y += isTitle ? 16 : 14.5;
      }
      if (isHead || isTitle) y += 2;
    }
    doc.save(`contrato-${slug(f.contratante)}.pdf`);
    toast("Contrato em PDF gerado.", "success");
  } catch (err) { toast(err.message || "Erro ao gerar PDF.", "error"); }
}

/* ---- Word (.doc HTML) ---- */
function generateWord() {
  if (!validate()) return;
  const body = contractHTML((lbl) => `<span style="color:#888">__________</span>`);
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Contrato ${escapeHtml(f.contratante || "")}</title>
<style>
  body { font-family:'Times New Roman',serif; font-size:11.5pt; color:#111; }
  h2 { font-size:13pt; text-align:center; }
  h3 { font-size:11.5pt; margin:12pt 0 4pt; }
  p { text-align:justify; margin:0 0 7pt; }
  table { border-collapse:collapse; width:100%; margin:8pt 0; }
  th,td { border:1px solid #999; padding:5pt 7pt; font-size:10.5pt; text-align:left; }
  th { background:#eee; }
  .sign { white-space:pre-line; margin-top:12pt; }
</style></head><body>${body}</body></html>`;
  downloadBlob(new Blob(["﻿", html], { type: "application/msword" }), `contrato-${slug(f.contratante)}.doc`);
  toast("Contrato em Word gerado.", "success");
}
