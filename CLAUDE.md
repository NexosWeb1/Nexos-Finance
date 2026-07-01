# Dashboard Nexos Web

Painel interno e privado da Nexos para **controle financeiro** (entradas/saídas, incluindo despesas recorrentes), **gestão de demandas** e **relatórios de rendimento** em tempo real. Acesso protegido por login (dados sensíveis).

## Stack

- **Frontend:** HTML + CSS + JavaScript puro (ES modules). Sem build, sem framework.
- **Hospedagem:** Netlify (deploy estático da raiz).
- **Idioma:** Português (BR). Datas `DD/MM/AAAA`, moeda `R$`.
- **Persistência:** **Supabase (PostgreSQL)** quando `js/config.js` tem `USE_SUPABASE: true`; senão, `localStorage` (fallback). Ambos ficam isolados atrás de `js/store.js` — as telas não sabem qual está ativo. Cliente Supabase em `js/db.js`; esquema do banco em `supabase/schema.sql`.
- **Gráficos:** Chart.js via CDN.

## Estrutura

```
index.html        Tela de login
app.html          Shell do dashboard (sidebar + topbar + área de views)
netlify.toml      Config de deploy
css/
  tokens.css      Variáveis de marca (paleta Nexos dark/monocromática, tipografia, espaçamento)
  base.css        Reset + tipografia base
  components.css  Botões, cards, modais, forms, calendário, tabelas, badges, toasts
  layout.css      Sidebar, topbar, grid, responsividade
js/
  store.js        CRUD (localStorage hoje, API depois). Fonte única de verdade.
  auth.js         Login, sessão (sessionStorage), guarda de rota
  masks.js        Máscaras de data (DD/MM/AAAA) e moeda (R$)
  validation.js   Validação de campos obrigatórios
  ui.js           Toasts, helpers, formatação (fmtBRL, parseBRL, etc.)
  calendar.js     Componente de calendário reutilizável (cor por dia + clique no dia)
  modal.js        Card/modal de formulário reutilizável
  router.js       Roteamento por hash (#/financeiro, #/demandas, #/relatorios)
  finance.js      View Entradas & Saídas
  demandas.js     View Demandas
  reports.js      View Relatórios (mensal/anual + export PDF/DOCX)
img/              Logo Nexos + assets
```

## Marca

Logo: monograma "N" geométrico minimalista, **monocromático** (branco sobre carvão / preto sobre branco).
Tema do dashboard: **dark premium monocromático**. Acentos funcionais: **verde = entradas**, **vermelho = saídas**. Status de demanda: cinza (não iniciada), âmbar (em desenvolvimento), verde (concluída).
Todas as cores ficam em `css/tokens.css` como CSS custom properties — trocar a marca é alterar variáveis.

## Modelo de dados (store.js)

- **transactions**: `{ id, type: 'entrada'|'saida', title, description, date (ISO yyyy-mm-dd), amount (centavos), recurring: bool, recurringDay, attachment: {name,dataUrl}|null, createdAt }`
- **demandas**: `{ id, title, description, date, amount, status: 'nao_iniciada'|'em_desenvolvimento'|'concluida', attachment, createdAt }`

Valores monetários são guardados em **centavos (inteiro)** para evitar erro de ponto flutuante; a UI formata com `fmtBRL`.

## Login

- **Modo Supabase (`USE_SUPABASE: true`):** autenticação real por **e-mail + senha** via Supabase Auth. Usuários são criados em Authentication > Users no painel do Supabase. Guarda de rota assíncrona (`requireAuth`).
- **Modo local (fallback):** credenciais mock em `auth.js` (`admin` / `nexos2026`), sessão em `sessionStorage`.

**Credenciais Supabase:** ficam em `js/config.js` e `.env` (ambos no `.gitignore`). A `anon key` é pública por design (protegida por RLS). Modelos: `js/config.example.js` e `.env.example`.

**Atenção ao deploy (Netlify):** `js/config.js` está no `.gitignore`, então não sobe pelo Git. Para produção, garantir que o `config.js` exista no deploy (commit dedicado do arquivo de produção ou injeção via Netlify).

## Rodar localmente

Por usar ES modules, sirva via HTTP (não abra o arquivo direto):

```
npx serve .
# ou
netlify dev
```

Acesse `http://localhost:3000` (ou a porta indicada).

## Convenções

- Cada view exporta `mount(container)` e opcionalmente `unmount()`, chamadas pelo `router.js`.
- Toda escrita de dados passa por `store.js` e dispara o evento `store:changed` (re-render reativo dos relatórios e calendários).
- Sem dependências de build; libs externas só via CDN.
