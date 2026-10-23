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
- `npm run import:b3` / `npm run import:planilha`: operator scripts for loading the B3 statements or the old spreadsheet. Users update from B3 on the `/atualizacao-b3` page, with the three statements (`/transacoes/importar` redirects there from `next.config.ts`).
  - `import:b3` also writes the dividends. Run it with `--dry-run` first.
  - `--alvo` overwrites the Carteira Alvo with the spreadsheet's rank and ceiling. Only pass it when the owner asks.

**Tests:** there is no test suite, by the owner's decision.

- Verify with `format:check`, `lint`, `typecheck` and `build`. CI runs the same checks on Node 24 and 26.
- Check behavior with throwaway scripts kept outside the repo:

  ```bash
  npx tsx --conditions=react-server --env-file=.env.local <script>
  ```

  The `react-server` condition is required because server modules import `server-only`.

  - **`@/` aliases:** a script outside the repo can't resolve them. Import the repo's `src` through absolute `file://` URLs, or copy the script into the repo root just to run it and delete it afterwards. Never commit it.
  - **Session DAL:** modules that reach it (the `server.ts` entry points, through `next/navigation`) don't run under tsx. Import the repository modules instead (`repo.ts`, `server/*-repo.ts`).

**Database warning:** `MONGODB_URI` in `.env.local` points at the production database (`koinos`). Local dev and every script read and write real data, so use a separate database name for experiments.

## Architecture

**Layout:** a feature-module monolith.

- `src/features/{auth,transactions,market-data,strategy,portfolio,smart-buy}`.
- `src/shared`: `db`, `env`, `lib`, `ui`, `components`. `ui` is shadcn "base-nova" on Base UI, so components take a `render` prop instead of `asChild`.
- `src/app`: the `(app)` group (authenticated), `(public)/login`, and `api/{auth,cron/daily,tickers}`.

**Pages** (`src/app/(app)`): each one renders a static header and streams a `<Suspense>` section that awaits a DAL view from `portfolio/server.ts` or `transactions/server.ts`.

- `/dashboard`: `getPortfolioSnapshot` (summary, alerts, monthly aportes, allocation, positions and the closed card), plus `getEvolution` in its own `<Suspense>` (Domain flow, item 7).
- `/transacoes`: `getMyTransactions`, with filters, pagination and the create, edit and delete actions.
- `/encerradas`: `getClosedPositionsView` (item 6): cost, proceeds and result per closed FII. Its subpage `/encerradas/ir` shows the estimated tax from the same view, and the sidebar lists it as a sub-item. The Dashboard's closed card links here, and `/dashboard/encerradas` redirects here from `next.config.ts`.
- `/proventos`: `getDividendsView` (item 4). Its subpage `/proventos/reinvestimento?mes=AAAA-MM` uses `getReinvestmentView` (item 5), and the sidebar lists it as a sub-item, like the IR under `/encerradas`.
- `/atualizacao-b3`: the client `B3ImportWizard`, which calls the preview and confirm actions (see B3 update).
- `/carteira-alvo`: the snapshot's strategy rows, edited in the table through `strategy/actions.ts`.
- `/recomendacoes`: the snapshot's `cascadeInput`. The cascade runs in the browser (`AporteCalculator`), with the amount and the cap in the URL (`?valor=&limite=`).
- **A new top-level page** also needs a `proxy.ts` matcher entry (see Tenancy) and an item in the sidebar (`shared/components/app-sidebar.tsx`). Subpages need neither: the matcher's `:path*` covers them, and the sidebar highlights the parent by prefix. A subpage that should appear in the menu goes in the item's `children`, with its own icon, and its page header keeps a button back to the parent.

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
  - `/login` with a valid session redirects to `/dashboard` (`redirectIfSignedIn`). It checks the real session, not the cookie, so an expired cookie doesn't loop between the two.
  - Its `matcher` lists each top-level `(app)` route as `/<route>/:path*`, which also covers its subpages. Add every new top-level route there, or the page renders its shell without a session before the DAL redirects.

