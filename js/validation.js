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
  const dateField = form.querySelector('[data-field="date"]');
  const amountField = form.querySelector('[data-field="amount"]');

  [titleField, dateField, amountField].forEach((f) => f && clearError(f));

  const titleInput = titleField.querySelector(".input");
  const dateInput = dateField.querySelector(".input");
  const amountInput = amountField.querySelector(".input");

  const title = titleInput.value.trim();
  if (!title) { setError(titleField, "Informe um título."); ok = false; }

  const iso = brToISO(dateInput.value.trim());
  if (!dateInput.value.trim()) { setError(dateField, "Informe a data."); ok = false; }
  else if (!iso) { setError(dateField, "Data inválida. Use DD/MM/AAAA."); ok = false; }

  const cents = parseBRLtoCents(amountInput.value);
  if (!amountInput.value.trim() || cents <= 0) { setError(amountField, "Informe um valor válido."); ok = false; }

  return {
    ok,
    values: {
      title,
      date: iso,
      amount: cents,
      description: (form.querySelector('[data-field="description"] .textarea')?.value || "").trim(),
    },
  };
}

/* Habilita limpeza de erro ao digitar */
export function liveClear(form) {
  form.querySelectorAll(".field").forEach((field) => {
    const input = field.querySelector(".input, .textarea, .select");
    if (input) input.addEventListener("input", () => clearError(field), { once: false });
  });
}
