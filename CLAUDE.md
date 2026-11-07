# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Koinos is a single-owner dashboard for a Brazilian portfolio of FIIs (REITs) and stocks that replaced the owner's spreadsheet. The Carteira Alvo and the aporte recommendations cover FIIs and stocks. UI copy, code comments and docs are Brazilian Portuguese. Commit messages are English Conventional Commits (`feat(scope): …`).

## Commands

- `npm run dev`: dev server on :3000.
- `npm run lint`: ESLint, including the feature-boundary rules (see Architecture).
- `npm run typecheck`: runs `next typegen` and then `tsc --noEmit`.
  - In a fresh checkout, a bare `tsc` fails on `PageProps`/`LayoutProps`, because those types are generated.
- `npm run build`: needs the server env vars. Without `.env.local`, use the dummy values in `.github/workflows/ci.yml`.
- `npm run format` / `npm run format:check`: Prettier, with the Tailwind plugin.
- `npm test`: Vitest (`vitest run`) over `src/**/*.test.ts`. One file: `npx vitest run src/features/smart-buy/domain/fii-cascade.test.ts`.
- `npm run import:b3` / `npm run import:planilha`: operator scripts for loading the B3 statements or the old spreadsheet. Users update from B3 on the `/atualizacao-b3` page, with the three statements (`/transacoes/importar` redirects there from `next.config.ts`).
  - `import:b3` also writes the dividends. Run it with `--dry-run` first.
  - `--alvo` overwrites the Carteira Alvo with the spreadsheet's rank and ceiling. Only pass it when the owner asks.

**Tests:** unit tests cover only pure code: the aportes (the rules that pick them, their inputs and their explanation; the owner asked for them on 2026-10-24, and before that there was no suite, by their decision) and, since 2026-10-30, the stock rules (asset class, lending, dividend kinds and the stock tax).

