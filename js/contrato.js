/* ============================================================
   contrato.js — Gerar Contrato

   Modelo padrão (texto base) + campos editáveis por projeto.
   - Campos: empresa, valor, data, serviço, manutenção, hospedagem
   - Upload de um "arquivo padrão" reutilizado em todos os contratos
     (persistido via Settings). Se for .docx com tags {empresa} etc.,
     o contrato é gerado preenchendo o seu próprio modelo (docxtemplater).
   - Sempre disponível: gerar PDF e Word a partir do modelo padrão interno.
   ============================================================ */
import { el, icons, fmtBRL, parseBRLtoCents, isoToBR, brToISO, toast } from "./ui.js";
import { maskDate, maskCurrency } from "./masks.js";
import { Settings, readFileAsAttachment } from "./store.js";

export const meta = {
  title: "Gerar Contrato",
  subtitle: "Contratos a partir de um modelo padrão",
};

let templateFile = null;     // { name, dataUrl } reutilizado em todos os contratos
let onChange;
const f = { empresa: "", valorCents: 0, data: "", servico: "", hospedagem: "", manutencao: "" };
let refs = {};

/* Dados de mescla (com placeholders visíveis quando vazio, p/ pré-visualização) */
function mergeData(forDoc = false) {
  const ph = (v, fallback) => (v ? v : forDoc ? "" : fallback);
  return {
    empresa: ph(f.empresa, "_______________________"),
    valor: f.valorCents ? fmtBRL(f.valorCents) : (forDoc ? "" : "R$ ____________"),
    data: f.data ? isoToBR(f.data) : (forDoc ? "" : "__/__/____"),
    servico: ph(f.servico, "_______________________"),
    hospedagem: ph(f.hospedagem, "Não incluída"),
    manutencao: ph(f.manutencao, "Não incluída"),
  };
}

function contractText(d) {
  return `Pelo presente instrumento particular de prestação de serviços, de um lado NEXOS WEB, doravante denominada CONTRATADA, e de outro lado ${d.empresa}, doravante denominada CONTRATANTE, têm entre si justo e contratado o seguinte:

CLÁUSULA 1ª — DO OBJETO
A CONTRATADA prestará à CONTRATANTE os seguintes serviços: ${d.servico}.

CLÁUSULA 2ª — DO VALOR
Pelos serviços descritos, a CONTRATANTE pagará à CONTRATADA o valor total de ${d.valor}.

CLÁUSULA 3ª — DA HOSPEDAGEM
${d.hospedagem}.

CLÁUSULA 4ª — DA MANUTENÇÃO
${d.manutencao}.

CLÁUSULA 5ª — DA VIGÊNCIA
O presente contrato entra em vigor na data de ${d.data}, vigorando pelo prazo acordado entre as partes.

E, por estarem assim justas e contratadas, as partes firmam o presente instrumento em duas vias de igual teor e forma.

${d.data}


__________________________            __________________________
NEXOS WEB                             ${d.empresa}
CONTRATADA                            CONTRATANTE`;
}

const TITLE_1 = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";
const TITLE_2 = "DE DESENVOLVIMENTO WEB";

export async function mount(container) {
  templateFile = await Settings.get("contractTemplate", null);

  const view = el("div", { class: "view" });

  // Form (esquerda) + preview (direita)
  const form = el("div", { class: "card" });
  const preview = el("div", { class: "card contract-preview-card" });

  const grid = el("div", { class: "grid-2col contract-grid" }, form, preview);
  view.append(grid);
  container.appendChild(view);

  buildForm(form);
  refs.preview = preview;
  renderPreview();

  onChange = async () => { templateFile = await Settings.get("contractTemplate", null); renderTemplateBox(); };
  window.addEventListener("store:changed", onChange);
}

export function unmount() {
  window.removeEventListener("store:changed", onChange);
}