**Rendering:**

- `cacheComponents` and `partialPrefetching` are on. Pages render a static shell and stream session-dependent parts inside `<Suspense>`.
- `getCurrentUser` uses `'use cache: private'`.
- `getTenant` calls `connection()` before touching the database. Any new database path reached from rendering must go through `getTenant` or call `await connection()` first. Otherwise prerendering fails on the Mongo driver's internal `new Date()`.
- The DAL readers (`getMyTransactions`, `getMyDividends`, `getPortfolioSnapshot`…) are wrapped in React `cache`, so several `<Suspense>` sections of one page can call them and each query runs once per request.
- Client state that should survive a reload or a shared link lives in the URL through `nuqs`: the tables' filters, page and sort (`shared/hooks/use-sort-state.ts`), the dividends grouping and month (`?agrupar=&mes=`), and the aporte amount and cap. The reinvestment month uses `shallow: false`, because the server reads it.

**Mutations:**

- Server Actions use `authActionClient` (next-safe-action, `auth/server/action-client.ts`) with Zod input schemas.
- Throw `ActionError` for messages the user should see. Any other error becomes a generic message.
- Call `refresh()` from `next/cache` after writing.

**Data layer:**

- One `MongoClient`, shared by Better Auth (native driver) and Mongoose, lives in `shared/db/mongo.ts`.
- `sanitizeFilter` is on, so query operators written in code must be wrapped in `mongoose.trusted(...)`.
- Sessions and the rate limit live in Redis through Better Auth's `secondaryStorage`. Values are sealed with AES-256-GCM in `auth/server/session-storage.ts`.
- **Session lifetime:** a session expires after 1 h without use (`expiresIn` 1 h, `updateAge` 5 min).
  - Server Components can't set cookies.
  - So `SessionKeepAlive` (`auth/components/session-keep-alive.tsx`) asks `/api/auth` for the session on real interaction, at most every 5 min, and that renews the cookie.
- A distributed lock is in `shared/db/lock.ts`.
- `shared/env.ts` validates the server env with t3-env. There are no `NEXT_PUBLIC_` variables.
- `ALLOWED_EMAILS` is optional.
  - Locally it restricts who can sign in.
  - In production it stays empty: access is controlled by the Google OAuth app's test users, and Google must report the e-mail as verified.

**Domain flow:**

1. The transaction ledger feeds `transactions/domain`: `replayLedger` computes positions and lists each sale with its cost at the average price (`sales`), and `findOversells` makes the app reject any write that would let a sale exceed the position.
   - The ledger only knows BUY and SELL. `kind` says where an entry came from: a subscrição is a buy, a desdobro is a buy at price 0, a posição anterior is a buy for what was held before the first statement, a leilão de fração is a sale, and an incorporation is a sale of the origin plus a buy of the destination at the same cost (`relatedTicker` names the other side). An entry without `kind` counts as a negócio.
   - Each view picks its kinds: the Dashboard's monthly aportes skip the incorporation buy, reinvestment counts only negócios and subscrições, and closed positions skip the incorporation sale.
2. `portfolio/domain/snapshot.ts` (`buildSnapshot`) builds positions, allocation, alerts and the cascade input. It also adds the dividends received per FII and the adjusted results: "com proventos" (quote result + dividends) and "total" (+ realized sales).
3. `smart-buy/domain/suno-cascade.ts` turns that into the buy recommendations. Dividends never reach the cascade input.
4. `portfolio/domain/dividends.ts` is pure and feeds `/proventos` (`portfolio/server/dividends-view.ts`):
   - "a receber": the B3 snapshot from the Eventos statement (`dividend_forecasts`), with the official pay date and source "B3";
   - plus Yahoo announcements × the shares held on the day before the ex-date, until a B3 dividend paid on or after the ex-date confirms it. With a snapshot, only announcements with an ex-date after its `asOf` count, as "estimado";
   - the month totals: B3 items count only when they pay in the current month;
   - the groupings by month (a year × month matrix: clicking a month lists its FIIs), year or FII.