- They sit next to the code (`*.test.ts`, mostly in `domain/`), import from `vitest` explicitly and need no database. `vitest.config.mts` maps the `@/` alias.
- Covered:
  - `smart-buy/domain`: the 3.0 cascade with the owner's scenarios A, B and C, the tensors, the risk caps and buckets, the leftover, the Aguardar cases (out with its reason, no leftover share, value kept in the base, queue and Prioridade) and invariants over 500 seeded random portfolios. The 3.1 rules sit in their own describes in `fii-cascade.test.ts`: the 3.0 options giving the same result as no options, the suspension brake (46 days out, 44 in, 5 payments, 366 days, no history, the value kept in the base, `aportePriorities`) and the minimum per order (none below it in 500 portfolios, the cash going down the queue, the leftover opening an order only at the minimum, `ABAIXO_DO_MINIMO` against the caps' reasons, the 12.5% limit, zero without an aporte);
  - `smart-buy/domain/stock-buy.test.ts`: the stock smart buy (the owner's table: UNIP6 before VALE3, nothing above the ceiling or with Aguardar, no stock past its target, spent + leftover equal to the amount, the target as base × the weight received) and `stockPriorities` (the queue by margin of safety, ties by rank and ticker, and the reason of each stock that is out), plus the 3.0 options giving the same result as none and the 3.1 lot and leftover step (only multiples of 100, `MENOS_DE_UM_LOTE`, the leftover passing the target, the final cash under the cheapest lot, `fromLeftover`);
  - `smart-buy/domain/simulation.test.ts` and `smart-buy/domain/scorecard.test.ts`: `simulateAportes` and `randomPricePaths` (the same seed gives the same paths) and the lens scores of `scorecard` on short runs with known results, the stability with a fixed seed included, plus the income phase in the simulation (no income without a phase, only the retention invested in fruição, the 25% cap blocking a share, bought shares paying the next period, `otherIncome`);
  - `smart-buy/domain/income-phase.test.ts`: the fruição retention (25% default, 20% to 100% or `RangeError`, accumulation at 100%, cents with the retention rounded up, the parts adding up to the income);
  - the NTN-B rate rules (`market-data/domain/treasury-rates.test.ts`: the CSV parsing and its rejections, the October 2026 jumps kept, the mid rate, the median, the 60-trading-day summary and the 10-day staleness, the catalog's host check);
  - the dividend window and the stored last dividend (`market-data/domain/dividend-window.test.ts`: 12 payments in 13 ex-dates inside 365 days, 11 with a month missing, zero with a last payment over 365 days old, two payments in one month, the count, `nextLastDividend`);
  - `smart-buy/domain/merge-orders.test.ts`: the merged orders (total descending, ties by ticker, the class of each row);
  - the "Por quê" text, FIIs and stocks ("N lote(s) pela sobra" included), and the help text of each reason in "Fora deste aporte" (the three 3.1 ones included), picked by the classes in it: FII, stock or neutral (`smart-buy/components/aporte/explain.test.ts`);
  - `strategy/domain`: weights and the 0% quarantine rule;
  - the snapshot keeping the quarantine and the stocks out of the FII cascade, with each class's strategy adding up to 100% on its own (the stocks' % rescaled like the FIIs', with the warning and the alert in Geral), the bias reaching the cascade input and the rows, the stocks' Prioridade, `stockBuyInput`/`stockMeta`, and the 3.1 cascade input (`daysSinceLastDividend` null when the dividends are over 10 days old, the new fields reaching the cascade, the Prioridade by the current version) (`portfolio/domain/snapshot.test.ts`), and the strategy alerts by class (`portfolio/domain/alerts.test.ts`);
  - usebolsai's parsing (`market-data/domain/fundamentals.test.ts`);
  - the ceiling divergence rule (`strategy/domain/ceiling.test.ts`: tijolo and paper formulas, the exact 10% limit on both sides, every no-data case, `ceilingFromInput` for the typed ceiling and `ceilingCheckDetails`: the sign, the rows, the price against the calculated ceiling and the formula) and the snapshot carrying it to the strategy rows only (`portfolio/domain/snapshot.test.ts`: not outside the strategy, not without a rate, not with stale dividends, cascade and priorities unchanged);
  - the asset class (`market-data/domain/asset-class.test.ts`);
  - the B3 lending pairing and the shares that come back from lending (`transactions/import/b3/lending.test.ts`), and the dividend kinds and the check by dividends (`transactions/import/b3/dividends.test.ts`);
  - the estimated tax of closed positions: FIIs at 20%, stocks at 15% with the R$ 20,000 monthly exemption, and that FIIs plus Ações add up to Geral (`portfolio/domain/closed-positions.test.ts`);
  - the asset page (`portfolio/domain/asset-overview.test.ts`): the yield on cost and `dividendMonths` on `dividendPace`'s window (the bars add up to its total), the daily change, `priceSeries` ending at the quote and `pricePeriods`; plus `shared/lib/nice-scale.test.ts` (round axis steps) and `shared/lib/sparkline.test.ts`;
  - the market session (`market-data/domain/market-hours.test.ts`: open 10:00–18:00 on weekdays, the session of a quote on weekends and before the open, the "hoje"/"na sex., 06/11" label) and the day's movers (`portfolio/domain/day-movers.test.ts`: top 3 each side, flat ones out, ties by ticker);
  - the Geral/FIIs/Ações filter (`shared/lib/class-filter.test.ts`) and `scopeToClass` (`portfolio/domain/snapshot.test.ts`);
  - the Fundamentus page parser (`market-data/domain/fundamentus.test.ts`);
  - the Yahoo + Fundamentus dividend merge (`market-data/domain/dividend-merge.test.ts`);
  - the dividends by kind and the Fundamentus "a receber" (`portfolio/domain/dividends.test.ts`) and the reinvestment split by class (`portfolio/domain/reinvestment.test.ts`).
- Verify with `format:check`, `lint`, `typecheck`, `test` and `build`. CI runs the same checks on Node 24 and 26.
- Check behavior with throwaway scripts kept outside the repo:

  ```bash
  npx tsx --conditions=react-server --env-file=.env.local <script>
  ```

  The `react-server` condition is required because server modules import `server-only`.

  - **`@/` aliases:** a script outside the repo can't resolve them. Import the repo's `src` through absolute `file://` URLs, or copy the script into the repo root just to run it and delete it afterwards. Never commit it.
  - **Session DAL:** modules that reach it (the `server.ts` entry points, through `next/navigation`) don't run under tsx. Import the repository modules instead (`repo.ts`, `server/*-repo.ts`).
  - **The engines on the real portfolio:** `.claude/skills/conselho-investidores/scripts/lab.mts` rebuilds the snapshot read-only and runs both engines (`snapshot`, `recomendar`, `projetar`, `choque`, `mes`, `comparar --a 3.0 --b 3.1`, which puts the first aporte of two versions side by side with the lens scores, and `fruicao [--periodos 24] [--retencao 25] [--ipca 4.5]`, which lives off the dividends with no aporte, reinvesting the retention). `--versao 3.0|3.1` picks the version of the other commands (default `CURRENT_ENGINE`, the screen's). Prefer it to a new throwaway script. `tsconfig.json` includes `.claude/skills/**/*.mts`, because the default globs skip dot folders, so `typecheck` covers it.

**Database warning:** `MONGODB_URI` in `.env.local` points at the production database (`koinos`). Local dev and every script read and write real data, so use a separate database name for experiments.

## Architecture

**Layout:** a feature-module monolith.

- `src/features/{auth,transactions,market-data,strategy,portfolio,smart-buy}`.
- `src/shared`: `db`, `env`, `lib`, `ui`, `components`. `ui` is shadcn "base-nova" on Base UI, so components take a `render` prop instead of `asChild`.
- `src/app`: the `(app)` group (authenticated), `(public)/login`, and `api/{auth,cron/daily,cron/fundamentals,tickers,vitals}`.

**Pages** (`src/app/(app)`): each one renders a static header and streams a `<Suspense>` section that awaits a DAL view from `portfolio/server.ts` or `transactions/server.ts`.

- `/dashboard`: `getPortfolioSnapshot` (summary, alerts, monthly aportes, allocation, positions and the closed card), the day's movers (`DayMovers`: the top 3 gains and top 3 losses of the open positions by the session's %, `dayMovers` in `portfolio/domain/day-movers.ts`, with `MarketStatus`), plus `getEvolution` (Domain flow, item 7) and `getPeriodResults` (item 8), each in its own `<Suspense>`.
- **Class filter:** the Dashboard, `/proventos` (and its reinvestment subpage), `/encerradas` (and its IR) and `/transacoes` take `?classe=` (Geral, FIIs or Ações, default Geral) through `AssetClassControl` and `shared/lib/class-filter.ts`. Every view takes the filter and splits the ledger and the dividends by class before calling the pure code. Carteira Alvo (its own `?classe=` tabs) and Recomendações (FIIs by default, see below) use the same control for other purposes.
- `/transacoes`: `getMyTransactions`, with filters (the class one runs in the client, through `assetClass` in `TransactionRow`), pagination and the create, edit and delete actions.
- `/encerradas`: `getClosedPositionsView` (item 6): cost, proceeds and result per closed FII. Its subpage `/encerradas/ir` shows the estimated tax from the same view, and the sidebar lists it as a sub-item. The Dashboard's closed card links here, and `/dashboard/encerradas` redirects here from `next.config.ts`.
- `/proventos`: `getDividendsView` (item 4). Its subpage `/proventos/reinvestimento?mes=AAAA-MM` uses `getReinvestmentView` (item 5), and the sidebar lists it as a sub-item, like the IR under `/encerradas`.
- `/ativos` and `/ativos/[ticker]` (spec `2026-11-07-detalhes-do-ativo-design.md`, redesigned the same day after an Apple HIG review; read its "Análise e decisões" before changing the layout). Both show only what the app already stores and never fetch market data on demand.
  - `/ativos` is the search screen, as in Apple's Stocks: `AssetFinder` (`getAssetWatchlist`: the open positions by value, then the strategy assets without a position by rank) with a `SearchInput` whose term lives in `?q=`. Typing filters the owner's assets at once and then lists the B3 catalog through `useTickerSearch` (`market-data/ui`, `/api/tickers` 300 ms after the last key). Rows carry a grey `Sparkline` of the recent daily closes, the price and the day's `DeltaChip`.
  - `/ativos/[ticker]` (`getAssetOverview`): `AssetHeader` (the ticker is the `h1`, and the tab title through `generateMetadata`), then `AssetDetail`: the price card with the chart (`pricePeriods`: 1M daily, 6M/1A/5A/Tudo monthly, green or red by the period's change, the average price dashed, `?periodo=`) and the market numbers; `PositionCard` (or the closed result); `AporteCard` (the queue place or the reason it is out, with `reasonHelp`, and the price-against-ceiling bar); `DividendsCard` (upcoming first, the 12 closed months as bars with `dividendMonths`, the last 5 received); `OrdersCard` (the last 5, link to `/transacoes?ativo=`). From 1,000 px of content, position and aporte form a 360 px right column that is sticky on screens at least 880 px tall. A ticker out of the catalog and the ledger is a 404.
  - `generateStaticParams` returns HGLG11 only so the layout's `usePathname` prerenders; other tickers render on demand.
  - On phones, search is the tab-bar action (`AssetSearchAction`), and the nav bar's back button works on this detail page (`parentOf` maps paths under a menu item to it; back is `router.back()` after an in-app navigation, `shared/lib/in-app-navigation.ts`, else the parent). `usePageTitleUnderBar` waits for a streamed `h1[data-page-title]`.
  - Tickers in the positions table, the strategy table and the orders table link here through `AssetLabel`'s `href`.
- `/atualizacao-b3`: the client `B3ImportWizard`, which calls the preview and confirm actions (see B3 update).
- `/carteira-alvo`: the snapshot's strategy rows, one tab per class in `?classe=` (`fiis` by default, `acoes`), with `AssetClassControl includeAll={false}`. Both tabs have the same 12 columns: Ativo, Estratégia, Rank, Teto, % sugerida, Categoria, Viés, Preço atual, Margem, Peso/meta, Prioridade and remove.
  - Categoria is a select for FIIs and the read-only text "Ação" for stocks.
  - Viés (Comprar, Aguardar or empty) is in both, and Aguardar takes a FII or a stock out of the aporte.
  - Prioridade is the place in the aporte queue (the cascade for FIIs, `stockPriorities` for stocks, both with `CURRENT_ENGINE`'s options) or the reason the asset is out, the 3.1 ones included (`ABAIXO_DO_MINIMO` can't show, since the zero aporte has no minimum).
  - Edited in the table through `strategy/actions.ts`.
  - In both tabs the suggested % should add up to 100%: when they don't, a panel shows what is missing or over and the fix from `suggestPercentFix` (split the rest among the assets without %, or scale the existing ones), saved in one click by `setSuggestedPercentsAction` (one class at a time). The engines rescale the % to 100% anyway, so the panel only fixes the stored numbers.
- `/recomendacoes`: the snapshot's `cascadeInput` (FIIs), `stockBuyInput` and `stockMeta` (stocks) and `classValues`. The amount (`?valor=`) and the view are chosen at the screen: `AssetClassControl` (`shallow`, `defaultClass="fiis"`) picks FIIs (the default, the whole aporte to the FIIs), Ações (the whole aporte to the stocks) or Geral (`?classe=geral`), where a `Slider` (`shared/ui/slider.tsx`, 5% steps, starting at 50%) sets the FIIs % (`?fiis=`) and the stocks get the rest; no typing. `fiiCascade` and `stockSmartBuy` run in the browser (`AporteCalculator`), each portfolio with its own leftover; the summary cards show the sums. The risk caps are fixed, so an old link's `?limite=` is ignored.
  - One "Ordens de compra" table (a list on phones) holds the orders of the view's portfolios, with a FII/Ação badge when both are in it. In Geral, `mergeOrders` sorts them by total, largest first (ties by ticker). In FIIs and Ações, each engine's order stays (ranking; margin of safety). The card's description says which order it is and states the 3.1 rules of the view: "Nenhuma ordem de FII abaixo de R$ X (aporte ÷ N FIIs)" when the FIIs have a share (X is `CascadeResult.minimum`), and "Ações em lotes de 100" when the stocks do.
  - One "Fora deste aporte" card groups what got nothing by reason, FIIs and stocks together (`groupExcluded`). The help text of each reason speaks of the classes in it (`reasonHelp`), the three 3.1 reasons included (`ABAIXO_DO_MINIMO` and `PROVENTO_SUSPENSO` for FIIs, `MENOS_DE_UM_LOTE` for stocks).
  - `AporteCalculator` runs both engines with `ENGINE_VERSIONS[CURRENT_ENGINE]`, and the principles banner (`PrinciplesBanner`) ends with the discreet label "Koinos 3.1" (`CURRENT_ENGINE`).
  - There is no "Quanto vou aportar hoje?" card: the "Aporte" number card (first of the three, one card on phones) is the amount field itself (`MoneyInput`), with the FIIs/stocks split under it in Geral (`SplitControl`: a 44 px capsule in the Control Center style, blue #0066FF for FIIs and #CC4400 for stocks with white text, each end holding its name and % so they never hide; a round iOS 26 thumb that stretches into glass while dragging, follows the finger continuously and settles on the 5% step on release; below, the amounts and a `SegmentedControl` of presets 30/70, 50/50, 70/30 and Hoje, which can show no selection with `value={null}`). All the explanation sits in `HowItWorks` (`smart-buy/components/how-it-works.tsx`, static, at the end of the page, seven numbered collapsible steps in plain language). Change the rules in `domain/`, and this text with them.
- **A new top-level page** also needs a `proxy.ts` matcher entry (see Tenancy) and an entry in `shared/components/nav-items.ts`, which feeds the sidebar, the iPhone tab bar (only items with a `tab` label) and its "Mais" sheet (the rest). Subpages need neither: the matcher's `:path*` covers them, and the menus highlight the parent by prefix. A subpage that should appear in the menu goes in the item's `children`, with its own icon; its page header keeps a button back to the parent on desktop, and on phones the nav bar shows a back button (`parentOf`).

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
- Client state that should survive a reload or a shared link lives in the URL through `nuqs`: the tables' filters, page and sort (`shared/hooks/use-sort-state.ts`), the dividends grouping and month (`?agrupar=&mes=`), the class (`?classe=`), the dividend kind (`?tipo=`, `DividendKindSelect`) the aporte amount (`?valor=`) and the FIIs % (`?fiis=`). The reinvestment month uses `shallow: false`, because the server reads it.

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

**Asset class:** `assetClassOf` (`market-data/domain/asset-class.ts`, pure) says `FII` or `ACAO` from the brapi catalog: `stock` (stocks and units) is ACAO, and `fund` with `fii` or `fi-agro` is FII. Out of the catalog, `XXXX11` is a FII and 4 characters + 3 to 8 is a stock.

- Views get the classes from `getAssetClasses` (`market-data/server`, over the cached catalog) and pass a map into the pure code.
- Stocks have their own Carteira Alvo, with the same fields as the FIIs' (rank, ceiling, suggested %, bias, quarantine) and the category always Ação. The strategy rows, the alerts and the target-asset actions take them by class. Their buy input is `stockBuyInput`, and they have their own engine, `stockSmartBuy` (specs `2026-10-31-smart-buy-acoes-design.md` and `2026-10-31-tabelas-unificadas-design.md`).
- The `bias` (`COMPRAR`, `AGUARDAR` or null) is a field of both classes, and the target-asset actions accept it on either. `AGUARDAR` is what blocks: a FII or a stock with it gets no aporte (in the cascade's eligibility for a FII, in `stockSmartBuy` for a stock). `COMPRAR` and empty change nothing.

**Domain flow:**

1. The transaction ledger feeds `transactions/domain`: `replayLedger` computes positions and lists each sale with its cost at the average price (`sales`), and `findOversells` makes the app reject any write that would let a sale exceed the position.
   - The ledger only knows BUY and SELL. `kind` says where an entry came from: a subscrição is a buy, a desdobro is a buy at price 0, a bonificação is a buy at the cost the company assigns (answered in the preview, 0 allowed), a posição anterior is a buy for what was held before the first statement, a leilão de fração is a sale, and an incorporation is a sale of the origin plus a buy of the destination at the same cost (`relatedTicker` names the other side). An entry without `kind` counts as a negócio.
   - Each view picks its kinds: the Dashboard's monthly aportes skip the incorporation buy and the bonificação, reinvestment counts only negócios and subscrições, and closed positions skip the incorporation sale.
2. `portfolio/domain/snapshot.ts` (`buildSnapshot`) builds positions, allocation, alerts and the cascade input. It also adds the dividends received per FII and the adjusted results: "com proventos" (quote result + dividends) and "total" (+ realized sales). The Dashboard's top cards (`summary-cards.tsx`) each carry four detail rows, so they line up with no empty space:
   - `scopeToClass` (pure) narrows the input to one class and sets `view` before `buildSnapshot`. `strategyOf` builds one strategy per class, and `snapshot.strategy` is the view's class (in Geral, the FIIs'). Both classes rescale their suggested % to 100% with `effectiveWeights` (0% is quarantine, an empty % splits what is left) and warn when the sum isn't 100%. Each row's Prioridade comes from the cascade (FIIs) or `stockPriorities` (stocks).
   - The alerts split into the portfolio's (concentration, no quote) and each class's strategy alerts (`buildAlerts({ positions, strategies })`). In Geral, the stocks' alerts get the id suffix `-acoes` and " (ações)" in the title. The FIIs view has none from stocks.
   - the patrimony card adds the composition by category, a bar in the donut's colors (`category-colors.ts`);
   - the L/P card holds the results: return %, sales, "com proventos" and "total", whose sum opens in a popover (`ResultBreakdown`);
   - the dividends card shows `dividendPace`: the last 12 closed months' total and average, this year and last year;
   - the DY card shows the estimated monthly income, its change against the 12-month average (`incomeVsAverage`), the annual estimate and the yield on cost (`yieldOnCost`, annual estimate ÷ invested).
3. `smart-buy/domain/fii-cascade.ts` turns that into the buy recommendations, with the Koinos 3.0 engine (spec `2026-10-30-koinos-3-0-design.md`) and its 3.1 options (spec `2026-11-01-koinos-3-1-design.md`, below). The rules below are 3.0's unless a bullet says 3.1. The portfolio's dividends never reach the cascade input; only each FII's per-share history does, for the brake. The cascade input holds only FIIs, whatever the stock strategy has.
   - **Engine versions and options** (`smart-buy/domain/engine-options.ts`, pure, exported by `smart-buy/index.ts`):
     - `EngineOptions` has four keys, each rule of the 3.1 spec: `minOrder` (`none` or `fairShare`, FIIs), `suspensionBrake` (FIIs), `stockLot` (1 or 100) and `stockLeftover` (stocks).
     - `ENGINE_VERSIONS` names them: "3.0" is the behavior before 3.1 (`none`, off, lot 1, no leftover) and "3.1" is the new rules (`fairShare`, on, lot 100, leftover). `CURRENT_ENGINE` = "3.1" is what `/recomendacoes` and the Prioridade column (the snapshot) use. A new rule is a new key and a new version.
     - `options` is the last parameter of `fiiCascade`, `aportePriorities`, `stockSmartBuy` and `stockPriorities`, and the default is `ENGINE_VERSIONS["3.0"]`, so a call without it behaves as before (tests check it).
   - Only the strategy's FIIs enter it: one outside the strategy never receives and its value stays out of the targets, whatever its %. 0% (allowed only outside the strategy) marks it as quarantine.
   - Eligibility, in this order, and the first rule that fails gives the reason: no quote (`SEM_COTACAO`), no rank (`SEM_RANKING`), no ceiling (`SEM_TETO`), price at or above the ceiling (`ACIMA_DO_TETO`), bias Aguardar (`AGUARDAR`) and, in 3.1, a suspended dividend (`PROVENTO_SUSPENSO`). A FII that fails enters neither step, but its value stays in the strategy base. `CascadeAsset.bias` is optional: without it nothing changes.
   - The target is weight × (strategy value + aporte). A FII below it asks for the gap times four tensors (`smart-buy/domain/conviction.ts`), each at 1 without its input:
     - valuation, 1 + (1 − P/VP), never below 0;
     - dividends, min(1, the last dividend ÷ the 12-month monthly average): the brake for a cut;
     - safety, 1 + the margin to the ceiling;
     - vacancy, 1 − the physical vacancy, tijolo only.
   - The risk caps (`smart-buy/domain/risk.ts`, `RISK_CAPS`), as shares of the aporte: 25% per FII, 35% per sector and 60% per macro (Papel, Tijolo or Outros).
     - `classifyRisk` takes the macro from usebolsai's `fundType`: Híbrido goes by its composition, FoF goes to Outros, and without a type the Carteira Alvo category decides.
     - Only tijolo with a specific segment has a sector. "Multicategoria", "Outros" and "Híbrido" share no cap: they cover half the FIIs, papel included.
   - Step 1, in ranking order: each FII buys the smallest of its need, the room left in its three caps and the balance, in whole shares rounded down. In 3.0 there is no minimum order, not even 1 share; 3.1 adds the minimum below. `limitedBy` says what cut it.
   - Step 2, the leftover: one share at a time to the FII furthest below its target times its dividend and vacancy brakes (a tie goes to the better rank), within the caps, until no share fits.
   - **3.1, the FII minimum per order** (`minOrder: "fairShare"`): the minimum is the fair share, aporte ÷ the number of FIIs in the cascade input (the whole strategy, the ones out of this aporte included), capped at half the per-FII cap, 12.5% of the aporte (`CascadeResult.minimum`, zero without FIIs or aporte).
     - In step 1, an order that comes out below it is skipped and its cash goes down the queue.
     - In step 2, a FII that already has an order still gets one share at a time. One with no order opens one only with ⌈minimum ÷ price⌉ shares at once, within the caps and the balance.
     - Reason `ABAIXO_DO_MINIMO` when the FII's own request, in whole shares, is worth less than the minimum. When a cap or the balance cut it below the minimum, the cap's reason holds (`LIMITE_ATIVO`, `LIMITE_SETOR`, `LIMITE_MACRO`, `SEM_SALDO`). Order of the checks: `NA_META`, `PEDIDO_PEQUENO`, `ABAIXO_DO_MINIMO`, the caps and the balance.
     - `aportePriorities` runs with a zero aporte, so its minimum is zero and the Prioridade column doesn't change.
   - **3.1, the suspension brake** (`suspensionBrake`): the eligibility rule `PROVENTO_SUSPENSO` comes after `AGUARDAR`. A FII is suspended, from `CascadeAsset.daysSinceLastDividend` and `dividendPayments12m` (both optional, null or absent is neutral), when the days since its last ex-date are over 45 with 6 or more payments in the 12-month window (a regular payer that stopped), or over 365 days (known payments, none for a year). One that pays quarterly or half-yearly (under 6 payments) isn't suspended by the 45-day rule. Like a ceiling or Aguardar, it enters neither step and its value stays in the base. Stocks don't have it.
     - The snapshot fills `daysSinceLastDividend` (whole days since the last ex-date) only when the asset's dividends were refreshed within the last 10 days (`dividendsFetchedAt`); otherwise it is null, so a Yahoo outage suspends nobody.
   - **Two portfolios, split at the screen:** the owner picks the FIIs % of each aporte on `/recomendacoes` (`?fiis=`); the FIIs get that share through `fiiCascade` (above) and the stocks get the rest through `stockSmartBuy`. Each portfolio keeps its own leftover, with no change passed between them. With 100% the result is `fiiCascade` alone.
   - **Stock smart buy** (`smart-buy/domain/stock-buy.ts`, pure; the owner's "Smart Buy Ações" document): the base is the stocks' value (quantity × price) plus their part of the aporte, and each stock's target is base × its `weight`: the suggested %, rescaled to 100% like the FIIs' (`effectiveWeights`, in the snapshot). It buys only a stock with a price and a ceiling, price at or under the ceiling, value below its target and bias not Aguardar. Order by margin of safety (ceiling ÷ price − 1, ties by rank); each buys whole shares up to its target or the cash left, with no per-stock cap. No dividend brake and no tensors, in either version. `excluded` says why a stock got nothing. In 3.0 the leftover is the cash; in 3.1 it is what the leftover step below doesn't spend.
   - **3.1, stocks in lots of 100** (`stockLot: 100`, `StockBuyOrder.lot`): every order is a multiple of the lot, and FIIs stay in shares. Step 1, in the same order, buys min(⌊deficit ÷ (lot × price)⌋, ⌊cash ÷ (lot × price)⌋) lots. A deficit under one lot gives `MENOS_DE_UM_LOTE` (with lot 1 it stays `PEDIDO_PEQUENO`); an eligible stock with a deficit of one lot or more and no cash left is `SEM_SALDO`. The FII minimum per order doesn't apply to stocks.
   - **3.1, the stocks' leftover step** (`stockLeftover`): after step 1, one lot at a time goes to the buyable stock (price, ceiling, price at or under it, not Aguardar, weight above 0) with the lowest (value + bought × price) ÷ (base × weight), among those whose lot fits the cash and keeps the stock's total bought at no more than the larger of 25% of the stock part of the aporte (`STOCK_LEFTOVER_CAP`) and one lot of that stock (the owner's decision of 2026-11-01; only the leftover is capped, so a step-1 purchase stays as is and a stock already above it gets no leftover lot; what doesn't fit stays in cash) (a tie goes to the better rank, then the ticker). It may take a stock past its target, as the FIIs' leftover does, and a stock that was `NA_META` or `MENOS_DE_UM_LOTE` in step 1 can receive. `StockBuyOrder.fromLeftover` counts the shares that came from it; a stock that only received there becomes an order, and the final cash is below the cheapest lot among the buyable ones that still fit the limit. It replaces 3.0's "no leftover step": with lots of 100 and no leftover step, only 11% to 32% of the stocks' share would be invested.
   - `stockPriorities` gives the stocks their Prioridade, with a zero aporte and the same eligibility function as `stockSmartBuy`: the stocks that ask for at least one share (3.1: one lot) form the queue by margin of safety (ties by rank, then ticker), and the others show the reason (`SEM_COTACAO`, `SEM_TETO`, `ACIMA_DO_TETO`, `AGUARDAR`, `NA_META`, `PEDIDO_PEQUENO` or, in 3.1, `MENOS_DE_UM_LOTE`). It returns the cascade's `AportePriority` type, like `aportePriorities`.
   - `mergeOrders` (`smart-buy/domain/merge-orders.ts`, pure) joins the two portfolios' orders into one list of `{ kind: "FII" | "ACAO", order }`, by total descending (ties by ticker): the single orders table in Geral.
   - The "Por quê" comes from `smart-buy/components/aporte/explain.ts`: `shortReason` is the short gray line under each order (rank, distance to the target and the strongest signal), and `explain` is the full calculation, in the phone sheet and the table's tooltip. For stocks, `explainStock` and `shortStockReason` do the same, saying "N lote(s) pela sobra" when `fromLeftover` is above 0. `reasonHelp` picks the help text of an excluded reason by the classes in it (FII, stock or neutral).
   - **P/VP** comes from the asset's `priceToBook` (Market data, below). Without it, or with data older than 60 days, the valuation tensor stays at 1.
   - The last dividend and the 12-month sum come from Yahoo (`lastDividend`, `dividends12m`). They matched the B3 statements better than usebolsai's `dividend_yield_ttm`, which counts about one payment too many in half the FIIs, and the statements' own credits include pro rata subscription payments that would inflate the average. How they are stored (12 calendar months, `dividendPayments12m`, the fixed last dividend) is under Market data.
   - **`smart-buy/domain/simulation.ts` and `scorecard.ts`** (pure, for the lab and the version comparison): `simulateAportes(input, params)` runs the two real engines with a version's options for N aportes (amount, FIIs %, periods, options and an optional price generator), executing each order and summing the quantities. `randomPricePaths` draws seeded prices (a common plus an own factor, log-normal, with the P/VP moving along). `scorecard(runs)` turns the runs into the council's lens scores (Tiago Reis: % invested, stability, purchases outside the method, which must be zero; Baroni: deviation from the target, FIIs that got an order, tijolo and papel against the macro targets, orders per period; Buffett: money-weighted rank and the share spent on braked FIIs; Barsi: idle cash and lots of the stocks), averaged over the scenarios when prices are drawn. Spec §6.
   - **Fruição** (`smart-buy/domain/income-phase.ts`, pure; spec `2026-11-01-fruicao-design.md`): `IncomePhase` is `ACUMULACAO` (every dividend goes back in) or `FRUICAO` with a `retention` (default 25%, `DEFAULT_RETENTION`; from 20%, `MIN_RETENTION`, to 100%, else `fruition()` throws, so spending every dividend is barred). `splitIncome` splits a period's dividends into `reinvest` and `consume` in cents, rounding the retention up. The phase never reaches the engines: it only sets the aporte amount, so the retention goes through the ceiling, Aguardar, the brakes and the caps like any aporte. `simulateAportes` takes an optional `phase` (without it, dividends stay out, as before), `stockDividends` and `otherIncome` (the assets outside the strategies), and each period then carries `income`. There is no screen or setting yet: the owner is accumulating, and the monthly reinvested % already records it.
4. `portfolio/domain/dividends.ts` is pure and feeds `/proventos` (`portfolio/server/dividends-view.ts`):
   - "a receber": the B3 snapshot from the Eventos statement (`dividend_forecasts`), with the official pay date and source "B3". A snapshot item that matches a Fundamentus announcement (same asset, same kind or a B3 Reembolso, same pay date; one announcement per item) shows as "anunciado" with the announcement's com-date and B3's quantity and amount, and leaves the list when a B3 credit of the same kind within 5 days confirms it: only a paid dividend shows as B3, in the received ones (the owner's decision of 2026-11-07);
   - plus Yahoo announcements × the shares held on the day before the ex-date, until a B3 dividend paid on or after the ex-date confirms it. With a snapshot, only announcements with an ex-date after its `asOf` count, as "estimado";
   - plus the Fundamentus announcements with the company's pay date (`payDates` on the asset, FIIs and stocks, source "FUNDAMENTUS", shown as "anunciado"; spec `2026-11-06-fundamentus-pagamentos-design.md`): pay date from the 1st of the current month, com-date after the snapshot's `asOf` and not in it, shares at the end of the com-date, JCP at 85%, a FII rendimento with Yahoo's full-decimal value of the same event when within rounding, until a B3 credit of the same asset and kind (or Reembolso) within 5 days confirms it (one credit per announcement). An asset with `payDates` skips Yahoo;
   - the Yahoo estimate pays on the ex-date plus the fund's usual interval (`payLagDays`: the median of the days between each announcement's ex-date and the B3 credit that matches it, at least 2 matches, up to 45 days; else 15 days; spec `2026-11-06-intervalo-pagamento-design.md`). No API gives the payment date on a free plan (brapi and usebolsai dividends need paid plans, measured 2026-11-06), so Fundamentus (above) is the source and this estimate the fallback;
   - the month totals: B3 items count only when they pay in the current month;
   - "não divulgado" (`undisclosedDividends`): a held FII that was paid in each of the two previous months but has nothing this month (no receipt, no "a receber" item, no Yahoo ex-date in the month) is listed with last month's amount as a reference. It never enters the totals;
   - the groupings by month (a year × month matrix: clicking a month lists its FIIs), year or FII;
   - by kind: `DIVIDEND_KIND_LABELS` (transactions domain) names the kinds, the month summary and the year groups carry `byKind`, and `?tipo=` filters the rows (`getDividendsView(filter, kind)`).
   - stocks: their "a receber" comes from the B3 snapshot and Fundamentus. The Yahoo estimate and "não divulgado" are FII-only (`dividends-view.ts` filters their inputs).
5. `portfolio/domain/reinvestment.ts` is pure and feeds `/proventos/reinvestimento?mes=AAAA-MM` (`portfolio/server/reinvestment-view.ts`):
   - each month's cash purchases (negócios and subscrições, with fees) are split into money from dividends and money from the pocket;
   - the % reinvested is saved per month in `reinvestments` (`setReinvestmentPercentAction`), and a month without one uses 100%;
   - the stored % has one decimal (`roundPercent`), and the preview uses the same rounding;
   - by class: the calculation stays on the whole portfolio. `shareReinvestment` gives a class its own aporte and prorates the "from dividends" part by it; the unspent amount belongs to the portfolio and shows as zero in a class.
6. `portfolio/domain/closed-positions.ts` is pure and feeds `/encerradas` and `/encerradas/ir` (`portfolio/server/closed-positions-view.ts`) and the Dashboard's closed card:
   - a closed position is a FII with zero quantity today. It sums the real sales of every cycle (negócios and leilões de fração), each at its day's average price;
   - an incorporation's exit leg is not a sale: its cost moves to the destination, with no result;
   - the closing date is the day the position reached zero: the last sale or, when it zeroed the position, the incorporation;
   - the estimated tax is 20% of each FII position's profit (FII sales have no exemption) and zero on a loss. A stock pays 15% of its profit in each month whose stock sales (quantity × price of every stock sale, open positions included) exceed R$ 20,000; up to that, the month is exempt (`taxExempt` marks a profit made only in exempt months). It's a per-position estimate, not the monthly apuração: it doesn't offset losses across positions or months and ignores the 0.005% IRRF and day trade;
   - a FII with an `ESTIMADO` buy price, directly or through an incorporation, is flagged, because its result is an estimate too. So the input entries carry `priceSource` and `relatedTicker` (`ClosedLedgerEntry`);
   - the Dashboard's card also lists the FIIs that only appear through dividends (no entries, `closedAt` null), so its dividends plus the positions table's add up to the summary's total.
7. `portfolio/domain/evolution.ts` (`computeEvolution`) feeds the Dashboard's evolution chart through `getEvolution`:
   - patrimony and invested at each month's end, from the first entry to the current month;
   - each month is priced at its monthly close (the current month at today's quote), or else at the last known close. A FII with no close at all uses its average price, and the month is flagged `estimated`;
   - `getEvolution` first fills the missing closes from Yahoo (`ensureMonthlyCloses`), once per month and ticker.
8. `portfolio/domain/period-results.ts` (`periodResults`) feeds the Dashboard's "Variação da cotação" card through `getPeriodResults`:
   - the week, month and year P/L by quote only: today's shares of each open position × (current price − the reference close). No dividends or sales, and a buy made inside the period counts from its start, as the owner decided;
   - the references: the last trading day before this week's Monday (São Paulo), from the asset's `recentCloses`; the previous month's close; and December's close of the previous year;
   - a FII without a price or without the reference close is left out and listed;
   - `getPeriodResults` first fills the closes from Yahoo: monthly from December of the previous year (`ensureMonthlyCloses`) and the last 31 days of daily closes (`ensureRecentCloses`, at most every 12 h per ticker; 31 so the asset chart's 1M is a real month).
9. **Ceiling divergence warning** (`strategy/domain/ceiling.ts`, spec `2026-11-01-divergencia-teto-design.md`): `ceilingCheck` compares the ranking ceiling with the 12-month income per share divided by the required yield, the NTN-B real rate (the 60-trading-day median from `getRealRate`) plus 1.0 p.p. for tijolo and the other classes, or plus an assumed IPCA of 4.0% and 1.0 p.p. for paper (the paper DY already carries inflation). It returns a `CeilingCheck` only when |calculated ÷ teto do ranking − 1| exceeds 10%, in either direction; without a ceiling, income, fresh dividends (fetched within 10 days), or a fresh rate there is no warning. The parameters are the constants `CEILING_CHECK`, with no setting screen. `buildSnapshot` takes `ntnbRealRate` (a fraction; the server converts the % once) and sets `StrategyRow.ceilingCheck` on the FIIs in the strategy only; the cascade, the Prioridade and the alerts don't use it. The Carteira Alvo shows a triangle (`CeilingCheckIcon`) colored by the sign (green Positivo, red Negativo, the `gain`/`loss` tokens; a Negativo whose current price is at or under the calculated ceiling is yellow "Atenção", `ceilingCheckTone`) next to the Teto field (the phone sheet, next to the "Preço teto" row and in the row summary), and the Recomendações orders show it next to the asset through `AssetMeta.ceilingWarning`. The text is built by `ceilingCheckDetails` (pure) and drawn by `CeilingCheckBody`: a badge colored by the sign (green/red; on the tooltip, whose background is inverted, `surface="inverse"` uses a pair of tones per theme to keep 4.5:1) with the sign (Positivo: the calculated ceiling is above the ranking one, so the ranking's is the more conservative; Negativo: it is below, so the ranking's may be high for the current income) and the difference, the headline, the values in columns (ranking ceiling, calculated ceiling and, when there is a price, the current price against the calculated one, highlighted when it already passed it), the formula and what to check. It is a tooltip on desktop; on phones the row shows only the icon (no tooltip, touch area of 46 px) and the sheet has the same body. A failed rate read means no warning, never a broken page. Until the first daily cron stores rates in production, no triangle appears.

**Market data** (`market-data`):

- Quotes come from brapi first, with Yahoo as the fallback. Pages refresh stale quotes in the background: `QuoteRefresher` calls `refreshMyQuotesAction`, which also refreshes the held FIIs' dividends.
  - **Market open or closed** (`market-hours.ts`): `isMarketOpen` is the real session, 10:00 to 18:00 on weekdays (no delay, no holidays). `quoteSessionDate` gives the session a quote's change belongs to (its day after 10:00 on a weekday, else the previous weekday), and `marketSession(now, fetchedAt)` joins both (`snapshot.quotes.market`, `AssetOverview.market.session`). `dayChangeLabel` is the day-change suffix: "hoje" for today's session, else "na sex., 06/11", so a Saturday doesn't look like a trading day. `QuoteRefresher` starts with "Mercado aberto"/"Mercado fechado".
  - `changePercent` is stored as a fraction (0.0115 = 1.15%), by both adapters.
  - A quote goes stale after 30 min during the session (10:00 to 18:30 in São Paulo, counting brapi's delay). Outside it, the last close holds and no quota is spent. Holidays aren't handled (`market-data/domain/market-hours.ts`).
  - brapi requests are counted per month in Mongo (`server/usage.ts`). Above 90% of `BRAPI_MONTHLY_QUOTA`, only Yahoo is used until the month turns.
- The daily Vercel cron (`/api/cron/daily`, bearer `CRON_SECRET`, see `vercel.json`) refreshes closes, dividends, monthly history, the recent daily closes (forced, so today's close enters the week's list) and the ticker catalog.
- **Book value, P/VP and the FII profile:** usebolsai's free plan (`BOLSAI_API_KEY`, `adapters/bolsai.ts`, 200 calls/day, one per FII).
  - The `/api/cron/fundamentals` cron runs at 05:00 UTC (02:00–02:59 in São Paulo on Hobby) over the Carteira Alvo tickers. It stores `bookValuePerShare`, `bookValueMonth` (the CVM report month, 1–2 months behind) and `priceToBook` = the previous close ÷ book value, computed in `market-data/domain/fundamentals.ts`. The API's own `pvp` is rounded to 2 decimals, so it's ignored.
  - The same call brings the profile that the risk caps and the vacancy brake use: `vacancyPct`, `segment`, `fundType`, `paperPct` (CRI, LCI, CEPAC and debentures) and `realEstatePct`. P/VP and vacancy older than 60 days count as missing.
  - When the app opens, `refreshMyQuotesAction` also calls `refreshMissingFundamentals`. It fetches only the tickers with no book value, one older than 60 days or no `fundType`, if not tried in the last 6 h (`fundamentalsCheckedAt`).
  - Comparison with brapi: `brapi-vs-usebolsai` notes in the conviction spec.
- `refreshDividends` keeps the last 400 days of Yahoo dividend announcements (the "a receber" learns each FII's pay interval from them) on each asset (`dividendAnnouncements`), with the ex-date normalized to the São Paulo trade date at UTC midnight. It skips assets fetched in the last 20 h.
  - **12-month window:** it fetches 760 days from Yahoo (it was 400), so that a FII stopped for up to 12 months still fits the window. `dividends12m` (which also gives `dy12m`) sums the 12 calendar months that end in the month of the last payment (`dividendWindow`, `market-data/domain/dividend-window.ts`, pure), and `dividendPayments12m` stores how many payments fell in it. A window of 365 days from today took 11 or 13 payments of a monthly FII, depending on the day of the month. With a last ex-date over 365 days old, the sum and the count are zero. This is data used by both versions.
  - **Fundamentus fills Yahoo's gaps (FIIs):** `refreshDividends` also reads the Fundamentus FII page (XXXX11 only) and merges it with `mergeDividendHistory` (`domain/dividend-merge.ts`, spec `2026-11-06-fundamentus-historico-design.md`): Yahoo stays the base (full decimals); a Fundamentus rendimento matched to a Yahoo event (ex-date up to 10 days after the com-date) keeps Yahoo's value when they differ by rounding (≤ 0.0051, Fundamentus rounds FIIs to 2 decimals) and takes Fundamentus's when they differ more; an unmatched one enters with the ex-date on the next weekday. Without the page, Yahoo alone. Measured 2026-11-06: Yahoo missed the Dec-2025 ex-date of GARE11, HGRU11 and TRXF11 and gave XPML11 0.95 instead of 0.92.
  - **Fixed last dividend:** a successful fetch with no dividends keeps the stored `lastDividend` (`nextLastDividend`) instead of setting it to null. A failed fetch writes nothing.
  - No migration: the daily cron recomputes the fields on the next business day.
- **Pay dates (Fundamentus):** `refreshPayDates` (`server/pay-dates-service.ts`, `adapters/fundamentus.ts`, parser `domain/fundamentus.ts`) reads the public `fii_proventos.php`/`proventos.php` pages, identifying itself honestly (`Koinos/1.0`, never a browser User-Agent), 2 requests at a time, at most every 20 h per asset, in the daily cron (`cron.refresh-pay-dates`) and in `refreshMyQuotesAction` for held assets. It stores `payDates` (pay date from 62 days ago on) and `payDatesFetchedAt`; an unknown ticker stores null, a failed fetch writes nothing, and data over 10 days old reads as null. XXXX11 tries the FII page, then the stock one (units).
- **NTN-B real rate** (spec `2026-11-01-taxa-ntnb-design.md`): the daily cron's `cron.treasury` step (`market-data/server/treasury-service.ts`) syncs the Tesouro Transparente CSV (the Tesouro Nacional's open dataset, ODbL; the owner confirmed it is not covered by the no-B3 rule) into `treasury_rates`, one document per tracked title and day. `TRACKED_TITLES` has only the NTN-B 2035 with coupon (`Tesouro IPCA+ com Juros Semestrais`, maturing 2035-05-15).
  - It asks the CKAN catalog for the CSV's `last_modified` (no download if unchanged), then makes a conditional GET on the stored ETag. A 200 is validated before any write (`parseTreasuryCsv`: exact header, 8 columns, at most 1% invalid tracked rows, rates from −10% to 30%) and upserted from `lastBaseDate` on. A rejected or older file throws and writes nothing. Network failures are rewrapped with context ("Tesouro Transparente (catálogo|CSV): …"). A failure is logged and doesn't stop the other cron steps.
  - The sync runs inside `withLock("treasury", 120_000)` (Redis). With the lock taken the status is `busy`, not an error, and the job goes on. The step's status is `not-modified | updated | busy | error`. A script that imports the service outside Next needs `REDIS_URL`, because the lock connects on the first call.
  - `trackedTitlesKey` identifies the `TRACKED_TITLES` list. When it changes, the sync skips the `last_modified` shortcut, the ETag and the date filter, and rewrites the whole history of the tracked titles (a new title gets its full history).
  - Outliers aren't filtered: the October 2026 jumps (+1.28 p.p. on 26/10 and −0.67 on 05/10) are real, the Mondays after the two election rounds.
  - `getRealRate()` returns the last mid rate (average of buy and sell), the median of the last 60 trading days, their difference and `stale` (last base date over 10 days old). Only the ceiling divergence warning uses it (Domain flow, item 9); no engine or ceiling decision does. The lab has `taxa-real`. Show "Fonte: Tesouro Transparente" wherever it appears.
- The brapi free plan has no dividends, and Yahoo has no FII dividends between 2018 and early 2022. Yahoo also has no monthly history for delisted FIIs (MALL11, IRDM11), so the evolution chart estimates those months.

**Observability (APM):** OpenTelemetry traces through `@vercel/otel`, to New Relic in production. Spec: `2026-10-23-apm-opentelemetry-design.md`; dashboard and alerts: `docs/observability/`.

- `src/instrumentation.ts` loads `instrumentation.node.ts` on Node: the `fetch` instrumentation (brapi, Yahoo, Google), MongoDB (the driver, so Better Auth and Mongoose) and ioredis. Without `OTEL_EXPORTER_OTLP_ENDPOINT` nothing is exported; `OTEL_SDK_DISABLED=true` turns it off.
- **Versions move together:** the OTel packages stay on the 0.223 line, because `@vercel/otel` 2.1.3 peers `@opentelemetry/instrumentation <0.300`.
- **External packages:** `ioredis` is in `serverExternalPackages`. A package bundled by Turbopack can't be instrumented; `mongodb` and `mongoose` are external by default.
- **Privacy:** `RedactionSpanProcessor` (`shared/lib/telemetry-redaction.ts`) runs before the exporter. It strips query strings from span names and URL attributes, and numbers, e-mails and query strings from exception messages and logs. B3 tickers (`HGLG11`) stay, since they are already an allowed field.
  - MongoDB statements go with `?` for every value; Redis spans carry only the command name.
  - Action inputs go only for the fields in `TRACEABLE_INPUT_FIELDS` (`ticker`, `type`, `month`) in `auth/server/action-client.ts`. Adding one is a privacy decision.
- **Server Actions:** every action needs `.metadata({ actionName })`, because the metadata schema requires it. The first middleware wraps the action in `action <name>` with `koinos.action.outcome` and, on failure, `error.type` and `koinos.action.error_kind` (`expected` for `ActionError` and `UnauthorizedError`).
- **View filters:** the `view.*` spans carry `koinos.view.class_filter` (`TODOS`, `FII` or `ACAO`) and, in the dividends view, `koinos.view.kind_filter`. Neither is a portfolio value or id.
- **Custom spans** (`shared/lib/tracing.ts`): `withSpan`, `traced` (a span around a function, with counts taken from its result), `recordSpan` and `recordError`.
  - Names: the page loaders are `view.*`, the B3 update steps `b3.*`, the cron steps `cron.*`, the quote sources `quotes.brapi` and `quotes.yahoo-fallback`, and `withLock` opens `lock <name>` with `koinos.lock.acquired`.
  - Attributes carry counts, never portfolio values or ids.
- **Next control flow isn't an error:** redirects, notFound and the end of a prerender (`HANGING_PROMISE_REJECTION`, when the partial prefetch makes `connection()` reject) only set `koinos.control_flow`.
- **Errors Next catches:** `onRequestError` in `src/instrumentation.ts` records a `request.error` span. Next also puts the raw error message in the span status description, so the redaction processor scrubs that too.
- **Web Vitals:** `WebVitals` (`shared/components/web-vitals.tsx`, in the `(app)` layout) batches `useReportWebVitals` measures and beacons them to `/api/vitals`, which records one `web-vitals` span each.
  - The route only takes same-origin requests with a session cookie, and only the app's routes (anything else becomes `other`).
  - The New Relic key never reaches the browser.
- **Logs** (`shared/lib/telemetry-logs.ts`): what the app, Next and the libraries write to the console (`log`, `info`, `warn`, `error`) also becomes OTel logs, linked to the request's trace and scrubbed like exceptions, and go out over OTLP with `OTEL_EXPORTER_OTLP_LOGS_HEADERS` (its own key) or the traces' headers.
  - `FlushLogsWithSpans` empties the log queue in the same `waitUntil` that `@vercel/otel` uses for spans. Without it, a serverless instance could freeze before the batch timer fires.
  - OTel's own diagnostics (`OTEL_LOG_LEVEL`) are routed to the original console, so a failed export ("connect ECONNREFUSED…") never comes back through the bridge as a log and loops.
  - Vercel's edge and build logs need Log Drains, a Pro feature; they don't reach New Relic.
- **The dashboard depends on these names:** renaming a span or a `koinos.*` attribute breaks its widgets and alerts (list in `docs/observability/new-relic.md`).
- **Local check:** point the endpoint at a throwaway receiver with `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` and read the spans as JSON.

**B3 update (`/atualizacao-b3`):**

- The parsing and the plan are pure: `transactions/import/b3`, with `detectB3File`, the three readers (Negociação, Movimentação, Eventos) and `planB3Import`.
  - `codes.ts` holds the B3 code patterns.
  - `classify.ts` holds the classification: FIIs, Fiagros, stocks and units enter.
  - `lending.ts` holds the lending pairing.
  - `dividends.ts` holds the dividends, the "a receber" and the check by dividends.
- The diff is pure too: `import/b3/changes.ts` (`diffLedger`, `diffDividends`, `sameForecast`).
  - A stored B3 entry equal to a planned one stays, with the same `_id`. Repeats count, as a multiset.
  - The rest of what the plan replaces is deleted by id, and the rest of the plan is inserted.
  - For the preview, each deleted row is paired with the first inserted row of the same FII, type and date.
- The service is `transactions/server/b3-import.ts`.
  - It requires exactly the three statements and refuses the spreadsheet.
  - It validates the upload in memory, takes a per-portfolio lock and writes only the difference in one Mongo transaction (`applyB3Update` in `transaction-repo.ts`).
  - Re-uploading the same files writes nothing, and the preview says "Nada novo".
- `scripts/import-b3.ts` shares the plan but still takes Negociação and Movimentação (plus the optional spreadsheet). It writes through `applyTransactionChanges`, which swaps the whole period.
- "A B3 manda": inside the statements' period, the entries of FIIs and stocks are replaced by B3's, and B3-sourced entries are locked in the Transações UI.
- **A receber:** the Eventos statement's dividend rows (FII "Rendimento" and "Reembolso - Rendimento"; stock "DIVIDENDO", "JUROS SOBRE CAPITAL PRÓPRIO" and their "Reembolso - …" rows) become the snapshot in `dividend_forecasts` (one document per portfolio, `asOf` = upload day).
  - Every write replaces the whole snapshot.
  - Only a change in the items counts as new, not a later `asOf`.
  - An item whose quantity differs from the position is only a warning.
- **Dividends:**
  - The plan also extracts the dividend credits from the Movimentação statement into the `dividends` collection (`transactions/server/dividend.model.ts`):
    - Rendimento and Reembolso, of FIIs and stocks;
    - Dividendo;
    - Juros Sobre Capital Próprio (`JCP`, already net of the 15%);
    - the lending fee, from an "Empréstimo" row with a value (`ALUGUEL`), of FIIs and stocks.
  - Inside the Movimentação period they are replaced asset by asset. The scope is the assets with status OK plus the assets that only appear through dividend rows; FORA, PENDENTE and excluded assets keep what they have.
  - The write happens in the same transaction as the ledger, and only the difference is written.
- **Stocks:**
  - **Entries:** a stock uses its own code, with no family.
    - Negócios, desdobro and leilão de fração work as for FIIs.
    - A "Bonificação em Ativos" is a `BONIFICACAO` buy at the cost the company assigns. It is asked once per event (`bon:TICKER:date`, 0 allowed). The answer stays on the stored entry, so a re-upload is already answered.
    - Grupamento, an "Atualização" that differs from the position and a stock subscription receipt (…9, …10) leave the stock out (FORA).
  - **Lending:**
    - A "Transferência - Liquidação" that doesn't settle the day's trades (summed, 0 to 7 days later) is a lending out (debit) or back (credit).
    - A back closes the oldest open out of the same quantity, or else the largest smaller one.
    - Shares that come back above what went out enter as the bonificação or desdobro of the loan period. Without one, there is only a warning. Example: EGIE3, Nov 2025, 32 out and 44 back.
  - **Check by dividends:** it looks for the position up to 365 days before a stock payment (45 for FIIs). A stock month matches when any row, or the sum of the rows of the same payment, matches.
- **Subscription prices:** a stored subscription with `priceSource` PLANILHA counts as a previous answer, like USUARIO and ESTIMADO. So uploading the full history without the spreadsheet opens no pendências.

## Product rules

- **Aporte engine (Koinos 3.0, the owner's document of 2026-10-30):** recommendation logic follows it as implemented in `fii-cascade.ts` (Domain flow, item 3), on the ranking base:
  - Only buy below the ceiling price, filling assets in ranking order up to what each one asks (the gap to the target times the tensors, which can take a FII past its target).
  - Rebalance only through new money, never by selling. The leftover goes one share at a time to the FII furthest below its braked target, until no share fits; the change stays in cash.
  - The risk caps are fixed: 25% of the aporte per FII, 35% per sector and 60% per macro. On 2026-10-30 they replaced the "entrada gradual" cap (33% by default) and its "Máximo por FII" selector. The document says 20% per FII; the owner set 25% the same day.
  - Since 2026-10-31 the owner chooses the FIIs/stocks split at each aporte, on the Recomendações screen (spec `2026-10-31-smart-buy-acoes-design.md`). Stocks use the stock smart buy by margin of safety, not this cascade. The first version's class target was removed.
  - Also since 2026-10-31 (spec `2026-10-31-tabelas-unificadas-design.md`, the owner's choices): the bias Aguardar takes a FII out of the aporte, as it does a stock, and the stocks' suggested % are rescaled to 100% like the FIIs', which replaced "the rest stays in cash".
  - **Koinos 3.1** (2026-11-01, spec `2026-11-01-koinos-3-1-design.md`, the owner's choices, from the council's reports): no small orders. FIIs get a minimum per order (the fair share, aporte ÷ number of FIIs, up to 12.5% of the aporte) and a suspension brake (`PROVENTO_SUSPENSO`). The owner asked for the minimum ("evite compras pequenas") and for the lot ("o lote mínimo para ações é 100"), so stocks are bought in lots of 100 with a leftover step by lot, which replace the stock engine's "no leftover step". The idle-cash warning was declined. The rules are options of the real engines (`ENGINE_VERSIONS`), the 3.0 stays as the default without options, and the screen has no switches: it uses `CURRENT_ENGINE`. Before changing the screen's version, compare the two with the lab's `comparar`.
  - The continuous tensors replaced the Índice de Convicção of 2026-10-24 (×1.2, ×1 and ×0.5 steps). Don't bring back the old spreadsheet's IPA formula either.
- **No B3 calls:** don't call B3 systems or endpoints. B3 offers integrations only to companies, so B3 data enters only through statements the user uploads. A P/VP feature built on B3 lookups was dropped. Its spec and plan are marked discarded.
- **Stocks (2026-10-30):** they enter positions, dividends, lending and the estimated tax. Since 2026-10-31 they also have their own Carteira Alvo (`/carteira-alvo?classe=acoes`, spec `2026-10-31-carteira-alvo-acoes-design.md`) with a bias, and the recommendations through the stock smart buy, with the split chosen at the screen. The unified tables (spec `2026-10-31-tabelas-unificadas-design.md`) gave the two Carteira Alvo tabs the same columns and the % panel, and put FIIs and stocks in one orders table. Spec: `2026-10-30-acoes-etapa-1-design.md`. Stage 2 (the Geral/FIIs/Ações views): `2026-10-31-acoes-etapa-2-design.md`.
- **Dividends start at the first B3 statement (Nov 2019).** The owner decided not to estimate older ones: before that, the app only knows the prior positions of 2019-11-07, without purchase dates.
- **Read the spec first:** design specs and implementation plans per feature are in `docs/superpowers/specs` and `docs/superpowers/plans`. Read the relevant spec before changing behavior.
- **Formula reviews:** before changing an aporte formula (the cascade, the stock smart buy, the split, the weights or the reinvestment), and whenever the owner asks to evaluate one, use the `conselho-investidores` skill (`.claude/skills/`).
  - It checks the math, the edge cases and the invariants, runs the engines on the real portfolio (read-only) and reviews the formula through the lenses of Tiago Reis, Professor Baroni, Warren Buffett and Luiz Barsi.
  - It reports and doesn't change code.

## Gotchas

- **Materials:** the visual materials are Tailwind 4 `@utility` rules in `src/app/globals.css` (`glass-strong`, `card-surface`, `metal-ring`, `btn-gloss`, `tile`…). Composite materials stack through CSS variables (`--glow-layer`, `--card-texture`, `--card-fill`), not competing classes.
- **Motion:** every `[data-slot="card"]` rises on mount (`card-appear`: opacity and `translate`, staggered by sibling) and, where `animation-timeline: view()` exists, again as it scrolls in (`card-scroll-rise`, on `transform`). They use different properties so they don't fight, and `card-lift` keeps `translate` for the hover. All of it is off with reduced motion. The page view transition only fades, since the cards already rise. The top bar (`AutoHideHeader`) hides while scrolling down.
- **Design tokens** (`globals.css`, HIG):
  - type scale `text-display`, `text-title-1`…`3`, `text-headline`, `text-subheadline`, `text-footnote`, `text-caption`, each with its line height, tracking and weight;
  - integer radii: controls 8, panels and menu items 12, popovers 16, cards and glass 20;
  - spring easings `ease-snappy`, `ease-bouncy` and `ease-smooth` (`linear()` curves of SwiftUI springs);
  - spacing on the 4 px grid. Cards pad 20 px (24 from `md`), and table edges use `pl-(--card-spacing)`/`pr-(--card-spacing)` to line up with the card title;
  - buttons press with `press-spring` and grow to 44 px on touch screens (`pointer-coarse:`).
  - form controls: every native select is `NativeSelect` (`shared/ui/native-select.tsx`, the macOS pop-up look); searches use `SearchInput`; two or three short options use `SegmentedControl` (a radio group whose thumb slides on a spring; arrows move it); tables share `Pagination`;
  - dialogs are macOS sheets: radius 24 (34 with continuous corners), 24 px padding, no gray footer band, a bouncy entry from 95%;
  - number cards use `MetricCard` with `StatList`/`StatRow` (`shared/components/metric.tsx`): tile and label, the value in Title 1 at a fixed height, then the detail rows, so rows line up from card to card. In a card narrower than 290 px of content (three columns at ~1,300 px), `StatRow` drops to Footnote through the `@container/metric` on its content, so label and value stay on one line. A variation in a capsule is `DeltaChip`; its tint stays at 6% (light) and 8% (dark), because 10% took the text under 4.5:1.
- **Phone frame (below 768 px, `max-md:`):** the app follows iOS 26 instead of shrinking the desktop.
  - The frame: `TabBar` (floating glass capsule with the `tab` items and "Mais", a `MoreSheet` with the other pages, the appearance picker and the account) and `MobileNavBar` (clear at rest; on scroll, the compact title over a blur, plus a back button on subpages). `PageHeader` shows the 34 px title without the description; `mobileActions={false}` hides header actions that live elsewhere on phones.
  - A page's main action goes in the round button next to the tab bar with `useTabBarAction` (`shared/components/tab-bar-action.tsx`). It registers in an effect, so it leaves with the page even when Next keeps the page hidden in an Activity.
  - Sheets are `Drawer` (`shared/ui/drawer.tsx`, Base UI's Drawer: grabber, swipe down, virtual keyboard). A list opens one sheet for all rows with `createDrawerHandle` and the row as payload; pass an id when the sheet edits the row, so it reads fresh props after each save. `ResponsiveDialog` is a Dialog on desktop and a Drawer on phones. Long helper text goes to an "ⓘ" `InfoSheet`; settled detail goes in a `Disclosure`.
  - Tables become lists below a container step (`@min-[480px]` to `@min-[900px]`), with `InsetGroup`/`InsetValueRow` (`shared/components/inset-list.tsx`) for grouped rows and `SnapCarousel` for card rows.
  - `viewport-fit=cover` is on, so anything fixed insets by `--safe-top/bottom/left/right`. That includes the desktop frame: a landscape iPhone is 768 px or more wide. The bars use `--tab-bar-height`, `--tab-bar-bottom`, `--tab-bar-space` (the content's bottom padding) and `--nav-bar-height`.
  - Every tap target is 44 px on touch: `pointer-coarse:` sizes, or an `::after` hit area when the visual must stay smaller (segments, the "Resultado total ⓘ" trigger). Inputs and selects use 16 px text on phones, or Safari zooms on focus.
  - AA on phones: sheets use the nearly opaque `--sheet` (the 82% glass grayed over the dimmed page and took the loss red under 4.5:1) and the selected tab uses `--tab-active`.
  - The home screen icon (`app/apple-icon.tsx`, `app/icon.tsx`, both from `app/app-icon.tsx`) and `app/manifest.ts` make the app open standalone from the iPhone home screen.
- **Cursor:** a base rule in `globals.css` gives the pointer to links, buttons, summaries, selects, checkboxes and Base UI's ARIA roles (tab, option, menuitem…), and the arrow back when disabled. A `cursor-default` class beats it, so clickable components must not carry one. Tooltip triggers on a `<span>` keep the arrow: hovering only shows the tip.
- **Card header grid:** `CardTitle` and `CardDescription` are pinned to column 1. A `CardAction` hidden by a breakpoint (the phone's ⓘ) keeps the header in two columns, and without the pin the description jumped next to the title.
- **Dev server staleness:** after editing tokens inside `.dark` in `globals.css`, or a client component that the server renders, Turbopack's dev server sometimes kept serving the old CSS or HTML (a hydration mismatch). Restart `npm run dev`.
- **`backdrop-filter`:** write only the unprefixed property. If `-webkit-backdrop-filter` is also written, Lightning CSS keeps only the prefixed one, which Chrome and Edge ignore.
- **Contrast:** at `size="sm"`, the `btn-gloss` label sits under the top sheen and falls to about 3.3:1 in the light theme.
  - Segment choices use `SegmentedControl` (dark text on a light thumb), not a `btn-gloss` button.
  - The AA text colors are `text-gain`, `text-loss` and `text-muted-foreground`.
  - `variant="link"` (`text-primary`) measured 3.9:1 on a card, so buttons that navigate use `variant="outline"`.
  - Native `<select>` fields have a translucent background, and the system draws their open list. So `globals.css` gives `option` a solid `--card` background and `--foreground` text; without it, the dark theme showed light text on a light list.
- **Container queries:** layouts that depend on the content width (sidebar open or closed) use `@container` with `@min-[Npx]:` steps, in px only. Tailwind emits px container sizes before the named rem ones (`@md`, `@3xl`…), so mixing the two lets the named ones win.
  - Wide tables scroll inside their card (`shared/ui/table.tsx` wraps them in `overflow-x-auto`, and `SidebarInset` has `min-w-0`). The closed-positions and IR tables instead add columns at container steps (480 to 840 px), so it fits a phone without scrolling sideways.
- **Client bundle:** `package.json` declares `"sideEffects": ["*.css"]`. Without it, Turbopack shipped every client component of a feature barrel (`ui.ts`) to any page that imported one name from it: Carteira Alvo got all the charts and every app page got the Google sign-in button. A module that must run on import (not `import()`) would need its own entry in that list.
  - Recharts (~150 KB gzip) only loads on demand: each card renders its plot (`*-plot.tsx`, `allocation-donut.tsx`) through `next/dynamic` with `ssr: false` and a `ChartPlaceholder` of the same height. A new chart follows the same split.
  - The Better Auth client loads only on `/login`; `SessionKeepAlive` and `signOutAndLeave` `import()` it when they need it.
  - To measure, read the `/_next/static/chunks/*.js` referenced by each `.next/server/app/<page>.html` after a build and gzip them.
- **Charts:** Recharts, through `shared/ui/chart.tsx`.
  - Series colors come from the `--chart-*` tokens: aportes and bolso use `--chart-1` (blue), proventos use `--chart-2` (orange).
  - Two or more series get a legend.
- **Money fields:** `MoneyInput` (`shared/components/money-input.tsx`) fills from the cents, like an ATM: it starts at "0,00", and typing 1, 2, 0, 0, 0, 0, 0 shows 0,01, 0,12, 1,20… 12.000,00. New digits always go at the end, and a paste is read in reais. Read its text with `parseMoneyInput`: `parseNumberInput` takes a dot without a comma as the decimal point and would read "14.000" as 14. The Carteira Alvo's Teto uses it too, through `MoneyField` (`strategy/components/table/money-field.tsx`, saving on blur or Enter like `NumberField`): `allowEmpty` keeps an unset ceiling blank with the `0,00` placeholder, blank or 0,00 saves as no ceiling, and a value over `CEILING_MAX` (R$ 1,000,000, shared with the action schema) is refused with a toast and the field goes back to the saved value (`ceilingFromInput`).
- **Dates in the static shell:** a client component outside `<Suspense>` (the page header, like `NewTransactionButton`) can't call `new Date()` while rendering. That includes JSX props of a closed dialog's content, because JSX is evaluated eagerly. Compute the date in the event that opens it.
- **Base UI `Button` as a link:** `render={<Link />}` needs `nativeButton={false}`. Without it, Base UI logs an error and puts `type="button"` on the `<a>`.
- **Mongoose models in dev:** the models are reused from `mongoose.models` across hot reloads, so a field added to a schema is silently dropped (strict mode) until the dev server restarts.
- **`cn`:** import it from `@/shared/lib/utils`, never from `"cn"`. The project's `createCn` knows the type tokens (`text-headline`…); the package's own `cn` takes them for colors and drops them next to a `text-*` color. A later class overrides a conflicting one.
- **`next.config.ts`:**
  - `turbopackFileSystemCacheForBuild` is off on purpose: Vercel's restored build cache shipped stale CSS.
  - `serverActions.bodySizeLimit` is `4mb`, for the statement uploads; Vercel caps a request at 4.5 MB.
- **Deploy:**
  - Only `main` deploys (`vercel.json`), to region `gru1`. Functions run on Node 24 at Vercel; local dev uses Node 26 (`.nvmrc`).
  - Workflow: work on a branch, fast-forward `main`, push. Every push to `main` goes to production.
  - The production domain must match `BETTER_AUTH_URL`. Pages opened on other `*.vercel.app` hosts redirect there; `/api` is exempt so the cron works.
