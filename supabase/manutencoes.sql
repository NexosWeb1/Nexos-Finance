-- ============================================================
-- Nova tabela: MANUTENÇÕES (pagamentos recorrentes por projeto)
-- Rode UMA vez no Supabase (SQL Editor > New query > Run).
-- ============================================================

create table if not exists public.maintenances (
  id         uuid primary key default gen_random_uuid(),
  project    text not null,
  amount     integer not null,               -- valor em CENTAVOS
  frequency  text not null default 'mensal'
             check (frequency in ('semanal','mensal','anual')),
  date       date not null,                  -- data do primeiro pagamento
  attachment jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_maintenances_date on public.maintenances (date);

-- Segurança: só usuários autenticados acessam
alter table public.maintenances enable row level security;
drop policy if exists "auth full access" on public.maintenances;
create policy "auth full access" on public.maintenances
  for all to authenticated using (true) with check (true);
