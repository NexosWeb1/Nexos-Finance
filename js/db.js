/* ============================================================
   db.js — cliente Supabase compartilhado (store.js e auth.js)

   Só fica ativo quando window.NEXOS_CONFIG.USE_SUPABASE === true
   E a URL/chave estão preenchidas E o supabase-js (CDN) carregou.
   Caso contrário, o app usa o fallback localStorage.
   ============================================================ */

let _client = null;

export function supaEnabled() {
  const cfg = window.NEXOS_CONFIG || {};
  return !!(cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase?.createClient);
}

export function supa() {
  if (!supaEnabled()) return null;
  if (!_client) {
    const cfg = window.NEXOS_CONFIG;
    _client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
}

/* Ref do projeto (subdomínio da URL) — usado pelo guard de rota */
export function projectRef() {
  const cfg = window.NEXOS_CONFIG || {};
  return (cfg.SUPABASE_URL || "").match(/https?:\/\/([^.]+)\./)?.[1] || "";
}
