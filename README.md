# Finance Hub — Gestão financeira familiar

Aplicativo de controle financeiro para o casal: login individual, núcleo financeiro compartilhado, separação entre
dinheiro **individual** e **do casal**, movimentações diárias, contas fixas, cartões, dívidas, metas, orçamentos,
calendário, notificações e relatórios semanais com análise calculada a partir dos dados reais.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · componentes no padrão shadcn/ui (Radix) · Lucide ·
Recharts · React Hook Form + Zod · Supabase (PostgreSQL, Auth, Storage, RLS) · Vercel (ou Render).

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Estrutura de pastas](#estrutura-de-pastas)
3. [Modelo de dados e regras financeiras](#modelo-de-dados-e-regras-financeiras)
4. [Rodando localmente](#rodando-localmente)
5. [Deploy na Vercel (recomendado)](#deploy-na-vercel)
6. [Deploy no Render (alternativa)](#deploy-no-render)
7. [Primeiro acesso do casal](#primeiro-acesso-do-casal)
8. [Testes](#testes)
9. [Segurança](#segurança)
10. [Notificações por e-mail/WhatsApp (futuro)](#notificações-por-e-mailwhatsapp)

---

## Arquitetura

```
Navegador (React, PWA)
   │  Server Components renderizam as páginas no servidor (dados nunca ficam expostos sem RLS)
   │  Server Actions validam tudo com Zod antes de gravar
   ▼
Next.js na Vercel/Render ──(sessão do usuário via cookie httpOnly)──▶ Supabase
                                                                       ├─ Auth (e-mail/senha, recuperação)
                                                                       ├─ PostgreSQL + RLS (regras de acesso no banco)
                                                                       ├─ Funções SQL atômicas (cartão, faturas, dívidas, recorrências)
                                                                       └─ Storage (avatares e comprovantes)
```

* **Toda leitura e escrita usa a sessão do usuário** (chave anônima + JWT). Não há `service_role` no app.
* **As permissões estão no banco** (RLS em todas as tabelas). Mesmo que alguém chame a API direto, só vê/grava os
  dados do próprio núcleo familiar, e itens `privados` só aparecem para o responsável.
* **Operações com várias etapas** (compra parcelada no cartão, pagar fatura, pagar conta fixa, amortizar dívida,
  estornar) são funções PL/pgSQL — rodam em uma única transação.
* **Perspectiva financeira** (topo da tela): *Família* · *Do casal* · *Só eu* · *Só [parceiro(a)]*. Filtra dashboard,
  listas e relatórios para separar o dinheiro individual do compartilhado.

## Estrutura de pastas

```
supabase/
  config.toml                 configuração do Supabase local (CLI)
  migrations/                 schema, RLS, funções de negócio, demo e storage (rodar em ordem)
src/
  app/
    (auth)/                   login, cadastro (com código de convite), recuperação de senha
    (app)/                    área logada: layout com sidebar, navegação inferior e FAB
      page.tsx                Visão geral (dashboard)
      movimentacoes/          extrato com filtros, busca e CSV
      contas/                 contas e saldos, transferências, conciliação
      contas-fixas/           recorrências, pagar/adiar/alterar valor/pausar/cancelar, histórico
      cartoes/ + [id]/        cartões, faturas, limite, compras futuras, pagamento
      dividas/ + [id]/        dívidas, parcelas, amortização, simulação de quitação
      metas/                  metas financeiras e orçamentos por categoria
      calendario/             mês / semana / dia
      relatorios/             semanal, mensal, trimestral, anual, personalizado (CSV/PDF)
      notificacoes/           central de alertas
      configuracoes/          perfil, núcleo familiar, categorias, alertas, dados, segurança
    api/exportar/             exportação CSV completa
    auth/callback/            retorno dos links de e-mail
  components/                 ui (design system), shell, forms, charts e um diretório por módulo
  lib/
    actions/                  Server Actions (validação Zod + chamadas ao Supabase)
    data/                     consultas no servidor (contexto do usuário, dashboard)
    finance/                  regras puras e testadas: relatórios, insights, dívidas, metas, recorrência, cartões
    supabase/                 clientes (server, browser, middleware)
    money.ts / dates.ts       dinheiro em centavos, datas no fuso de Brasília
    validation.ts             schemas Zod compartilhados cliente/servidor
tests/                        testes de banco (PGlite + migrations reais) e de regras financeiras
```

## Modelo de dados e regras financeiras

Tabelas principais: `profiles`, `households`, `household_members`, `accounts`, `transactions`,
`transaction_categories`, `recurring_transactions`, `recurring_instances`, `debts`, `debt_installments`,
`credit_cards`, `credit_card_purchases`, `credit_card_installments`, `credit_card_invoices`, `budgets`,
`financial_goals`, `goal_contributions`, `transfers`, `notifications`, `attachments`, `audit_logs`.
Views: `v_card_invoices`, `v_debts`, `v_debt_installments` (com `security_invoker`, respeitam RLS).

Toda entidade financeira tem `household_id`, `owner_id` (responsável), `scope` (`individual`/`shared`) e
`visibility` (`household`/`private`). Chaves estrangeiras **compostas** (`household_id`, `id`) impedem, no banco,
que uma movimentação aponte para a conta/cartão/categoria de outra família.

| Regra | Como é garantida |
|---|---|
| Dinheiro sem erro de arredondamento | `numeric(14,2)` no banco; cálculos em centavos inteiros no TS |
| Compra no cartão conta como despesa **uma vez**, na data da compra | `register_card_purchase` cria 1 `transaction` (despesa, sem conta) + parcelas nas faturas |
| Pagamento de fatura **não** é despesa | tipo `invoice_payment`: sai da conta, nunca entra nos totais de despesa |
| Transferência não é receita/despesa | tabela `transfers` separada; só afeta saldos |
| Previsto x realizado | `status` `pending`/`paid`; saldos e relatórios usam apenas `paid` |
| Recorrências sem duplicar | `unique (recurring_id, original_due_date)`; adiar muda só `due_date` |
| Conta fixa paga uma única vez | índice único em `transactions.recurring_instance_id` |
| Parcelamento com centavos corretos | diferença vai para a 1ª parcela (mesma regra no SQL e no TS) |
| Valores pagos de faturas/parcelas | **derivados** das movimentações (nada duplicado); estornar reverte tudo |
| Estornos e correções | exclusão lógica (`deleted_at`) + `reverse_transaction`; compra no cartão não pode ter valor/data alterados |
| Histórico de alterações | triggers gravam `audit_logs` (antes/depois) das tabelas sensíveis |
| Saldos | `account_balances()` = saldo inicial + receitas − despesas − faturas ± ajustes ± transferências |

## Rodando localmente

Pré-requisitos: Node 20+, Docker (para o Supabase local) — ou um projeto Supabase na nuvem.

```bash
npm install
cp .env.example .env.local
```

**Opção A — Supabase local (Docker):**

```bash
npx supabase start
```

O comando aplica todas as migrations e mostra `API URL` e `anon key`. Coloque-os em `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).

**Opção B — Supabase na nuvem:** crie um projeto em [supabase.com](https://supabase.com) e aplique as migrations:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

(ou cole o conteúdo de cada arquivo de `supabase/migrations/`, em ordem, no SQL Editor).

Depois:

```bash
npm run dev
```

Abra http://localhost:3000.

## Deploy na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new) (framework detectado: Next.js).
2. Em **Settings › Environment Variables**, cadastre:
   * `NEXT_PUBLIC_SUPABASE_URL` — Project Settings › API › Project URL
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings › API › anon public
   * `NEXT_PUBLIC_SITE_URL` — a URL final do app (ex.: `https://financas.seudominio.com.br`)
3. No Supabase, em **Authentication › URL Configuration**:
   * *Site URL*: a mesma de `NEXT_PUBLIC_SITE_URL`
   * *Redirect URLs*: `https://SEU-DOMINIO/auth/callback` (e o domínio `*.vercel.app` se for usar)
4. Em **Authentication › Providers › Email**, deixe *Confirm email* ligado (recomendado) e defina a senha mínima em 8.
5. Deploy. Cada push na `main` publica automaticamente.

**Domínio personalizado:** Vercel › Project › Settings › Domains › adicione o domínio e crie o registro DNS indicado
(CNAME `cname.vercel-dns.com` para subdomínio, ou A `76.76.21.21` para domínio raiz). Atualize `NEXT_PUBLIC_SITE_URL`
e as URLs do Supabase para o novo domínio.

**E-mails de produção:** o SMTP padrão do Supabase tem limite baixo de envios. Para produção, configure um SMTP
próprio em Authentication › SMTP Settings (ex.: Resend, Brevo, Amazon SES).

## Deploy no Render

O arquivo `render.yaml` já descreve o serviço. No Render: **New › Blueprint**, selecione o repositório e preencha as
mesmas variáveis de ambiente. Diferenças em relação à Vercel:

* O build usa `NEXT_OUTPUT=standalone` e o start é `node .next/standalone/server.js` (definido no `render.yaml`).
* No plano gratuito o serviço "dorme" após inatividade (primeiro acesso demora ~30 s).
* Configure o domínio em Settings › Custom Domains e atualize as URLs no Supabase.

## Primeiro acesso do casal

1. A primeira pessoa cria a conta em `/cadastro` → um **núcleo familiar** é criado com categorias padrão.
2. Em **Configurações › Núcleo familiar**, copie o **link de convite** (ou o código).
3. A segunda pessoa cria a conta pelo link (ou informa o código) → entra no mesmo núcleo. Limite: 2 membros.
4. Para explorar antes de usar de verdade: **Configurações › Dados › Carregar dados de demonstração**. Os dados
   fictícios ficam marcados (`is_demo`) e saem com **Limpar dados de demonstração**, sem tocar nos dados reais.

## Testes

```bash
npm test          # 42 testes: banco (RLS, integridade, cartões, recorrências, dívidas, demo) + regras financeiras
npm run typecheck
npm run lint
```

Os testes de banco sobem um PostgreSQL em memória (PGlite) com um stub do schema `auth` do Supabase e aplicam as
migrations reais — cobrindo isolamento entre famílias, itens privados, FKs compostas, cartão sem duplicidade,
recorrências idempotentes, amortização/quitação e o ciclo carregar/limpar demonstração.

## Segurança

* RLS habilitado em **todas** as tabelas; acesso anônimo revogado.
* Rotas protegidas por middleware (`supabase.auth.getUser()` valida o token no servidor).
* Validação no servidor com Zod em todas as Server Actions; queries parametrizadas (sem SQL dinâmico com input).
* `service_role` nunca é usada pelo app nem exposta ao navegador.
* Cabeçalhos de segurança (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
* Anexos em bucket privado com URL assinada de 60 s; caminho prefixado pelo `household_id` e checado no Storage.
* Auditoria (`audit_logs`) de movimentações, transferências, contas, cartões, faturas, dívidas, recorrências e membros.
* Recuperação de senha com resposta idêntica para e-mails existentes ou não (evita enumeração).
* Dados de demonstração segregados por `is_demo`.

## Notificações por e-mail/WhatsApp

Os alertas são gerados pelo banco (`refresh_notifications`) com chave de deduplicação e preferências por pessoa.
A tabela `notifications` já tem `channel` e `delivered_at`. Para enviar por e-mail/WhatsApp:

1. Crie uma Supabase Edge Function (ou rota `/api/cron/notify` na Vercel com Vercel Cron) que leia notificações com
   `delivered_at is null` e envie via provedor (Resend para e-mail; Z-API, Twilio ou WhatsApp Cloud API).
2. Guarde as chaves do provedor como variáveis de ambiente **somente do servidor** e marque `delivered_at` após o envio.
3. Para gerar alertas mesmo sem ninguém abrir o app, agende `select sync_household(id, true) from households` com
   `pg_cron` no Supabase (Database › Extensions › pg_cron).
