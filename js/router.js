/* ============================================================
   router.js — roteamento por hash + montagem de views

   Cada view exporta:
     meta = { title, subtitle }
     mount(container)
     unmount()  (opcional)
   ============================================================ */
import * as home from "./home.js";
import * as finance from "./finance.js";
import * as demandas from "./demandas.js";
import * as manutencoes from "./manutencoes.js";
import * as reports from "./reports.js";
import * as contrato from "./contrato.js";

const routes = {
  "/inicio": home,
  "/financeiro": finance,
  "/demandas": demandas,
  "/manutencoes": manutencoes,
  "/relatorios": reports,
  "/contrato": contrato,
};
const DEFAULT = "/inicio";

let current = null;

function parseHash() {
  const h = (location.hash || "").replace(/^#/, "");
  return routes[h] ? h : DEFAULT;
}

export function initRouter({ root, titleEl, subEl, navItems, onNavigate }) {
  async function navigate() {
    const path = parseHash();
    if (location.hash.replace(/^#/, "") !== path) {
      location.replace("#" + path);
      return;
    }
    const view = routes[path];

    if (current && current.unmount) { try { current.unmount(); } catch {} }
    root.replaceChildren();
    current = view;

    titleEl.textContent = view.meta.title;
    if (subEl) subEl.textContent = view.meta.subtitle || "";

    navItems.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + path));

    await view.mount(root);
    if (onNavigate) onNavigate(path);
    root.scrollTop = 0;
  }

  window.addEventListener("hashchange", navigate);
  navigate();
}
