/* ============================================================
   config.example.js — modelo de configuração do frontend

   COMO USAR:
   1. Copie este arquivo para "js/config.js"
   2. Preencha com as credenciais do seu projeto Supabase
      (as mesmas do arquivo .env)

   Observação: por ser um site estático (sem build), o navegador
   lê a configuração a partir DESTE arquivo JS — não do .env.
   A "anon key" do Supabase é pública por design (protegida por
   Row Level Security no banco), então pode ficar no frontend.
   ============================================================ */
window.NEXOS_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...sua-anon-key-aqui",

  // true = usar Supabase (login real + dados na nuvem).
  // false = usar armazenamento local no navegador (localStorage).
  USE_SUPABASE: false,
};
