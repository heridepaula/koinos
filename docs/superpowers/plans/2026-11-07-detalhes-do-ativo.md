# Detalhes do ativo (`/ativos`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Páginas `/ativos` (busca) e `/ativos/[ticker]` (mercado, estratégia, posição, proventos, ordens e cotação), só com dados que o app já guarda.

**Architecture:** Uma view `getAssetOverview(ticker)` em `portfolio/server` reaproveita o snapshot, a view de proventos, o ledger e os fechamentos mensais, e devolve um DTO sem ids. O cálculo novo (YOC e variação do dia) é código puro em `portfolio/domain`. A busca reaproveita `/api/tickers`. Spec: `docs/superpowers/specs/2026-11-07-detalhes-do-ativo-design.md`.

**Tech Stack:** Next 16 (cacheComponents), React, nuqs, @tanstack/react-query, Recharts via `shared/ui/chart.tsx`, Vitest.

**Desvios da spec (atualizar a spec no Task 1):**
- Não há `cmdk` no projeto. A busca é um `Input` com lista (`role="listbox"`), sem dependência nova.
- A variação do dia usa `changePercent` já guardado no ativo, não um fechamento anterior: `dailyChange(price, changePercent)`.
- Janela do YOC: os 12 meses de calendário anteriores ao mês atual.

**Antes de começar:** leia `node_modules/next/dist/docs/` sobre `params` assíncrono e `generateStaticParams`/cache components (AGENTS.md). Rode comandos via Bash (rtk). Branch: `feat/detalhes-ativo`.

---

## File Structure

- Create `src/features/portfolio/domain/asset-overview.ts` + `.test.ts`: `yieldOnCost12m`, `dailyChange`.
- Modify `src/features/market-data/server/catalog.ts` e `server.ts`: `getCatalogEntry`.
- Modify `src/features/portfolio/domain/types.ts`: tipo `AssetOverview`.
- Create `src/features/portfolio/server/asset-overview-view.ts`; modify `portfolio/server.ts`.
- Create `src/features/market-data/components/asset-search.tsx` e `src/features/market-data/ui.ts`.
- Create `src/features/portfolio/components/asset/` (`asset-hero.tsx`, `market-card.tsx`, `strategy-card.tsx`, `position-card.tsx`, `asset-tabs.tsx`, `price-plot.tsx`, `price-chart.tsx`); modify `portfolio/ui.ts`.
- Create `src/app/(app)/ativos/page.tsx` e `src/app/(app)/ativos/[ticker]/page.tsx`.
- Modify `src/proxy.ts`, `src/shared/components/nav-items.ts`, `positions-table.tsx`, `positions-list.tsx`.

---

### Task 1: Cálculos puros (YOC e variação do dia)

**Goal:** `yieldOnCost12m` e `dailyChange` testados, e a spec alinhada.

**Files:**
- Create: `src/features/portfolio/domain/asset-overview.ts`
- Test: `src/features/portfolio/domain/asset-overview.test.ts`
- Modify: `docs/superpowers/specs/2026-11-07-detalhes-do-ativo-design.md` (três desvios acima)

**Acceptance Criteria:**
- [ ] YOC soma só os proventos pagos nos 12 meses de calendário antes do mês de `now`.
- [ ] YOC é `null` sem posição (quantidade 0) ou com preço médio 0.
- [ ] `dailyChange` devolve R$ e % ou `null` sem preço ou sem variação.

**Verify:** `npx vitest run src/features/portfolio/domain/asset-overview.test.ts` → todos passam

**Steps:**

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, expect, it } from "vitest";
import { dailyChange, yieldOnCost12m } from "./asset-overview";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = d("2026-11-07");