5. `portfolio/domain/reinvestment.ts` is pure and feeds `/proventos/reinvestimento?mes=AAAA-MM` (`portfolio/server/reinvestment-view.ts`):
   - each month's cash purchases (negócios and subscrições, with fees) are split into money from dividends and money from the pocket;
   - the % reinvested is saved per month in `reinvestments` (`setReinvestmentPercentAction`), and a month without one uses 100%;
   - the stored % has one decimal (`roundPercent`), and the preview uses the same rounding.
6. `portfolio/domain/closed-positions.ts` is pure and feeds `/encerradas` and `/encerradas/ir` (`portfolio/server/closed-positions-view.ts`) and the Dashboard's closed card:
   - a closed position is a FII with zero quantity today. It sums the real sales of every cycle (negócios and leilões de fração), each at its day's average price;
   - an incorporation's exit leg is not a sale: its cost moves to the destination, with no result;
   - the closing date is the day the position reached zero: the last sale or, when it zeroed the position, the incorporation;
   - the estimated tax is 20% of each position's profit (FII sales have no exemption) and zero on a loss. It's a per-position estimate, not the monthly apuração: it doesn't offset losses across positions or months and ignores the 0.005% IRRF;
   - a FII with an `ESTIMADO` buy price, directly or through an incorporation, is flagged, because its result is an estimate too. So the input entries carry `priceSource` and `relatedTicker` (`ClosedLedgerEntry`);
   - the Dashboard's card also lists the FIIs that only appear through dividends (no entries, `closedAt` null), so its dividends plus the positions table's add up to the summary's total.
