# Nexos Finance

Painel interno e privado da Nexos para controle financeiro (entradas/saídas e despesas recorrentes), gestão de demandas, relatórios de rendimento em tempo real e geração de contratos.

## Stack

- Frontend em HTML + CSS + JavaScript puro (ES modules), sem build.
- Backend: **Supabase** (PostgreSQL + Auth + RLS). Fallback local em `localStorage`.
- Gráficos via Chart.js (CDN). Exportações em PDF (jsPDF) e Word.
- Deploy estático no **Netlify**.

## Rodar localmente

Por usar ES modules, sirva via HTTP:

```bash
npx serve .
# ou
python -m http.server 3000
```

Crie o arquivo de configuração local a partir do modelo:

```bash
cp js/config.example.js js/config.js
# preencha SUPABASE_URL, SUPABASE_ANON_KEY e USE_SUPABASE
```

Sem Supabase configurado, o app funciona em modo local (login mock `admin` / `nexos2026`).

## Deploy no Netlify

O site é estático. O arquivo `js/config.js` é gerado no build a partir das variáveis de ambiente (nenhuma credencial fica no Git).

Defina em **Site settings > Environment variables**:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave `anon public` (segura no frontend, protegida por RLS) |
| `USE_SUPABASE` | `true` |

Build command: `node scripts/gen-config.js` · Publish directory: `.` (já em `netlify.toml`).

## Banco de dados

Rode `supabase/schema.sql` no SQL Editor do Supabase para criar as tabelas
(`transactions`, `demandas`, `settings`) com Row Level Security. Crie os usuários
em Authentication > Users.

## Estrutura

Veja `CLAUDE.md` para a documentação completa da arquitetura e convenções.
