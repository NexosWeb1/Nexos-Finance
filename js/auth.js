/* ============================================================
   auth.js — login, sessão e guarda de rota

   Dois modos:
   - Supabase Auth (e-mail + senha) quando USE_SUPABASE === true
   - Mock local (usuário/senha fixos) como fallback de desenvolvimento
   ============================================================ */
import { supa, supaEnabled, projectRef } from "./db.js";

const SESSION_KEY = "nexos.session";

/* Credenciais do modo mock (apenas quando Supabase está desligado) */
const MOCK_USERS = [
  { user: "admin", pass: "nexos2026", name: "Administrador", role: "Financeiro" },
];

function userFromSupabase(u) {
  return {
    user: u.email,
    email: u.email,
    name: u.user_metadata?.name || (u.email || "").split("@")[0],
    role: u.user_metadata?.role || "Equipe",
  };
}

/* ---- Mock helpers ---- */
function mockUser() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

/* Leitura síncrona (best-effort) p/ o guard rápido e exibição inicial.
   No modo Supabase, lê o token persistido no localStorage. */
export function currentUser() {
  if (supaEnabled()) {
    try {
      const raw = localStorage.getItem(`sb-${projectRef()}-auth-token`);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const u = s?.user || s?.currentSession?.user;
      return u ? userFromSupabase(u) : null;
    } catch { return null; }
  }
  return mockUser();
}

export function isAuthenticated() { return !!currentUser(); }

function mapAuthError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha inválidos.";
  if (m.includes("email not confirmed")) return "E-mail não confirmado. Confirme o usuário no Supabase (Authentication > Users).";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet.";
  return msg || "Não foi possível entrar.";
}

/* ---- Login ---- */
export async function login(identifier, password) {
  if (supaEnabled()) {
    const { data, error } = await supa().auth.signInWithPassword({
      email: String(identifier).trim(), password,
    });
    if (error) { const e = new Error(mapAuthError(error.message)); e.handled = true; throw e; }
    if (!data?.session) return null;
    return userFromSupabase(data.user);
  }
  // Mock
  await new Promise((r) => setTimeout(r, 350));
  const found = MOCK_USERS.find(
    (u) => u.user.toLowerCase() === String(identifier).trim().toLowerCase() && u.pass === password
  );
  if (!found) return null;
  const session = { user: found.user, name: found.name, role: found.role, at: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function logout() {
  if (supaEnabled()) { try { await supa().auth.signOut(); } catch {} }
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

/* ---- Guardas de rota ---- */
export async function requireAuth() {
  if (supaEnabled()) {
    const { data } = await supa().auth.getSession();
    if (!data?.session) { window.location.replace("index.html"); await new Promise(() => {}); }
    return userFromSupabase(data.session.user);
  }
  if (!isAuthenticated()) { window.location.replace("index.html"); await new Promise(() => {}); }
  return currentUser();
}

export async function redirectIfAuthed() {
  if (supaEnabled()) {
    const { data } = await supa().auth.getSession();
    if (data?.session) window.location.replace("app.html");
    return;
  }
  if (isAuthenticated()) window.location.replace("app.html");
}
