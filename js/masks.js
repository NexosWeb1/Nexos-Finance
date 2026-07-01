/* ============================================================
   masks.js — máscaras de data (DD/MM/AAAA) e moeda (R$)
   ============================================================ */

/* Aplica máscara de data enquanto o usuário digita */
export function maskDate(input) {
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("maxlength", "10");
  input.setAttribute("placeholder", "DD/MM/AAAA");
  input.addEventListener("input", () => {
    let v = input.value.replace(/\D/g, "").slice(0, 8);
    if (v.length >= 5) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    else if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    input.value = v;
  });
}

/* Aplica máscara monetária BRL. O valor exibido é "1.234,56".
   Use parseBRLtoCents(input.value) para obter centavos. */
export function maskCurrency(input) {
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("placeholder", "0,00");
  const format = (digits) => {
    digits = digits.replace(/\D/g, "");
    if (!digits) return "";
    digits = String(parseInt(digits, 10)); // remove zeros à esquerda
    while (digits.length < 3) digits = "0" + digits;
    const cents = digits.slice(-2);
    let intPart = digits.slice(0, -2);
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${intPart},${cents}`;
  };
  input.addEventListener("input", () => { input.value = format(input.value); });
  input.addEventListener("blur", () => { if (input.value) input.value = format(input.value); });
}

/* Define o valor de um campo de moeda a partir de centavos (para edição) */
export function setCurrencyValue(input, cents) {
  const v = (Number(cents) || 0) / 100;
  input.value = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
