/* ============================================================
   validation.js — validação de campos do formulário
   ============================================================ */
import { brToISO } from "./ui.js";
import { parseBRLtoCents } from "./ui.js";

/* Marca/limpa erro num .field */
function setError(field, message) {
  field.classList.add("invalid");
  const input = field.querySelector(".input, .textarea, .select");
  if (input) input.classList.add("error");
  const errEl = field.querySelector(".field-error");
  if (errEl && message) errEl.textContent = message;
}
function clearError(field) {
  field.classList.remove("invalid");
  const input = field.querySelector(".input, .textarea, .select");
  if (input) input.classList.remove("error");
}

/* Valida o formulário do modal financeiro/demanda.
   Regras: título, data e valor obrigatórios. Descrição e upload opcionais.
   Retorna { ok, values } */
export function validateForm(form) {
  let ok = true;

  const titleField = form.querySelector('[data-field="title"]');
  const amountField = form.querySelector('[data-field="amount"]');
  const dateField = form.querySelector('[data-field="date"]');
  const startField = form.querySelector('[data-field="dateStart"]');
  const endField = form.querySelector('[data-field="dateEnd"]');

  [titleField, amountField, dateField, startField, endField].forEach((f) => f && clearError(f));

  const title = titleField.querySelector(".input").value.trim();
  if (!title) { setError(titleField, "Informe um título."); ok = false; }

  const amountInput = amountField.querySelector(".input");
  const cents = parseBRLtoCents(amountInput.value);
  if (!amountInput.value.trim() || cents <= 0) { setError(amountField, "Informe um valor válido."); ok = false; }

  const values = {
    title,
    amount: cents,
    description: (form.querySelector('[data-field="description"] .textarea')?.value || "").trim(),
  };

  if (dateField) {
    // Modo financeiro — data única
    const di = dateField.querySelector(".input");
    const iso = brToISO(di.value.trim());
    if (!di.value.trim()) { setError(dateField, "Informe a data."); ok = false; }
    else if (!iso) { setError(dateField, "Data inválida. Use DD/MM/AAAA."); ok = false; }
    values.date = iso;
  } else if (startField) {
    // Modo demanda — início (obrigatório) e fim (opcional)
    const si = startField.querySelector(".input");
    const isoStart = brToISO(si.value.trim());
    if (!si.value.trim()) { setError(startField, "Informe a data de início."); ok = false; }
    else if (!isoStart) { setError(startField, "Data inválida. Use DD/MM/AAAA."); ok = false; }
    values.dateStart = isoStart;

    let isoEnd = "";
    const ei = endField?.querySelector(".input");
    if (ei && ei.value.trim()) {
      isoEnd = brToISO(ei.value.trim());
      if (!isoEnd) { setError(endField, "Data final inválida. Use DD/MM/AAAA."); ok = false; }
      else if (isoStart && isoEnd < isoStart) { setError(endField, "A data final não pode ser antes do início."); ok = false; }
    }
    values.dateEnd = isoEnd || isoStart;
  }

  return { ok, values };
}

/* Habilita limpeza de erro ao digitar */
export function liveClear(form) {
  form.querySelectorAll(".field").forEach((field) => {
    const input = field.querySelector(".input, .textarea, .select");
    if (input) input.addEventListener("input", () => clearError(field), { once: false });
  });
}
