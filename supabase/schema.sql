-- ============================================================
-- Nexos Finance — esquema do banco (PostgreSQL / Supabase)
-- Rode este script no Supabase: SQL Editor > New query > Run.
-- ============================================================

-- ---------- Tabelas ----------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('entrada','saida')),
  title         text not null,
  description   text default '',
  date          date not null,
  amount        integer not null,            -- valor em CENTAVOS
  recurring     boolean not null default false,
  recurring_day integer,
  attachment    jsonb,                        -- { name, dataUrl, size }
  created_at    timestamptz not null default now()
);

create table if not exists public.demandas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  date        date not null,
  amount      integer not null default 0,
  status      text not null default 'nao_iniciada'
              check (status in ('nao_iniciada','em_desenvolvimento','concluida')),
  attachment  jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- Índices úteis para os calendários/relatórios
create index if not exists idx_transactions_date on public.transactions (date);
create index if not exists idx_demandas_date on public.demandas (date);

-- ---------- Segurança (RLS) ----------
-- Dados internos da empresa: qualquer usuário AUTENTICADO tem acesso total.
-- Visitantes anônimos não acessam nada.
alter table public.transactions enable row level security;
alter table public.demandas      enable row level security;
alter table public.settings      enable row level security;

drop policy if exists "auth full access" on public.transactions;
create policy "auth full access" on public.transactions
  for all to authenticated using (true) with check (true);

drop policy if exists "auth full access" on public.demandas;
create policy "auth full access" on public.demandas
  for all to authenticated using (true) with check (true);

drop policy if exists "auth full access" on public.settings;
create policy "auth full access" on public.settings
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Depois de rodar este SQL:
-- 1) Authentication > Users > Add user  (crie seu login: e-mail + senha)
-- 2) No arquivo js/config.js, troque USE_SUPABASE para true
-- ============================================================
