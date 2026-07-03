/* ============================================================
   modal.js — card/modal de formulário reutilizável
   Usado para criar/editar Entradas, Saídas e Demandas.

   openFormModal({ mode, record, defaultDate, onSubmit })
     mode: 'finance' | 'demanda'
     record: objeto existente (edição) ou null (novo)
     defaultDate: yyyy-mm-dd para pré-preencher
     onSubmit: async (values) => {}   // values já validados
   ============================================================ */
import { el, icons, isoToBR, toast } from "./ui.js";
import { maskDate, maskCurrency, setCurrencyValue } from "./masks.js";
import { validateForm, liveClear } from "./validation.js";
import { readFileAsAttachment } from "./store.js";

const STATUS_OPTS = [
  { value: "nao_iniciada", label: "Não iniciada" },
  { value: "em_desenvolvimento", label: "Em desenvolvimento" },
  { value: "concluida", label: "Concluída" },
];

export function openFormModal({ mode = "finance", record = null, defaultDate = "", onSubmit }) {
  const isFinance = mode === "finance";
  const isEdit = !!(record && record.id);
  let attachment = record?.attachment || null;
  let txType = record?.type || "entrada"; // só finance

  const overlay = el("div", { class: "modal-overlay" });
  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true" });

  const title = isFinance
    ? (isEdit ? "Editar lançamento" : "Novo lançamento")
    : (isEdit ? "Editar demanda" : "Nova demanda");
  const sub = isFinance
    ? "Registre uma entrada ou saída financeira."
    : "Cadastre uma demanda e acompanhe seu status.";

  // ---- Head ----
  const closeBtn = el("button", { class: "btn btn-icon btn-ghost", "aria-label": "Fechar", html: icons.x });
  const head = el("div", { class: "modal-head" },
    el("div", {},
      el("h3", {}, title),
      el("div", { class: "modal-sub" }, sub),
    ),
    closeBtn,
  );

  // ---- Body / form ----
  const form = el("form", { id: "recordForm", novalidate: "true" });

  // Tipo (entrada/saída) — só finance
  let typeSeg;
  if (isFinance) {
    const btnEntrada = el("button", { type: "button", class: "active",
      html: '<span class="dot" style="background:var(--entrada)"></span>Entrada' });
    const btnSaida = el("button", { type: "button",
      html: '<span class="dot" style="background:var(--saida)"></span>Saída' });
    const setType = (t) => {
      txType = t;
      btnEntrada.classList.toggle("active", t === "entrada");
      btnSaida.classList.toggle("active", t === "saida");
    };
    btnEntrada.addEventListener("click", () => setType("entrada"));
    btnSaida.addEventListener("click", () => setType("saida"));
    setType(txType);
    typeSeg = el("div", { class: "field" },
      el("label", { class: "label" }, "Tipo"),
      el("div", { class: "segmented", style: "width:100%" }, btnEntrada, btnSaida),
    );
    btnEntrada.style.flex = btnSaida.style.flex = "1";
  }

  // Título *
  const titleInput = el("input", { class: "input", type: "text", placeholder: "Ex.: Assinatura Adobe", value: record?.title || "" });
  const fTitle = el("div", { class: "field", dataset: { field: "title" } },
    el("label", { class: "label" }, "Título ", el("span", { class: "req" }, "*")),
    titleInput,
    el("div", { class: "field-error" }, "Informe um título."),
  );

  // Descrição
  const descInput = el("textarea", { class: "textarea", placeholder: "Detalhes (opcional)" }, record?.description || "");
  const fDesc = el("div", { class: "field", dataset: { field: "description" } },
    el("label", { class: "label" }, "Descrição"),
    descInput,
  );

  // Valor * (comum aos dois modos)
  const amountInput = el("input", { class: "input", type: "text" });
  maskCurrency(amountInput);
  if (record?.amount) setCurrencyValue(amountInput, record.amount);
  const fAmount = el("div", { class: "field", dataset: { field: "amount" } },
    el("label", { class: "label" }, "Valor ", el("span", { class: "req" }, "*")),
    el("div", { class: "input-group" }, el("span", { class: "prefix" }, "R$"), amountInput),
    el("div", { class: "field-error" }, "Informe um valor válido."),
  );

  // Datas — financeiro: uma data; demanda: início e fim
  const mkDate = (value) => {
    const input = el("input", { class: "input", type: "text" });
    maskDate(input);
    if (value) input.value = isoToBR(value);
    return input;
  };
  let dateAmountRow;
  if (isFinance) {
    const dateInput = mkDate(record?.date || defaultDate);
    const fDate = el("div", { class: "field", dataset: { field: "date" } },
      el("label", { class: "label" }, "Data ", el("span", { class: "req" }, "*")),
      dateInput,
      el("div", { class: "field-error" }, "Informe a data."),
    );
    dateAmountRow = el("div", { class: "row" }, fDate, fAmount);
  } else {
    const startInput = mkDate(record?.dateStart || defaultDate);
    const fStart = el("div", { class: "field", dataset: { field: "dateStart" } },
      el("label", { class: "label" }, "Data início ", el("span", { class: "req" }, "*")),
      startInput,
      el("div", { class: "field-error" }, "Informe a data de início."),
    );
    const endInput = mkDate(record?.dateEnd);
    const fEnd = el("div", { class: "field", dataset: { field: "dateEnd" } },
      el("label", { class: "label" }, "Data final"),
      endInput,
      el("div", { class: "field-error" }, "Data final inválida."),
    );
    dateAmountRow = el("div", {}, el("div", { class: "row" }, fStart, fEnd), fAmount);
  }

  // Status (demanda) ou Recorrência (finance)
  let extraField;
  let statusSelect, recurringInput;
  if (isFinance) {
    recurringInput = el("input", { type: "checkbox" });
    if (record?.recurring) recurringInput.checked = true;
    extraField = el("div", { class: "field" },
      el("label", { class: "switch" },
        recurringInput,
        el("span", { class: "track" }),
        el("span", {},
          el("span", { html: icons.repeat, style: "display:inline-block;width:15px;vertical-align:-2px;margin-right:6px;color:var(--text-muted)" }),
          "Saída/entrada mensal recorrente (ex.: assinatura)"),
      ),
      el("div", { class: "text-dim", style: "font-size:var(--fs-xs);margin-top:6px" },
        "Será projetada automaticamente todos os meses a partir da data informada."),
    );
  } else {
    statusSelect = el("select", { class: "select" },
      ...STATUS_OPTS.map((o) => el("option", { value: o.value, selected: record?.status === o.value ? "selected" : null }, o.label)));
    extraField = el("div", { class: "field" },
      el("label", { class: "label" }, "Status"),
      statusSelect,
    );
  }

  // Upload
  const fileInput = el("input", { type: "file", class: "hidden",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" });
  const uploadInner = el("div", {});
  const uploadBox = el("div", { class: "upload" }, uploadInner);
  const renderUpload = () => {
    if (attachment) {
      uploadInner.replaceChildren(
        el("div", { html: icons.paperclip, style: "display:inline-block;width:22px;margin:0 auto" }),
        el("div", { class: "file-chip" },
          el("span", {}, attachment.name),
          el("button", { type: "button", title: "Remover", html: icons.x,
            onClick: (e) => { e.stopPropagation(); attachment = null; renderUpload(); } }),
        ),
      );
    } else {
      uploadInner.replaceChildren(
        el("div", { html: icons.upload }),
        el("div", {}, "Clique ou arraste um arquivo"),
        el("div", { class: "text-dim", style: "font-size:var(--fs-xs);margin-top:4px" }, "Imagem, PDF ou documento · até 2MB"),
      );
    }
  };
  renderUpload();
  uploadBox.addEventListener("click", () => fileInput.click());
  ["dragover", "dragenter"].forEach((ev) => uploadBox.addEventListener(ev, (e) => { e.preventDefault(); uploadBox.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => uploadBox.addEventListener(ev, (e) => { e.preventDefault(); uploadBox.classList.remove("dragover"); }));
  uploadBox.addEventListener("drop", async (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) await handleFile(file);
  });
  async function handleFile(file) {
    try { attachment = await readFileAsAttachment(file); renderUpload(); }
    catch (err) { toast(err.message, "error"); }
  }
  const fUpload = el("div", { class: "field" },
    el("label", { class: "label" }, "Anexo"),
    uploadBox, fileInput,
  );

  form.append(
    ...(typeSeg ? [typeSeg] : []),
    fTitle, fDesc, dateAmountRow, extraField, fUpload,
  );
  liveClear(form);

  const body = el("div", { class: "modal-body" }, form);

  // ---- Foot ----
  const cancelBtn = el("button", { type: "button", class: "btn btn-secondary" }, "Cancelar");
  const saveBtn = el("button", { type: "submit", form: "recordForm", class: "btn btn-primary" },
    el("span", {}, isEdit ? "Salvar alterações" : "Cadastrar"));
  const foot = el("div", { class: "modal-foot" }, cancelBtn, saveBtn);

  modal.append(head, body, foot);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  setTimeout(() => titleInput.focus(), 60);

  // ---- Fechar ----
  function close() {
    document.body.style.overflow = "";
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);

  // ---- Submit ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { ok, values } = validateForm(form);
    if (!ok) { toast("Preencha os campos obrigatórios.", "error"); return; }

    const payload = { ...values, attachment };
    if (isFinance) {
      payload.type = txType;
      payload.recurring = recurringInput.checked;
    } else {
      payload.status = statusSelect.value;
    }

    saveBtn.disabled = true;
    saveBtn.firstChild.replaceWith(el("span", { class: "spinner" }));
    try {
      await onSubmit(payload);
      toast(isEdit ? "Atualizado com sucesso." : "Cadastrado com sucesso.", "success");
      close();
    } catch (err) {
      toast(err.message || "Erro ao salvar.", "error");
      saveBtn.disabled = false;
      saveBtn.replaceChildren(el("span", {}, isEdit ? "Salvar alterações" : "Cadastrar"));
    }
  });

  return { close };
}
