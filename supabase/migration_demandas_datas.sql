-- ============================================================
-- Migração: demandas passam a ter DATA DE INÍCIO e DATA FINAL
-- Rode UMA vez no Supabase (SQL Editor) se o projeto já existia
-- com a coluna antiga `date`. Fresh installs já usam o schema novo.
-- ============================================================

-- 1) Novas colunas
alter table public.demandas add column if not exists date_start date;
alter table public.demandas add column if not exists date_end date;

-- 2) Backfill a partir da coluna antiga (se existir)
update public.demandas set date_start = date where date_start is null;
update public.demandas set date_end = coalesce(date_end, date_start) where date_end is null;

-- 3) A coluna antiga deixa de ser obrigatória (mantida por compatibilidade)
alter table public.demandas alter column date drop not null;

-- 4) date_start passa a ser obrigatória
alter table public.demandas alter column date_start set not null;

-- (opcional) índice por data de início
create index if not exists idx_demandas_date on public.demandas (date_start);
