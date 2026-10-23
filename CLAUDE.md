# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Koinos is a single-owner FII (Brazilian REIT) portfolio dashboard that replaced the owner's spreadsheet. UI copy, code comments and docs are Brazilian Portuguese. Commit messages are English Conventional Commits (`feat(scope): …`).

## Commands

- `npm run dev`: dev server on :3000.
- `npm run lint`: ESLint, including the feature-boundary rules (see Architecture).
- `npm run typecheck`: runs `next typegen` and then `tsc --noEmit`.
  - In a fresh checkout, a bare `tsc` fails on `PageProps`/`LayoutProps`, because those types are generated.
- `npm run build`: needs the server env vars. Without `.env.local`, use the dummy values in `.github/workflows/ci.yml`.
- `npm run format` / `npm run format:check`: Prettier, with the Tailwind plugin.
- `npm run import:b3` / `npm run import:planilha`: operator scripts for loading the B3 statements or the old spreadsheet. Users import B3 statements on the `/transacoes/importar` screen.

**Tests:** there is no test suite, by the owner's decision.

- Verify with `format:check`, `lint`, `typecheck` and `build`. CI runs the same checks on Node 24 and 26.
- Check behavior with throwaway scripts kept outside the repo:

  ```bash
  npx tsx --conditions=react-server --env-file=.env.local <script>
  ```

  The `react-server` condition is required because server modules import `server-only`.

**Database warning:** `MONGODB_URI` in `.env.local` points at the production database (`koinos`). Local dev and every script read and write real data, so use a separate database name for experiments.

## Architecture

**Layout:** a feature-module monolith.

- `src/features/{auth,transactions,market-data,strategy,portfolio,smart-buy}`.
- `src/shared`: `db`, `env`, `lib`, `ui`, `components`. `ui` is shadcn "base-nova" on Base UI, so components take a `render` prop instead of `asChild`.
- `src/app`: the `(app)` group (authenticated), `(public)/login`, and `api/{auth,cron/daily,tickers}`.

**Public entry points per feature.** `eslint.config.mjs` enforces these with `no-restricted-imports`:

- `index.ts`: pure domain, types and Zod schemas, safe on client and server.
- `ui.ts`: client components.
- `server.ts`: the server-only DAL. The owner always comes from the session.
- `actions.ts`: Server Actions.
- `repo.ts`: functions that take an explicit `portfolioId`. Only for `scripts/`; lint forbids it in `src/`.

**Import rules:**

- Inside a feature, imports are relative.
- `domain/` is pure TypeScript: no Next, React, database, env or I/O.
- `components/` may not import `server/` or db modules, not even types. Put DTO types that the UI needs in a pure module, as `transactions/import/b3/types.ts` does.

**Tenancy:**

