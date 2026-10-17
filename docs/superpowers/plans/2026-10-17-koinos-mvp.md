# Koinos MVP: plano de implementação

> Executado nesta sessão, tarefa por tarefa, com commit a cada uma. Spec: `docs/superpowers/specs/2026-10-17-koinos-design.md`.
> Decisão do usuário: sem testes automatizados. Cada tarefa é verificada com `npm run lint`, `npm run typecheck` e `npm run build`, mais as conferências indicadas.

**Objetivo:** app web pessoal que substitui a planilha de FIIs: posições, cotações, dashboard e motor de aporte pelo método Suno.

**Arquitetura:** Next.js 16 (App Router, Cache Components) organizado como monólito modular por features (`src/features/*`) e `src/shared`, com Data Access Layer `server-only`, núcleo de regras puro em `domain/` e adaptadores de cotação (brapi, Yahoo) atrás de interfaces.

**Stack:** Next.js 16.4, React 19.3, TypeScript 6.0.3, Tailwind 4.3, shadcn/ui base-nova (Base UI), Mongoose 9 + MongoDB Atlas, Better Auth 1.7 (Google), next-safe-action 8, Zod 4, nuqs 2, TanStack Query 5, yahoo-finance2 4, read-excel-file 9.

---

## Tarefa 1: scaffold e ferramentas (feita, `a09d0a6`)

**Arquivos:** configuração na raiz e `src/shared/ui/*` (shadcn).
**Critérios:** lint, typecheck e build passam; `.env.local` fora do git.

## Tarefa 2: base compartilhada

**Objetivo:** variáveis de ambiente validadas, conexão com o Mongo e utilitários.
**Arquivos:**
- `src/shared/env.ts`: `@t3-oss/env-nextjs` com as variáveis da seção 15 do spec.
- `src/shared/db/mongo.ts`: um `MongoClient` em `globalThis`; o Mongoose reaproveita o mesmo client (`connection.setClient`); `sanitizeFilter` e `strictQuery` ligados.
- `src/shared/lib/format.ts`: R$, %, quantidade e datas em pt-BR.
- `src/shared/lib/time.ts`: fuso de São Paulo e chaves de mês `YYYY-MM`.
- `src/shared/lib/money.ts`: `round2`.
- `src/shared/lib/sort.ts`: ordenação genérica, com nulos no fim.

**Critérios:** typecheck passa; o client conecta no Atlas (`ping`).

## Tarefa 3: login e isolamento por usuário

**Objetivo:** Better Auth com Google, allowlist, carteira por usuário, DAL de sessão e proxy.
**Arquivos:**
- `src/features/auth/domain/allowlist.ts`
- `src/features/auth/server/portfolio.model.ts` e `portfolio-repo.ts`
- `src/features/auth/server/auth.ts`: Better Auth; hooks `user.create.before` (allowlist) e `user.create.after` (cria a carteira).
- `src/features/auth/server/session.ts`: `getCurrentUser` com `'use cache: private'` e `requireTenant`, sem cache, para actions e rotas.
- `src/features/auth/server/action-client.ts`: next-safe-action com middleware de sessão e erros genéricos.
- `src/features/auth/server.ts` e `index.ts`: APIs públicas.
- `src/app/api/auth/[...all]/route.ts`
- `src/proxy.ts`

**Critérios:**
- sem cookie, `/dashboard` redireciona para `/login`;
- e-mail fora da lista não cria conta;
- toda função de dados recebe o tenant da sessão.

## Tarefa 4: estrutura da aplicação e login

**Arquivos:**
- `src/app/layout.tsx` (pt-BR e providers);
- `src/shared/components/*` (providers, tema, sidebar, cabeçalho);
- `src/features/auth/components/*` (botão Google, menu do usuário);
- `src/app/(public)/login/page.tsx`;
- `src/app/(app)/layout.tsx`;
- as páginas das 4 rotas;
- `src/app/page.tsx` (redireciona), `error.tsx` e `not-found.tsx`.