describe("yieldOnCost12m", () => {
  const position = { averagePrice: 100, quantity: 10 };

  it("soma os 12 meses de calendário antes do mês atual", () => {
    const paid = [
      { paidAt: d("2025-11-15"), amount: 10 }, // primeiro mês da janela
      { paidAt: d("2026-10-31"), amount: 10 }, // último mês da janela
      { paidAt: d("2026-11-05"), amount: 99 }, // mês atual: fora
      { paidAt: d("2025-10-31"), amount: 99 }, // antes da janela: fora
    ];
    expect(yieldOnCost12m(paid, position, now)).toBeCloseTo(20 / 1000);
  });

  it("é null sem posição ou sem custo", () => {
    const paid = [{ paidAt: d("2026-10-01"), amount: 10 }];
    expect(yieldOnCost12m(paid, { averagePrice: 100, quantity: 0 }, now)).toBeNull();
    expect(yieldOnCost12m(paid, { averagePrice: 0, quantity: 10 }, now)).toBeNull();
  });

  it("é zero com posição e sem proventos na janela", () => {
    expect(yieldOnCost12m([], position, now)).toBe(0);
  });
});

describe("dailyChange", () => {
  it("deriva o valor em R$ do preço e do percentual", () => {
    const result = dailyChange(110, 10);
    expect(result?.percent).toBe(10);
    expect(result?.amount).toBeCloseTo(10);
  });

  it("é null sem preço ou sem variação", () => {
    expect(dailyChange(null, 1)).toBeNull();
    expect(dailyChange(10, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/portfolio/domain/asset-overview.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

```ts
/** Cálculos puros da página de detalhes do ativo (spec 2026-11-07-detalhes-do-ativo). */

type PaidDividend = { paidAt: Date; amount: number };

/**
 * Yield on cost: proventos recebidos nos 12 meses de calendário anteriores ao mês de `now`,
 * divididos pelo custo médio da posição (preço médio × cotas). Null sem posição ou sem custo.
 */
export function yieldOnCost12m(
  dividends: readonly PaidDividend[],
  position: { averagePrice: number; quantity: number },
  now: Date,
): number | null {
  const cost = position.averagePrice * position.quantity;
  if (position.quantity <= 0 || cost <= 0) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1); // exclusivo
  const received = dividends
    .filter((item) => item.paidAt.getTime() >= start && item.paidAt.getTime() < end)
    .reduce((sum, item) => sum + item.amount, 0);
  return received / cost;
}

/** Variação do dia em R$ por cota e em %, a partir do preço e do `changePercent` da cotação. */
export function dailyChange(
  price: number | null,
  changePercent: number | null,
): { amount: number; percent: number } | null {
  if (price === null || changePercent === null) return null;
  const previous = price / (1 + changePercent / 100);
  return { amount: price - previous, percent: changePercent };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/features/portfolio/domain/asset-overview.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Ajustar a spec e commitar**

Troque na spec: "variação do dia" para `changePercent`, "busca com `Command`" para `Input` com lista (sem `cmdk`), e o YOC para a janela de 12 meses de calendário.

```bash
git add src/features/portfolio/domain/asset-overview.* docs/superpowers/specs/2026-11-07-detalhes-do-ativo-design.md
git commit -m "feat(portfolio): add yield on cost and daily change calculations

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Entrada do catálogo por ticker

**Goal:** `getCatalogEntry(ticker)` exato, para nome, tipo e existência.

**Files:**
- Modify: `src/features/market-data/server/catalog.ts` (após `getCatalogSubType`)
- Modify: `src/features/market-data/server.ts` (exportar)

**Acceptance Criteria:**
- [ ] Devolve a `CatalogEntry` do ticker exato, ou `null`.

**Verify:** `npm run typecheck` → sem erros

**Steps:**

- [ ] **Step 1: Implementar**

Em `catalog.ts`, depois de `getCatalogSubType`:

```ts
/** A entrada do catálogo para o ticker exato (nome, tipo, logo); null fora dele. */
export async function getCatalogEntry(ticker: string): Promise<CatalogEntry | null> {
  const entries = await loadCatalog();
  return entries.find((entry) => entry.ticker === ticker) ?? null;
}
```

Em `server.ts`, no bloco de `./server/catalog`, acrescente `getCatalogEntry,` antes de `getCatalogSubType`.

- [ ] **Step 2: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/features/market-data
git commit -m "feat(market-data): look up a catalog entry by exact ticker

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: View `getAssetOverview`

**Goal:** O DTO da página, montado dos dados que já existem, sem ids internos.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts` (tipo `AssetOverview`, no fim)
- Create: `src/features/portfolio/server/asset-overview-view.ts`
- Modify: `src/features/portfolio/server.ts`

**Acceptance Criteria:**
- [ ] Ticker fora de `^[A-Z0-9]{4,12}$` ou sem catálogo e sem lançamentos → `notFound()`.
- [ ] Posição, estratégia, encerrada, ordens, proventos recebidos, a receber e fechamentos vêm filtrados pelo ticker.
- [ ] Nenhum campo `id` no DTO (`TransactionRecord.id` é descartado).
- [ ] Span `view.asset-overview` com `koinos.view.class_filter` e contagens.

**Verify:** `npm run typecheck && npm run lint` → sem erros

**Steps:**

- [ ] **Step 1: Tipo do DTO** — acrescente em `types.ts`:

```ts
/** Ordem do ledger como a página do ativo mostra (sem id interno). */
export type AssetOrder = {
  date: Date;
  type: "BUY" | "SELL";
  quantity: number;
  unitPrice: number;
  fees: number;
  kind: string;
};

/** Visão de um ativo: mercado (público) e, se houver, estratégia e posição do dono. */
export type AssetOverview = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  assetClass: AssetClass | null;
  price: number | null;
  dailyChange: { amount: number; percent: number } | null;
  market: {
    priceToBook: number | null;
    dy12m: number | null;
    lastDividend: { amount: number; exDate: Date } | null;
    segment: string | null;
    quoteFetchedAt: Date | null;
  };
  strategy: StrategyRow | null;
  position: PositionRow | null;
  yoc: number | null;
  closed: ClosedPositionRow | null;
  orders: AssetOrder[];
  received: { paidAt: Date; kind: string; amount: number; perShare: number | null }[];
  upcoming: UpcomingDividend[];
  closes: { month: string; close: number }[];
};
```

(Use os tipos `AssetClass`, `ClosedPositionRow` e `UpcomingDividend` já importados/definidos em `types.ts`; se `AssetClass` não estiver importado, importe de `@/features/market-data`.)

- [ ] **Step 2: A view**

```ts
import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import {
  getAssetClasses,
  getAssetSnapshots,
  getCatalogEntry,
  getMonthlyCloses,
} from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { traced } from "@/shared/lib/tracing";
import { dailyChange, yieldOnCost12m } from "../domain/asset-overview";
import type { AssetOverview } from "../domain/types";
import { getDividendsView } from "./dividends-view";
import { getPortfolioSnapshot } from "./snapshot";

const TICKER = /^[A-Z0-9]{4,12}$/;

/**
 * Tudo o que o app sabe de um ativo: mercado (só o que já está guardado, sem buscar nada), a
 * estratégia e a posição do dono. O ticker vem da URL: valida antes de consultar.
 */
export const getAssetOverview = cache(
  traced(
    "view.asset-overview",
    async (rawTicker: string): Promise<AssetOverview> => {
      const ticker = rawTicker.toUpperCase();
      if (!TICKER.test(ticker)) notFound();
      await connection();
      const now = new Date();
      const [entry, transactions, received, classes] = await Promise.all([
        getCatalogEntry(ticker),
        getMyTransactions(),
        getMyDividends(),
        getAssetClasses([ticker]),
      ]);
      const mine = transactions.filter((t) => t.ticker === ticker);
      if (!entry && mine.length === 0) notFound();
      const assetClass = classes.get(ticker) ?? null;
      const [assets, closes, all, ofClass, dividends] = await Promise.all([
        getAssetSnapshots([ticker]),
        getMonthlyCloses([ticker]),
        getPortfolioSnapshot("TODOS"),
        getPortfolioSnapshot(assetClass ?? "TODOS"),
        getDividendsView("TODOS"),
      ]);
      const asset = assets.get(ticker);
      const position = all.positions.find((row) => row.ticker === ticker) ?? null;
      const mineReceived = received.filter((item) => item.ticker === ticker);
      const price = asset?.price ?? null;
      return {
        ticker,
        name: entry?.name ?? asset?.name ?? null,
        logoUrl: entry?.logoUrl ?? asset?.logoUrl ?? null,
        assetClass,
        price,
        dailyChange: dailyChange(price, asset?.changePercent ?? null),
        market: {
          priceToBook: asset?.priceToBook ?? null,
          dy12m: asset?.dy12m ?? null,
          lastDividend: asset?.lastDividend ?? null,
          segment: asset?.fii?.segment ?? null,
          quoteFetchedAt: asset?.quoteFetchedAt ?? null,
        },
        strategy: ofClass.strategy.rows.find((row) => row.ticker === ticker && row.configured) ?? null,
        position,
        yoc: position ? yieldOnCost12m(mineReceived, position, now) : null,
        closed: all.closed.find((row) => row.ticker === ticker) ?? null,
        orders: mine
          .map(({ date, type, quantity, unitPrice, fees, kind }) => ({
            date, type, quantity, unitPrice, fees, kind: kind ?? "NEGOCIO",
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime()),
        received: mineReceived
          .map(({ paidAt, kind, amount, perShare }) => ({ paidAt, kind, amount, perShare }))
          .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
        upcoming: dividends.upcoming.filter((item) => item.ticker === ticker),
        closes: [...(closes.get(ticker) ?? [])]
          .map(([month, close]) => ({ month, close }))
          .sort((a, b) => a.month.localeCompare(b.month)),
      };
    },
    (overview) => ({
      "koinos.view.class_filter": overview.assetClass ?? "TODOS",
      "koinos.view.orders": overview.orders.length,
      "koinos.view.dividends": overview.received.length,
    }),
  ),
);
```

Antes de salvar, confira: o formato real do valor do `ClassFilter` para uma classe (`"FII"`/`"ACAO"`), o tipo de `kind` em `TransactionRecord` (use o tipo dele em vez de `string` se preferir) e se `PositionRow`/`ClosedPositionRow` são compatíveis com o DTO. Ajuste o tipo, não o cast. O `closed` usa `ClosedPositionRow`, o tipo que o snapshot já devolve em `closed`.

- [ ] **Step 3: Exportar** — em `portfolio/server.ts`:

```ts
export { getAssetOverview } from "./server/asset-overview-view";
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm run typecheck && npm run lint`

```bash
git add src/features/portfolio
git commit -m "feat(portfolio): add the asset overview view

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Busca `AssetSearch`

**Goal:** Campo com prévia a cada digitação (debounce 300 ms) que leva a `/ativos/TICKER`.

**Files:**
- Create: `src/features/market-data/components/asset-search.tsx`
- Create: `src/features/market-data/ui.ts` (`export { AssetSearch } from "./components/asset-search";`)

**Acceptance Criteria:**
- [ ] Só consulta `/api/tickers?q=` com 2 ou mais caracteres, após 300 ms parado.
- [ ] Setas, Enter e Esc funcionam; Enter sem item ativo vai ao ticker digitado se ele tiver 5 a 6 caracteres.
- [ ] Padrão ARIA combobox/listbox; texto de 16 px no celular (`Input` já faz).
- [ ] O item mostra ticker, nome e FII/Ação.

**Verify:** `npm run lint && npm run typecheck` → sem erros; no dev, digitar "BTLG" mostra sugestões e Enter abre `/ativos/BTLG11`

**Steps:**

- [ ] **Step 1: Componente** (padrão do `TickerInput`: react-query + `/api/tickers`)

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Input } from "@/shared/ui/input";

type Suggestion = { ticker: string; name: string; subType: string | null };

async function search(query: string): Promise<Suggestion[]> {
  const response = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`);
  return response.ok ? response.json() : [];
}

const kindOf = (subType: string | null) =>
  subType === "fii" || subType === "fi-agro" ? "FII" : "Ação";

/** Busca de ativos do catálogo, com prévia. Não busca dados de mercado: só leva à página. */
export function AssetSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim().toUpperCase()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const { data = [] } = useQuery({
    queryKey: ["tickers", debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  function go(ticker: string) {
    setOpen(false);
    router.push(`/ativos/${ticker}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, data.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter") {
      const typed = text.trim().toUpperCase();
      if (active >= 0 && data[active]) go(data[active].ticker);
      else if (/^[A-Z0-9]{5,6}$/.test(typed)) go(typed);
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <Input
        role="combobox"
        aria-expanded={open && data.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Buscar ativo"
        placeholder="Buscar ativo (ticker ou nome)"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKeyDown}
      />
      {open && data.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border p-1 shadow-lg"
        >
          {data.map((item, index) => (
            <li
              key={item.ticker}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={() => go(item.ticker)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 aria-selected:bg-accent hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="font-medium">{item.ticker}</span>
                {item.name !== item.ticker ? (
                  <span className="text-muted-foreground ml-2 truncate text-footnote">
                    {item.name}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-caption">{kindOf(item.subType)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/features/market-data
git commit -m "feat(market-data): add the asset search with preview

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Confirme que `eslint.config.mjs` permite `market-data/ui.ts` como entrada pública (o padrão `ui.ts` já vale para as outras features; se a regra listar as features, acrescente `market-data`).

---

### Task 5: Páginas e seções

**Goal:** `/ativos` e `/ativos/[ticker]` completas, com hero, mercado, estratégia, posição e abas.

**Files:**
- Create: `src/app/(app)/ativos/page.tsx`, `src/app/(app)/ativos/[ticker]/page.tsx`
- Create: `src/features/portfolio/components/asset/{asset-hero,market-card,strategy-card,position-card,asset-tabs,price-plot,price-chart}.tsx`
- Modify: `src/features/portfolio/ui.ts`

**Acceptance Criteria:**
- [ ] `/ativos` mostra o cabeçalho e a busca.
- [ ] `/ativos/[ticker]` abre o hero e o card de mercado para qualquer ativo do catálogo; estratégia e posição só aparecem quando existem; encerrada mostra o resultado de `/encerradas` com link.
- [ ] Abas `?aba=proventos|ordens|cotacao` (nuqs, padrão `proventos`) com estado vazio curto em cada uma.
- [ ] O gráfico carrega por `next/dynamic` (`ssr: false`) com `ChartPlaceholder`, e traça o preço médio quando há posição.
- [ ] Ticker inexistente → 404; layout sem rolagem horizontal em 393 px; contraste AA (usar `text-gain`, `text-loss`, `text-muted-foreground`).

**Verify:** `npm run typecheck && npm run lint && npm run build` → sem erros (build com os valores dummy de `.github/workflows/ci.yml` se faltar `.env.local`)

**Steps:**

- [ ] **Step 1: `/ativos`** — padrão de `encerradas/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AssetSearch } from "@/features/market-data/ui";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Ativos" };

export default function AssetsPage() {
  return (
    <>
      <PageHeader
        title="Ativos"
        description="Busque um FII ou uma ação para ver mercado, estratégia, posição e proventos."
      />
      <div className="flex justify-center pt-8 md:pt-16">
        <AssetSearch autoFocus />
      </div>
    </>
  );
}
```

- [ ] **Step 2: `/ativos/[ticker]`** — cabeçalho estático; o `params` é assíncrono e é lido dentro do `<Suspense>`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { getAssetOverview } from "@/features/portfolio/server";
import {
  AssetHero, AssetTabs, MarketCard, PositionCard, StrategyCard,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Ativo" };

export default function AssetPage({ params }: PageProps<"/ativos/[ticker]">) {
  return (
    <>
      <PageHeader title="Ativo" mobileActions={false} />
      <Suspense fallback={<CardSkeleton height="h-96" />}>
        <AssetContent params={params} />
      </Suspense>
    </>
  );
}

async function AssetContent({ params }: Pick<PageProps<"/ativos/[ticker]">, "params">) {
  const overview = await getAssetOverview((await params).ticker);
  return (
    <div className="grid gap-6">
      <AssetHero overview={overview} />
      <MarketCard overview={overview} />
      {overview.strategy ? <StrategyCard overview={overview} /> : null}
      {overview.position || overview.closed ? <PositionCard overview={overview} /> : null}
      <AssetTabs overview={overview} />
    </div>
  );
}
```

Confira se `PageHeader` aceita `description` opcional e o `actions`; o `PageHeader` do ticker pode receber o botão de voltar a `/ativos` em `actions`, como as subpáginas.

- [ ] **Step 3: Seções** — componentes server (sem estado), exceto `AssetTabs` (client). Reuse `AssetLabel`, `MetricCard`/`StatList`/`StatRow` (`shared/components/metric.tsx`), `DeltaChip` (`shared/components/delta.tsx`), `Sensitive` (privacidade) onde há valores em R$, e os formatadores já usados em `positions-table.tsx` (`formatBRL`, `formatPercent`; confira os nomes lá).
  - `AssetHero`: `AssetLabel` grande, badge FII/Ação, preço e `DeltaChip` da `dailyChange`; a `AssetSearch` à direita (`max-md:` abaixo). Sem preço: "Sem cotação".
  - `MarketCard`: `StatRow` de P/VP (— se null), DY 12m, último provento (valor e data ex), segmento (FII) e "Cotação de <data>".
  - `StrategyCard`: rank, teto, margem (`marginToCeiling`), viés, Prioridade (reuse o componente/formatador que `/carteira-alvo` usa para `priority`; procure em `strategy/components/table/`), `suggestedPercent` e `targetWeight` vs peso atual (`position?.portfolioWeight`), `CeilingCheckIcon` quando `ceilingCheck` e um link `Link` para `/carteira-alvo?classe=fiis|acoes` (`Button variant="outline" nativeButton={false} render={<Link … />}`).
  - `PositionCard`: com `position`: quantidade, preço médio, investido (`totalCost`), saldo (`currentValue`), L/P R$ e % (`pnl`, `pnlPct`), proventos (`dividends`), "com proventos" (`pnlWithDividends`) e YOC (`overview.yoc`, "—" se null). Sem posição e com `closed`: custo, vendido, resultado (`closed.realizedPnL`) e link a `/encerradas`.
- [ ] **Step 4: `AssetTabs`** (client, `"use client"`):

```tsx
"use client";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const TABS = ["proventos", "ordens", "cotacao"] as const;
// const [tab, setTab] = useQueryState("aba", parseAsStringLiteral(TABS).withDefault("proventos"));
```

Use `SegmentedControl` (`shared/ui/segmented-control.tsx`; confira as props) para escolher a aba. Proventos: tabela com `received` (data, tipo via `DIVIDEND_KIND_LABELS`, por cota, total) e as linhas `upcoming` (pagamento `payBy`, "a receber", fonte). Ordens: tabela de `orders` (data, C/V, quantidade, preço, taxas, total, origem `kind`) e a nota "Edite em Transações". Cotação: `PriceChart`. Cada uma com `Empty` curto (`shared/ui/empty.tsx`). Tabelas viram listas no celular (`InsetGroup`/`InsetValueRow`, padrão de `closed-table.tsx`).

- [ ] **Step 5: Gráfico** — copie a divisão de `evolution-chart.tsx` (wrapper com `next/dynamic` + `ChartPlaceholder`) e `evolution-plot.tsx` (Recharts via `shared/ui/chart.tsx`): uma `Line` de `closes` (`month`, `close`) com a cor `--chart-1` e, se houver posição, uma `ReferenceLine` no preço médio. Sem `closes`: estado vazio.
- [ ] **Step 6: Exportar** os componentes em `portfolio/ui.ts` (`AssetHero`, `MarketCard`, `StrategyCard`, `PositionCard`, `AssetTabs`).
- [ ] **Step 7: Verificar e commitar**

```bash
npm run format && npm run lint && npm run typecheck && npm run build
git add src
git commit -m "feat(ativos): add the asset search and details pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Navegação, proxy e links

**Goal:** Menu, proteção de rota e links nos tickers.

**Files:**
- Modify: `src/proxy.ts`, `src/shared/components/nav-items.ts`
- Modify: `src/features/portfolio/components/positions-table.tsx` (~linha 251), `positions-list.tsx`
- Modify: ordens de `recomendacoes` e linhas da Carteira Alvo (procure o `AssetLabel`/ticker nos componentes de `smart-buy/components/aporte/` e `strategy/components/table/`)

**Acceptance Criteria:**
- [ ] `matcher` do proxy inclui `"/ativos/:path*"`.
- [ ] "Ativos" aparece na sidebar e no "Mais" do iPhone, sem aba própria.
- [ ] O ticker vira link para `/ativos/TICKER` na tabela e na lista de posições, nas ordens de Recomendações e na Carteira Alvo, sem quebrar o hover da linha nem os campos editáveis.

**Verify:** `npm run lint && npm run typecheck && npm test` → sem erros; no dev, o clique no ticker abre a página

**Steps:**

- [ ] **Step 1: Proxy** — acrescente `"/ativos/:path*",` ao `matcher`.
- [ ] **Step 2: Menu** — em `nav-items.ts` importe `SearchIcon` de `lucide-react` e adicione, depois do Dashboard (sem `tab`), `{ href: "/ativos", label: "Ativos", icon: SearchIcon, tile: "[--tile:var(--tile-purple)]" }`. Confira os tokens `--tile-*` existentes em `globals.css` e use um que exista.
- [ ] **Step 3: Links** — onde `AssetLabel` mostra o ticker, envolva em `<Link href={`/ativos/${row.ticker}`} className="…">` (sem `cursor-default`; o cursor global já cuida). Em `positions-table.tsx`, mantenha o destaque de hover da célula do ativo (commit `1da5550`).
- [ ] **Step 4: Verificar no dev** — `npm run dev`, abra `/dashboard`, `/recomendacoes` e `/carteira-alvo`, clique nos tickers, e teste `/ativos/XXXX99` (404), um FII da carteira, uma ação, um ativo encerrado e um fora da carteira. Em 393 px, confira que não há rolagem horizontal.
- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint && npm run typecheck && npm test
git add -A
git commit -m "feat(ativos): link tickers and add the menu entry

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentação do projeto

**Goal:** `CLAUDE.md` descreve a página e a view.

**Files:** Modify `CLAUDE.md` (lista de Pages, em `src/app/(app)`, e os testes cobertos).

**Acceptance Criteria:**
- [ ] A lista de páginas tem `/ativos` e `/ativos/[ticker]` (view `getAssetOverview`, só dados guardados, sem busca sob demanda).
- [ ] A lista de testes cobertos cita `portfolio/domain/asset-overview.test.ts`.

**Verify:** `npm run format:check` → sem diferenças

**Steps:**
- [ ] **Step 1:** Edite `CLAUDE.md` com os dois itens acima, no estilo das outras páginas.
- [ ] **Step 2:** `npm run format:check && npm test`
- [ ] **Step 3:** `git add CLAUDE.md && git commit -m "docs: document the asset details page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`

---

## Self-Review

- **Cobertura da spec:** rotas/proxy/menu (T5, T6); busca (T4); hero, mercado, estratégia, posição e abas (T5); view e DTO sem ids (T3); YOC e variação do dia puros e testados (T1); links de entrada (T6); erros por seção, `notFound` e ticker inválido (T3, T5); fora do escopo respeitado.
- **Lacuna aceita:** "falha na leitura de mercado esconde só a seção" não tem tarefa própria, pois a view lê só dados guardados no Mongo (sem chamadas externas). Se uma falha aparecer, a página usa o `error.tsx` do app.
- **Consistência de nomes:** `getAssetOverview`, `AssetOverview`, `yieldOnCost12m`, `dailyChange`, `getCatalogEntry` e `AssetSearch` aparecem iguais em todas as tarefas.