function buildForm(form) {
  // Campo de texto genérico
  const textField = (key, label, placeholder, required) => {
    const input = el("input", { class: "input", placeholder, value: f[key] || "" });
    input.addEventListener("input", () => { f[key] = input.value; renderPreview(); });
    return el("div", { class: "field" },
      el("label", { class: "label" }, label, required ? el("span", { class: "req" }, " *") : null),
      input);
  };

  // Empresa
  const empresa = textField("empresa", "Nome da empresa", "Ex.: Monsueto Turismo Ltda.", true);

  // Valor + Data
  const valorInput = el("input", { class: "input" });
  maskCurrency(valorInput);
  valorInput.addEventListener("input", () => { f.valorCents = parseBRLtoCents(valorInput.value); renderPreview(); });
  const valorField = el("div", { class: "field" },
    el("label", { class: "label" }, "Valor ", el("span", { class: "req" }, "*")),
    el("div", { class: "input-group" }, el("span", { class: "prefix" }, "R$"), valorInput));

  const dataInput = el("input", { class: "input" });
  maskDate(dataInput);
  dataInput.addEventListener("input", () => { f.data = brToISO(dataInput.value) || ""; renderPreview(); });
  const dataField = el("div", { class: "field" },
    el("label", { class: "label" }, "Data do contrato ", el("span", { class: "req" }, "*")),
    dataInput);

  const row = el("div", { class: "row" }, valorField, dataField);

  // Serviço prestado
  const servicoInput = el("textarea", { class: "textarea", placeholder: "Ex.: Desenvolvimento de site institucional responsivo, com painel administrativo." });
  servicoInput.addEventListener("input", () => { f.servico = servicoInput.value; renderPreview(); });
  const servico = el("div", { class: "field" },
    el("label", { class: "label" }, "Serviço prestado"), servicoInput);

  // Manutenção + Hospedagem
  const manutencao = textField("manutencao", "Manutenção", "Ex.: Manutenção mensal inclusa por 12 meses");
  const hospedagem = textField("hospedagem", "Hospedagem", "Ex.: Hospedagem inclusa pelo primeiro ano");
  const row2 = el("div", { class: "row" }, manutencao, hospedagem);

  // Modelo padrão (upload reutilizável)
  const templateBox = el("div", { id: "tplBox" });

  // Ações
  const actions = el("div", { class: "contract-actions" },
    el("button", { class: "btn btn-secondary", onClick: generateWord },
      el("span", { html: icons.download }), "Gerar Word"),
    el("button", { class: "btn btn-primary", onClick: generatePDF },
      el("span", { html: icons.contract }), "Gerar contrato (PDF)"),
  );

  form.append(
    el("div", { class: "card-head" },
      el("div", {},
        el("div", { class: "card-title" }, "Dados do contrato"),
        el("div", { class: "card-sub" }, "Preencha apenas o que muda em cada projeto."))),
    empresa, row, servico, row2,
    el("div", { style: "height:1px;background:var(--border);margin:var(--sp-2) 0 var(--sp-5)" }),
    templateBox,
    actions,
  );

  refs.tplBox = templateBox;
  renderTemplateBox();
}