**Critérios:** build passa sem acesso a cookies fora de `<Suspense>`; `/login` responde 200.

## Tarefa 5: lançamentos (núcleo)

**Arquivos:**
- `src/features/transactions/domain/positions.ts`: preço médio pelo método da Receita e `findOversells`.
- `src/features/transactions/domain/contributions.ts`
- `src/features/transactions/server/transaction.model.ts`, `transaction-repo.ts` e `transactions-dal.ts`
- `src/features/transactions/schemas.ts` e `actions.ts`: criar, editar e excluir, sempre com validação do histórico.

**Critérios:**
- editar ou excluir usa o filtro `{ _id, portfolioId }`;
- uma venda maior que a posição é rejeitada com a mensagem do spec;
- conferência: o preço médio bate com o replay em Python da planilha.

## Tarefa 6: dados de mercado

**Arquivos:**
- `src/features/market-data/domain/market-hours.ts`
- `ports.ts` e `adapters/brapi.ts`, `adapters/yahoo.ts`
- `server/*.model.ts`: asset, price-history, api-usage, lock e ticker-catalog
- `server/lock.ts` e `server/usage.ts`
- `server/quote-service.ts`, `server/history-service.ts`, `server/catalog.ts` e `server/daily-job.ts`
- `actions.ts`: atualizar cotações
- `components/quote-refresher.tsx`
- `src/app/api/tickers/route.ts` e `src/app/api/cron/daily/route.ts`
- `vercel.json`

**Critérios:**
- uma atualização de fundos gasta 1 requisição da brapi;
- o cron exige `CRON_SECRET` e responde só contagens;
- a busca de tickers exige sessão.

## Tarefa 7: estratégia e motor Suno

**Arquivos:**
- `src/features/smart-buy/domain/suno-cascade.ts`: cascata e prioridade de aporte.
- `src/features/strategy/domain/weights.ts` e `ceiling.ts`
- `src/features/strategy/server/target-asset.model.ts`, `target-asset-repo.ts` e `strategy-dal.ts`
- `src/features/strategy/schemas.ts` e `actions.ts`

**Critérios:** conferência fora do repo, com o motor reproduzindo os exemplos A.1 e A.2 do spec exatamente.

## Tarefa 8: visão consolidada da carteira

**Arquivos:**
- `src/features/portfolio/domain/summary.ts`, `evolution.ts`, `alerts.ts` e `allocation.ts`
- `src/features/portfolio/server/snapshot.ts`: `getPortfolioSnapshot` e `getEvolution`, com DTOs sem ids internos.

**Critérios:** o DTO não contém `portfolioId` nem `userId`.

## Tarefa 9: dashboard

**Arquivos:** `src/features/portfolio/components/*` (cards, gráficos, tabela, alertas, encerradas) e `src/app/(app)/dashboard/page.tsx`.

## Tarefa 10: tela de transações

**Arquivos:** `src/features/transactions/components/*` (tabela com filtros, diálogo, exclusão) e `src/app/(app)/transacoes/page.tsx`.

## Tarefa 11: Carteira Alvo

**Arquivos:** `src/features/strategy/components/*` e `src/app/(app)/carteira-alvo/page.tsx`.

## Tarefa 12: Recomendações

**Arquivos:** `src/features/smart-buy/components/*` (calculadora, ordens, excluídos, princípios) e `src/app/(app)/recomendacoes/page.tsx`.

## Tarefa 13: importador da planilha

**Arquivos:** `src/features/transactions/import/parse-planilha.ts`, `src/features/transactions/import/select-valid.ts` e `scripts/import-planilha.ts`.

**Critérios:** `--dry-run` com a planilha real aceita 19 ativos e pula PMLL11, VISC11, XPML11, ALZR11 e IRIM11.

## Tarefa 14: documentação, CI e entrega

**Arquivos:** `README.md` (setup em pt-BR) e `.github/workflows/ci.yml`.

**Critérios:**
- lint, typecheck e build passam;
- `next start` responde 200 em `/login` e redireciona `/dashboard`;
- revisão de segurança;
- push da branch.