7. `portfolio/domain/evolution.ts` (`computeEvolution`) feeds the Dashboard's evolution chart through `getEvolution`:
   - patrimony and invested at each month's end, from the first entry to the current month;
   - each month is priced at its monthly close (the current month at today's quote), or else at the last known close. A FII with no close at all uses its average price, and the month is flagged `estimated`;
   - `getEvolution` first fills the missing closes from Yahoo (`ensureMonthlyCloses`), once per month and ticker.

**Market data** (`market-data`):

- Quotes come from brapi first, with Yahoo as the fallback. Pages refresh stale quotes in the background: `QuoteRefresher` calls `refreshMyQuotesAction`, which also refreshes the held FIIs' dividends.
  - A quote goes stale after 30 min during the session (10:00 to 18:30 in São Paulo, counting brapi's delay). Outside it, the last close holds and no quota is spent. Holidays aren't handled (`market-data/domain/market-hours.ts`).
  - brapi requests are counted per month in Mongo (`server/usage.ts`). Above 90% of `BRAPI_MONTHLY_QUOTA`, only Yahoo is used until the month turns.
- The daily Vercel cron (`/api/cron/daily`, bearer `CRON_SECRET`, see `vercel.json`) refreshes closes, dividends, monthly history and the ticker catalog.
- `refreshDividends` keeps the last 90 days of Yahoo dividend announcements on each asset (`dividendAnnouncements`), with the ex-date normalized to the São Paulo trade date at UTC midnight. It skips assets fetched in the last 20 h.
- The brapi free plan has no dividends, and Yahoo has no FII dividends between 2018 and early 2022. Yahoo also has no monthly history for delisted FIIs (MALL11, IRDM11), so the evolution chart estimates those months.

**B3 update (`/atualizacao-b3`):**

- The parsing and the plan are pure: `transactions/import/b3`, with `detectB3File`, the three readers (Negociação, Movimentação, Eventos) and `planB3Import`.
- The diff is pure too: `import/b3/changes.ts` (`diffLedger`, `diffDividends`, `sameForecast`).
  - A stored B3 entry equal to a planned one stays, with the same `_id`. Repeats count, as a multiset.
  - The rest of what the plan replaces is deleted by id, and the rest of the plan is inserted.
  - For the preview, each deleted row is paired with the first inserted row of the same FII, type and date.
- The service is `transactions/server/b3-import.ts`.
  - It requires exactly the three statements and refuses the spreadsheet.
  - It validates the upload in memory, takes a per-portfolio lock and writes only the difference in one Mongo transaction (`applyB3Update` in `transaction-repo.ts`).
  - Re-uploading the same files writes nothing, and the preview says "Nada novo".
- `scripts/import-b3.ts` shares the plan but still takes Negociação and Movimentação (plus the optional spreadsheet). It writes through `applyTransactionChanges`, which swaps the whole period.
- "A B3 manda": inside the statements' period, FII entries are replaced by B3's, and B3-sourced entries are locked in the Transações UI.
- **A receber:** the Eventos statement's FII "Rendimento" and "Reembolso - Rendimento" rows become the snapshot in `dividend_forecasts` (one document per portfolio, `asOf` = upload day).
  - Every write replaces the whole snapshot.
  - Only a change in the items counts as new, not a later `asOf`.
  - An item whose quantity differs from the position is only a warning.
- **Dividends:**
  - The plan also extracts the Rendimento and Reembolso credits of FIIs from the Movimentação statement into the `dividends` collection (`transactions/server/dividend.model.ts`). Stocks' dividends, JCP and lending fees stay out.
  - Inside the Movimentação period they are replaced FII by FII. The scope is the FIIs with status OK plus the FIIs that only appear through dividend rows; FORA, PENDENTE and excluded FIIs keep what they have.
  - The write happens in the same transaction as the ledger, and only the difference is written.
- **Subscription prices:** a stored subscription with `priceSource` PLANILHA counts as a previous answer, like USUARIO and ESTIMADO. So uploading the full history without the spreadsheet opens no pendências.

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
- **Contrast:** at `size="sm"`, the `btn-gloss` label sits under the top sheen and falls to about 3.3:1 in the light theme.
  - A selected segment uses solid `bg-(--badge)` with white text instead.
  - The AA text colors are `text-gain`, `text-loss` and `text-muted-foreground`.
  - `variant="link"` (`text-primary`) measured 3.9:1 on a card, so buttons that navigate use `variant="outline"`.
  - Native `<select>` fields have a translucent background, and the system draws their open list. So `globals.css` gives `option` a solid `--card` background and `--foreground` text; without it, the dark theme showed light text on a light list.
- **Container queries:** layouts that depend on the content width (sidebar open or closed) use `@container` with `@min-[Npx]:` steps, in px only. Tailwind emits px container sizes before the named rem ones (`@md`, `@3xl`…), so mixing the two lets the named ones win.
  - Wide tables scroll inside their card (`shared/ui/table.tsx` wraps them in `overflow-x-auto`, and `SidebarInset` has `min-w-0`). The closed-positions and IR tables instead add columns at container steps (480 to 840 px), so it fits a phone without scrolling sideways.
- **Charts:** Recharts, through `shared/ui/chart.tsx`.
  - Series colors come from the `--chart-*` tokens: aportes and bolso use `--chart-1` (blue), proventos use `--chart-2` (orange).
  - Two or more series get a legend.
- **Base UI `Button` as a link:** `render={<Link />}` needs `nativeButton={false}`. Without it, Base UI logs an error and puts `type="button"` on the `<a>`.
- **`cn`:** the `cn` package is tailwind-merge compatible, so a later class overrides a conflicting one.
- **`next.config.ts`:**
  - `turbopackFileSystemCacheForBuild` is off on purpose: Vercel's restored build cache shipped stale CSS.
  - `serverActions.bodySizeLimit` is `4mb`, for the statement uploads; Vercel caps a request at 4.5 MB.
- **Deploy:**
  - Only `main` deploys (`vercel.json`), to region `gru1`. Functions run on Node 24 at Vercel; local dev uses Node 26 (`.nvmrc`).
  - Workflow: work on a branch, fast-forward `main`, push. Every push to `main` goes to production.
  - The production domain must match `BETTER_AUTH_URL`. Pages opened on other `*.vercel.app` hosts redirect there; `/api` is exempt so the cron works.