/* ---- Caixa do modelo padrão ---- */
function renderTemplateBox() {
  if (!refs.tplBox) return;
  const fileInput = el("input", { type: "file", class: "hidden", accept: ".docx,.doc,.pdf" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const att = await readFileAsAttachment(file);
      await Settings.set("contractTemplate", att);
      templateFile = att;
      renderTemplateBox();
      toast("Modelo padrão salvo. Será usado em todos os contratos.", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  const isDocx = templateFile && /\.docx$/i.test(templateFile.name);

  const box = el("div", { class: "field" },
    el("label", { class: "label" }, "Modelo padrão do contrato (arquivo reutilizável)"),
  );

  if (templateFile) {
    box.appendChild(el("div", { class: "tpl-file" },
      el("span", { class: "tpl-ic", html: icons.file }),
      el("div", { style: "flex:1;min-width:0" },
        el("div", { style: "font-weight:var(--fw-semibold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, templateFile.name),
        el("div", { class: "text-dim", style: "font-size:var(--fs-xs)" },
          isDocx ? "Modelo .docx — será preenchido com as tags abaixo" : "Anexado a todos os contratos"),
      ),
      el("button", { class: "btn btn-sm btn-ghost", onClick: () => fileInput.click() }, "Trocar"),
      el("button", { class: "btn btn-icon btn-sm btn-ghost", title: "Remover", html: icons.trash,
        onClick: async () => { await Settings.set("contractTemplate", null); templateFile = null; renderTemplateBox(); toast("Modelo removido.", "info"); } }),
      fileInput,
    ));
    if (isDocx) {
      box.appendChild(el("button", { class: "btn btn-secondary btn-block", style: "margin-top:var(--sp-3)", onClick: generateFromTemplate },
        el("span", { html: icons.contract }), "Gerar a partir do meu modelo (.docx)"));
    }
  } else {
    const up = el("div", { class: "upload", onClick: () => fileInput.click() },
      el("div", { html: icons.upload }),
      el("div", {}, "Enviar modelo padrão (.docx, .doc ou .pdf)"),
      el("div", { class: "text-dim", style: "font-size:var(--fs-xs);margin-top:4px" },
        "Dica: em um .docx, use as tags {empresa} {valor} {data} {servico} {hospedagem} {manutencao} para preenchimento automático."),
      fileInput,
    );
    box.appendChild(up);
  }
  refs.tplBox.replaceChildren(box);
}

/* ---- Pré-visualização ---- */
function renderPreview() {
  if (!refs.preview) return;
  const d = mergeData(false);
  refs.preview.replaceChildren(
    el("div", { class: "card-head" },
      el("div", {},
        el("div", { class: "card-title" }, "Pré-visualização"),
        el("div", { class: "card-sub" }, "Atualiza conforme você preenche")),
    ),
    el("div", { class: "contract-doc" },
      el("div", { class: "contract-doc-title" }, TITLE_1, el("br"), TITLE_2),
      el("pre", { class: "contract-doc-body" }, contractText(d)),
    ),
  );
}

/* ---- Validação mínima ---- */
function validate() {
  if (!f.empresa.trim()) { toast("Informe o nome da empresa.", "error"); return false; }
  if (!f.valorCents) { toast("Informe o valor do contrato.", "error"); return false; }
  if (!f.data) { toast("Informe uma data válida (DD/MM/AAAA).", "error"); return false; }
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

/* ---- PDF (modelo interno) ---- */
async function generatePDF() {
  if (!validate()) return;
  try {
    toast("Gerando PDF…", "info", 1200);
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 56, W = 595 - 2 * M; let y = 70;

    doc.setFont("times", "bold"); doc.setFontSize(14);
    doc.text(TITLE_1, 297.5, y, { align: "center" }); y += 18;
    doc.text(TITLE_2, 297.5, y, { align: "center" }); y += 34;

    doc.setFont("times", "normal"); doc.setFontSize(11.5);
    const lines = doc.splitTextToSize(contractText(mergeData(true)), W);
    for (const line of lines) {
      if (y > 800) { doc.addPage(); y = 70; }
      doc.text(line, M, y); y += 16;
    }
    doc.save(`contrato-${slug(f.empresa)}.pdf`);
    toast("Contrato em PDF gerado.", "success");
  } catch (err) { toast(err.message || "Erro ao gerar PDF.", "error"); }
}

/* ---- Word (.doc HTML, modelo interno) ---- */
function generateWord() {
  if (!validate()) return;
  const body = contractText(mergeData(true)).split("\n").map((l) =>
    l.trim() === "" ? "<p>&nbsp;</p>" : `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Contrato ${f.empresa}</title>
<style>body{font-family:'Times New Roman',serif;font-size:11.5pt;line-height:1.5;color:#111}
h1{font-size:14pt;text-align:center;margin:0} p{margin:0 0 6pt;text-align:justify}</style></head>
<body><h1>${TITLE_1}<br/>${TITLE_2}</h1><br/>${body}</body></html>`;
  downloadBlob(new Blob(["﻿", html], { type: "application/msword" }), `contrato-${slug(f.empresa)}.doc`);
  toast("Contrato em Word gerado.", "success");
}

/* ---- Mescla no modelo .docx enviado (docxtemplater) ---- */
async function generateFromTemplate() {
  if (!validate()) return;
  if (!templateFile || !/\.docx$/i.test(templateFile.name)) {
    toast("Envie um modelo .docx para usar esta opção.", "error"); return;
  }
  try {
    toast("Preenchendo seu modelo…", "info", 1500);
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.7/pizzip.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.50.0/docxtemplater.js");
    const base64 = templateFile.dataUrl.split(",")[1];
    const zip = new window.PizZip(atob(base64));
    const Docx = window.docxtemplater?.default || window.docxtemplater;
    const doc = new Docx(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(mergeData(true));
    const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    downloadBlob(blob, `contrato-${slug(f.empresa)}.docx`);
    toast("Contrato gerado a partir do seu modelo.", "success");
  } catch (err) {
    toast("Não foi possível preencher o modelo. Confira se ele contém as tags {empresa}, {valor}, {data}, {servico}, {hospedagem}, {manutencao}.", "error");
  }
}
