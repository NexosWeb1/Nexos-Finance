/* ============================================================
   gen-config.js — gera js/config.js no build do Netlify.

   Lê as variáveis de ambiente definidas no painel do Netlify
   (Site settings > Environment variables) e escreve o config
   que o navegador lê. Assim, NENHUMA credencial fica no Git.

   Variáveis esperadas no Netlify:
     SUPABASE_URL
     SUPABASE_ANON_KEY
     USE_SUPABASE   (opcional; "true" por padrão quando URL+chave existem)
   ============================================================ */
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";
const use = !!(url && key) && (process.env.USE_SUPABASE || "true") !== "false";

const content = `/* Gerado automaticamente no build do Netlify (scripts/gen-config.js). Não editar. */
window.NEXOS_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  USE_SUPABASE: ${use},
};
`;

fs.writeFileSync(path.join(__dirname, "..", "js", "config.js"), content);
console.log(`[gen-config] js/config.js gerado — USE_SUPABASE=${use}, URL definida=${!!url}, chave definida=${!!key}`);