- `Tenant` is a branded type that only `auth/server/session.ts` can create: `getTenant()` for rendering, `requireTenant()` for actions and routes.
- Every query filters by the tenant's `portfolioId`. Updates and deletes filter by `_id` and portfolio.
- DTOs sent to the client carry no internal ids.
- `src/proxy.ts` (Next 16's middleware) only does an optimistic cookie redirect. The real auth and allowlist check is in the DAL.

**Rendering:**

- `cacheComponents` and `partialPrefetching` are on. Pages render a static shell and stream session-dependent parts inside `<Suspense>`.
- `getCurrentUser` uses `'use cache: private'`.
- `getTenant` calls `connection()` before touching the database. Any new database path reached from rendering must go through `getTenant` or call `await connection()` first. Otherwise prerendering fails on the Mongo driver's internal `new Date()`.

**Mutations:**

- Server Actions use `authActionClient` (next-safe-action, `auth/server/action-client.ts`) with Zod input schemas.
- Throw `ActionError` for messages the user should see. Any other error becomes a generic message.
- Call `refresh()` from `next/cache` after writing.

**Data layer:**

- One `MongoClient`, shared by Better Auth (native driver) and Mongoose, lives in `shared/db/mongo.ts`.
- `sanitizeFilter` is on, so query operators written in code must be wrapped in `mongoose.trusted(...)`.
- Sessions and the rate limit live in Redis through Better Auth's `secondaryStorage`. Values are sealed with AES-256-GCM in `auth/server/session-storage.ts`.
- A distributed lock is in `shared/db/lock.ts`.
- `shared/env.ts` validates the server env with t3-env. There are no `NEXT_PUBLIC_` variables.

**Domain flow:**

1. The transaction ledger feeds `transactions/domain`: `replayLedger` computes positions, and `findOversells` makes the app reject any write that would let a sale exceed the position.
2. `portfolio/domain/snapshot.ts` (`buildSnapshot`) builds positions, allocation, alerts and the cascade input. It also adds the dividends received per FII and the adjusted results: "com proventos" (quote result + dividends) and "total" (+ realized sales).
3. `smart-buy/domain/suno-cascade.ts` turns that into the buy recommendations. Dividends never reach the cascade input.
4. `portfolio/domain/dividends.ts` is pure and feeds `/proventos` (`portfolio/server/dividends-view.ts`):
   - "a receber": Yahoo announcements × the shares held on the day before the ex-date, until a B3 dividend paid on or after the ex-date confirms it;
   - the month totals;
   - the groupings by month, year or FII.
5. `portfolio/domain/reinvestment.ts` is pure and feeds `/proventos/reinvestimento?mes=AAAA-MM` (`portfolio/server/reinvestment-view.ts`):
   - each month's cash purchases (negócios and subscrições, with fees) are split into money from dividends and money from the pocket;
   - the % reinvested is saved per month in `reinvestments` (`setReinvestmentPercentAction`), and a month without one uses 100%;
   - the stored % has one decimal (`roundPercent`), and the preview uses the same rounding.

**Market data** (`market-data`):

- Quotes come from brapi first, with Yahoo as the fallback. Pages refresh stale quotes in the background.
- The daily Vercel cron (`/api/cron/daily`, bearer `CRON_SECRET`, see `vercel.json`) refreshes closes, dividends, monthly history and the ticker catalog.
- `refreshDividends` keeps the last 90 days of Yahoo dividend announcements on each asset (`dividendAnnouncements`), with the ex-date normalized to the São Paulo trade date at UTC midnight. It skips assets fetched in the last 20 h.
- The brapi free plan has no dividends, and Yahoo has no FII dividends between 2018 and early 2022.

**B3 statements import:**

- The parsing and the plan are pure: `transactions/import/b3`, with `detectB3File`, the two readers and `planB3Import`.
- The service is `transactions/server/b3-import.ts`. It validates the upload in memory, takes a per-portfolio lock, writes in one Mongo transaction and compares old and new entries, so re-uploading the same files changes nothing.
- The screen and `scripts/import-b3.ts` share the same plan.
- "A B3 manda": inside the statements' period, FII entries are replaced by B3's, and B3-sourced entries are locked in the Transações UI.
- **Dividends:**
  - The plan also extracts the Rendimento and Reembolso credits of FIIs from the Movimentação statement into the `dividends` collection (`transactions/server/dividend.model.ts`). Stocks' dividends, JCP and lending fees stay out.
  - Inside the Movimentação period they are replaced FII by FII. The scope is the FIIs with status OK plus the FIIs that only appear through dividend rows; FORA, PENDENTE and excluded FIIs keep what they have.
  - The write happens in the same transaction as the ledger, and a category with no changes is not rewritten.
- **Re-upload with the spreadsheet:** subscription prices that came from the user's spreadsheet (`PLANILHA`) are not stored as answers. Re-uploading without the spreadsheet brings them back as open pendências.

## Product rules

- **Suno method:** recommendation logic follows it as implemented in `suno-cascade.ts`.
  - Only buy below the ceiling price, filling assets in ranking order up to the suggested %.
  - Rebalance only through new money, never by selling. Leftover cash goes to the least-represented asset.
  - No FII takes more than a share of one aporte (the "entrada gradual" cap, 50% by default).
  - Don't bring back the old spreadsheet's IPA formula.
- **No B3 calls:** don't call B3 systems or endpoints. B3 offers integrations only to companies, so B3 data enters only through statements the user uploads. A P/VP feature built on B3 lookups was dropped. Its spec and plan are marked discarded.
- **Dividends start at the first B3 statement (Nov 2019).** The owner decided not to estimate older ones: before that, the app only knows the prior positions of 2019-11-07, without purchase dates.
- **Read the spec first:** design specs and implementation plans per feature are in `docs/superpowers/specs` and `docs/superpowers/plans`. Read the relevant spec before changing behavior.

## Gotchas

- **Materials:** the visual materials are Tailwind 4 `@utility` rules in `src/app/globals.css` (`glass-strong`, `card-surface`, `metal-ring`, `btn-gloss`, `tile`…). Composite materials stack through CSS variables (`--glow-layer`, `--card-texture`, `--card-fill`), not competing classes.
- **`backdrop-filter`:** write only the unprefixed property. If `-webkit-backdrop-filter` is also written, Lightning CSS keeps only the prefixed one, which Chrome and Edge ignore.
- **`cn`:** the `cn` package is tailwind-merge compatible, so a later class overrides a conflicting one.
- **`next.config.ts`:**
  - `turbopackFileSystemCacheForBuild` is off on purpose: Vercel's restored build cache shipped stale CSS.
  - `serverActions.bodySizeLimit` is `4mb`, for the statement uploads; Vercel caps a request at 4.5 MB.
- **Deploy:**
  - Only `main` deploys (`vercel.json`), to region `gru1`. Functions run on Node 24 at Vercel; local dev uses Node 26 (`.nvmrc`).
  - Workflow: work on a branch, fast-forward `main`, push. Every push to `main` goes to production.
  - The production domain must match `BETTER_AUTH_URL`. Pages opened on other `*.vercel.app` hosts redirect there; `/api` is exempt so the cron works.
