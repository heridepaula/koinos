# Ações na carteira, etapa 2 (telas por classe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ver a carteira em Geral, FIIs e Ações no Dashboard, em Proventos (com filtro e soma por tipo), em Encerradas e IR, no Reinvestimento e em Transações.

**Architecture:**
- **Filtro puro em `shared/lib/class-filter.ts`:** `ClassFilter`, `parseClassParam`, `inClass` e `byClass`. Fica em `shared` porque Transações filtra no cliente e `shared` não importa features.
- **Views:** recebem o filtro (padrão `"TODOS"`) e separam os lançamentos e proventos da classe antes do código puro que já existe. O snapshot usa `scopeToClass` (puro), e a visão Ações zera os alvos.
- **URL:** `?classe=fiis|acoes` pelo `AssetClassControl` (`nuqs`, `shallow: false`); em Transações, o mesmo controle com `shallow`. Proventos ganha `?tipo=`.

**Tech Stack:** Next.js 16 (cacheComponents), TypeScript, nuqs, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-31-acoes-etapa-2-design.md`

**Regras do repositório:**
- **Branch:** `feat/acoes-etapa-2`, que já existe, com a spec. Nada vai para a `main` sem o ok do dono.
- **Banco:** o `.env.local` aponta para produção. Nenhum passo grava: o script de conferência do Task 8 só lê.
- **Commits:** em inglês, Conventional Commits, terminando com as linhas de atribuição da sessão.
- **Código:** comentários e textos de tela em português do Brasil; `cn` de `@/shared/lib/utils`.
- **Verificação de cada task:** `npm test` e `npm run typecheck`; o Task 8 roda tudo (`format:check`, `lint`, `typecheck`, `test`, `build`).

## Mapa de arquivos

| Arquivo | Papel |
| --- | --- |
| `src/shared/lib/class-filter.ts` (novo) | Tipo do filtro, leitura da URL, `inClass`, `byClass` |
| `src/shared/lib/class-filter.test.ts` (novo) | Testes do filtro |
| `src/shared/lib/tracing.ts` | `traced` passa os argumentos para `describe` |
| `src/shared/components/asset-class-control.tsx` (novo) | Seletor Geral/FIIs/Ações na URL |
| `src/features/portfolio/domain/snapshot.ts` | `scopeToClass` |
| `src/features/portfolio/server/snapshot.ts` | `getPortfolioSnapshot`, `getEvolution`, `getPeriodResults` com filtro |
| `src/features/portfolio/components/allocation-charts.tsx`, `summary-cards.tsx` | Esconder a categoria na visão Ações |
| `src/app/(app)/dashboard/page.tsx` | Lê `?classe=` |
| `src/features/portfolio/server/closed-positions-view.ts`, `src/app/(app)/encerradas/page.tsx`, `.../encerradas/ir/page.tsx` | Encerradas e IR com filtro |
| `src/features/transactions/domain/types.ts`, `.../b3-import/preview-sections.tsx` | `DIVIDEND_KIND_LABELS` compartilhado |
| `src/features/portfolio/domain/dividends.ts`, `types.ts` | `kind` no "a receber", `byKind`, `parseKindParam` |
| `src/features/portfolio/server/dividends-view.ts` | Filtro de classe e tipo |
| `src/features/portfolio/components/dividends/kind-select.tsx` (novo), `month-cards.tsx`, `dividends-history.tsx` | Seletor e soma por tipo |
| `src/app/(app)/proventos/page.tsx` | Lê `?classe=` e `?tipo=` |
| `src/features/portfolio/domain/reinvestment.ts`, `server/reinvestment-view.ts`, `components/reinvestment/reinvestment-cards.tsx`, `src/app/(app)/proventos/reinvestimento/page.tsx` | Rateio por classe |
| `src/app/(app)/transacoes/page.tsx`, `src/features/transactions/components/types.ts`, `transactions-table.tsx` | Classe em Transações |
| `CLAUDE.md`, `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md` | Docs |

---

### Task 1: Filtro de classe puro e `traced` com argumentos

**Goal:** o filtro de classe testado em `shared/lib` e `traced` capaz de pôr o filtro no span.

**Files:**
- Create: `src/shared/lib/class-filter.ts`
- Create: `src/shared/lib/class-filter.test.ts`
- Modify: `src/shared/lib/tracing.ts:71-82`

**Acceptance Criteria:**
- [ ] `parseClassParam("fiis")` → `"FII"`, `("acoes")` → `"ACAO"`, `undefined`/`""`/`"x"`/`"toString"` → `"TODOS"`, `["acoes","fiis"]` → `"ACAO"`.
- [ ] `byClass` com `"FII"` mantém tickers de classe `FII` e `null`; com `"ACAO"`, só `ACAO`; com `"TODOS"`, todos.
- [ ] `traced` chama `describe(result, ...args)`; os usos atuais compilam sem mudança.

**Verify:** `npx vitest run src/shared/lib/class-filter.test.ts` → todos passam; `npm run typecheck` → sem erros.

**Steps:**

- [ ] **Step 1: Escrever o teste**

```ts
// src/shared/lib/class-filter.test.ts
import { describe, expect, it } from "vitest";
import { byClass, inClass, parseClassParam } from "./class-filter";

describe("parseClassParam", () => {
  it("lê fiis e acoes", () => {
    expect(parseClassParam("fiis")).toBe("FII");
    expect(parseClassParam("acoes")).toBe("ACAO");
  });
  it("sem parâmetro ou desconhecido é Geral", () => {
    expect(parseClassParam(undefined)).toBe("TODOS");
    expect(parseClassParam(null)).toBe("TODOS");
    expect(parseClassParam("")).toBe("TODOS");
    expect(parseClassParam("FIIS")).toBe("TODOS");
    expect(parseClassParam("toString")).toBe("TODOS");
  });
  it("repetido na URL vale o primeiro", () => {
    expect(parseClassParam(["acoes", "fiis"])).toBe("ACAO");
  });
});

describe("byClass", () => {
  const classes = new Map<string, string | null>([
    ["AAAA11", "FII"],
    ["PETR4", "ACAO"],
    ["XXXX11", null],
  ]);
  const classOf = (ticker: string) => classes.get(ticker) ?? null;
  const items = [{ ticker: "AAAA11" }, { ticker: "PETR4" }, { ticker: "XXXX11" }];

  it("FIIs inclui a classe desconhecida, como o snapshot", () => {
    expect(byClass(items, classOf, "FII").map((item) => item.ticker)).toEqual(["AAAA11", "XXXX11"]);
  });
  it("Ações só traz ações", () => {
    expect(byClass(items, classOf, "ACAO").map((item) => item.ticker)).toEqual(["PETR4"]);
  });
  it("Geral traz tudo", () => {
    expect(byClass(items, classOf, "TODOS")).toHaveLength(3);
  });
  it("inClass segue a mesma regra", () => {
    expect(inClass("FII", null)).toBe(true);
    expect(inClass("ACAO", null)).toBe(false);
    expect(inClass("TODOS", "ACAO")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/shared/lib/class-filter.test.ts`
Expected: FAIL, módulo `./class-filter` não existe.

- [ ] **Step 3: Implementar**

```ts
// src/shared/lib/class-filter.ts
// Visões por classe (spec etapa 2 das ações, §4). Puro: serve ao servidor e ao cliente.

export type ClassFilter = "TODOS" | "FII" | "ACAO";

/** Valores de `?classe=` na URL; sem o parâmetro, a página mostra Geral. */
export const CLASS_PARAMS = ["fiis", "acoes"] as const;
export type ClassParam = (typeof CLASS_PARAMS)[number];

const FILTER_OF_PARAM: Record<ClassParam, ClassFilter> = { fiis: "FII", acoes: "ACAO" };

const isClassParam = (value: string): value is ClassParam =>
  (CLASS_PARAMS as readonly string[]).includes(value);

/** `?classe=` da URL. Ausente ou desconhecido cai em Geral; repetido, vale o primeiro. */
export function parseClassParam(value: string | readonly string[] | null | undefined): ClassFilter {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw && isClassParam(raw) ? FILTER_OF_PARAM[raw] : "TODOS";
}

/** A classe bate com o filtro. Classe desconhecida (null) conta como FII, como no snapshot. */
export function inClass(filter: ClassFilter, assetClass: string | null): boolean {
  if (filter === "TODOS") return true;
  return (filter === "ACAO") === (assetClass === "ACAO");
}

/** Os itens da classe do filtro; com "TODOS", todos. */
export function byClass<T extends { ticker: string }>(
  items: readonly T[],
  classOf: (ticker: string) => string | null,
  filter: ClassFilter,
): T[] {
  if (filter === "TODOS") return [...items];
  return items.filter((item) => inClass(filter, classOf(item.ticker)));
}
```

- [ ] **Step 4: `traced` passa os argumentos para `describe`**

Em `src/shared/lib/tracing.ts`, trocar o bloco de `traced` por:

```ts
/**
 * `fn` com um span `name` em volta. `describe` tira do resultado (e dos argumentos) os atributos
 * do span: só contagens e escolhas da tela, nunca valores da carteira.
 */
export function traced<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  describe: (result: R, ...args: A) => Attributes,
): (...args: A) => Promise<R> {
  return (...args) =>
    withSpan(name, {}, async (span) => {
      const result = await fn(...args);
      span.setAttributes(describe(result, ...args));
      return result;
    });
}
```

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/shared/lib/class-filter.test.ts && npm run typecheck`
Expected: PASS e sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/class-filter.ts src/shared/lib/class-filter.test.ts src/shared/lib/tracing.ts
git commit -m "feat(shared): add the asset class filter for the per-class views"
```

---

### Task 2: Seletor `AssetClassControl`

**Goal:** um controle Geral | FIIs | Ações que escreve `?classe=` e zera `?pagina=`.

**Files:**
- Create: `src/shared/components/asset-class-control.tsx`

**Acceptance Criteria:**
- [ ] Sem `?classe=`, o segmento "Geral" está marcado; escolher "FIIs" grava `?classe=fiis`, "Geral" remove o parâmetro.
- [ ] Toda troca remove `?pagina=`.
- [ ] Tem `<Suspense>` próprio com um espaço reservado da mesma altura (36 px, 44 px no toque).
- [ ] `shallow` é `false` por padrão; a prop `shallow` liga o modo só do cliente.

**Verify:** `npm run typecheck && npm run lint` → sem erros. (A tela é conferida nos Tasks 3 e 7.)

**Steps:**

- [ ] **Step 1: Criar o componente**

```tsx
// src/shared/components/asset-class-control.tsx
"use client";

import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Suspense } from "react";
import { CLASS_PARAMS } from "@/shared/lib/class-filter";
import { cn } from "@/shared/lib/utils";
import { SegmentedControl } from "@/shared/ui/segmented-control";

const OPTIONS = [
  { value: "geral", label: "Geral" },
  { value: "fiis", label: "FIIs" },
  { value: "acoes", label: "Ações" },
] as const;

type Props = {
  /** true: só o cliente filtra (Transações). Por padrão o servidor relê a página. */
  shallow?: boolean;
  className?: string;
};

/**
 * Visão Geral, FIIs ou Ações da página, em `?classe=` (spec etapa 2 das ações, §4). Cada página
 * tem a sua: abrir outra pelo menu começa em Geral. Trocar a classe volta as tabelas à página 1.
 */
export function AssetClassControl(props: Props) {
  return (
    // A URL só existe no navegador: fora do shell estático, com o mesmo tamanho reservado.
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={cn(
            "h-9 w-full rounded-full bg-secondary md:w-64 pointer-coarse:h-11",
            props.className,
          )}
        />
      }
    >
      <Control {...props} />
    </Suspense>
  );
}

function Control({ shallow = false, className }: Props) {
  const [{ classe }, setParams] = useQueryStates(
    { classe: parseAsStringLiteral(CLASS_PARAMS), pagina: parseAsInteger },
    { history: "replace", shallow },
  );
  return (
    <SegmentedControl
      label="Classe de ativo"
      value={classe ?? "geral"}
      options={OPTIONS}
      onChange={(next) =>
        void setParams({ classe: next === "geral" ? null : next, pagina: null })
      }
      className={cn("max-md:w-full md:min-w-64", className)}
    />
  );
}
```

- [ ] **Step 2: Conferir**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/asset-class-control.tsx
git commit -m "feat(shared): add the Geral/FIIs/Ações segmented control"
```

---

### Task 3: Dashboard por classe

**Goal:** o Dashboard inteiro (resumo, variação, evolução, aportes, alocação, posições e encerradas) na visão da URL.

**Files:**
- Modify: `src/features/portfolio/domain/snapshot.ts` (nova `scopeToClass`, perto de `buildSnapshot`)
- Modify: `src/features/portfolio/domain/snapshot.test.ts` (novo `describe`)
- Modify: `src/features/portfolio/server/snapshot.ts`
- Modify: `src/features/portfolio/index.ts` (exportar `scopeToClass`)
- Modify: `src/features/portfolio/components/allocation-charts.tsx`
- Modify: `src/features/portfolio/components/summary-cards.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] Teste: patrimônio, investido e proventos de FIIs + Ações = Geral.
- [ ] Teste: na visão FIIs e na visão Ações, os `share` de `allocation.byAsset` somam 1.
- [ ] Teste: na visão Ações, `strategy.rows`, `cascadeInput` e `alerts` vêm vazios.
- [ ] `getPortfolioSnapshot()` sem argumento dá o mesmo resultado de hoje (Carteira Alvo e Recomendações intactas).
- [ ] Os spans `view.portfolio-snapshot`, `view.evolution` e `view.period-results` têm `koinos.view.class_filter`.
- [ ] Na visão Ações, sem rosca de categoria, sem barra de composição e sem alertas.
- [ ] Visão sem nenhum ativo da classe (aberto ou encerrado): aviso "Nenhum FII na carteira" / "Nenhuma ação na carteira".

**Verify:** `npx vitest run src/features/portfolio/domain/snapshot.test.ts` → passa; `npm run typecheck` → sem erros; `npm run dev`, abrir `/dashboard?classe=acoes` e `/dashboard?classe=fiis`.

**Steps:**

- [ ] **Step 1: Teste do snapshot por classe**

No fim de `src/features/portfolio/domain/snapshot.test.ts` (o arquivo já tem `buy`, `target` e `quote`):

```ts
import { scopeToClass } from "./snapshot";
import type { ClassFilter } from "@/shared/lib/class-filter";
import type { DividendEntry } from "@/features/transactions";

describe("scopeToClass: visões Geral, FIIs e Ações", () => {
  const dividend = (ticker: string, amount: number): DividendEntry => ({
    ticker,
    paidAt: new Date(Date.UTC(2026, 5, 15)),
    kind: "RENDIMENTO",
    amount,
    quantity: null,
    perShare: null,
  });
  const input: SnapshotInput = {
    now: new Date(Date.UTC(2026, 9, 31)),
    transactions: [buy("AAAA11", 10), buy("BBBB11", 30), buy("PETR4", 20)],
    targets: [target("AAAA11", true, 50, 1), target("BBBB11", true, 50, 2)],
    dividends: [dividend("AAAA11", 5), dividend("PETR4", 7)],
    prices: new Map([
      ["AAAA11", quote],
      ["BBBB11", quote],
      ["PETR4", quote],
    ]),
    classes: new Map<string, AssetClass | null>([
      ["AAAA11", "FII"],
      ["BBBB11", "FII"],
      ["PETR4", "ACAO"],
    ]),
  };
  const view = (filter: ClassFilter) => buildSnapshot(scopeToClass(input, filter));

  it("FIIs + Ações somam o Geral", () => {
    const [all, fiis, stocks] = [view("TODOS"), view("FII"), view("ACAO")];
    for (const key of ["patrimony", "invested", "dividendsReceived"] as const) {
      expect(fiis.summary[key] + stocks.summary[key]).toBeCloseTo(all.summary[key], 6);
    }
  });

  it("o % de cada visão é sobre a classe", () => {
    for (const filter of ["FII", "ACAO"] as const) {
      const total = view(filter).allocation.byAsset.reduce((sum, slice) => sum + slice.share, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("a visão Ações não tem estratégia nem alertas", () => {
    const stocks = view("ACAO");
    expect(stocks.strategy.rows).toEqual([]);
    expect(stocks.cascadeInput).toEqual([]);
    expect(stocks.alerts).toEqual([]);
  });

  it("Geral devolve a entrada como veio", () => {
    expect(scopeToClass(input, "TODOS")).toBe(input);
  });
});
```

Junte os `import` ao topo do arquivo, ao lado dos que já existem.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/portfolio/domain/snapshot.test.ts`
Expected: FAIL, `scopeToClass` não é exportada.

- [ ] **Step 3: `scopeToClass`**

Em `src/features/portfolio/domain/snapshot.ts`, logo depois do tipo `SnapshotInput`:

```ts
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";

/**
 * A entrada do snapshot só com a classe pedida (spec etapa 2 das ações, §5). Ação nunca entra na
 * estratégia: na visão Ações, sem alvos, a Carteira Alvo e os alertas somem.
 */
export function scopeToClass(input: SnapshotInput, filter: ClassFilter): SnapshotInput {
  if (filter === "TODOS") return input;
  // A mesma regra do buildSnapshot: o que faltar no mapa sai pelo código.
  const classOf = (ticker: string) =>
    input.classes.has(ticker) ? (input.classes.get(ticker) ?? null) : assetClassOf(ticker, null);
  return {
    ...input,
    transactions: byClass(input.transactions, classOf, filter),
    dividends: byClass(input.dividends, classOf, filter),
    targets: filter === "ACAO" ? [] : input.targets,
  };
}
```

Em `src/features/portfolio/index.ts`: `export { buildSnapshot, scopeToClass } from "./domain/snapshot";`.

Run: `npx vitest run src/features/portfolio/domain/snapshot.test.ts` → PASS.

- [ ] **Step 4: Views com filtro**

Em `src/features/portfolio/server/snapshot.ts`:

1. Imports: `import { byClass, type ClassFilter } from "@/shared/lib/class-filter";` e `scopeToClass` junto de `buildSnapshot` (`import { buildSnapshot, scopeToClass } from "../domain/snapshot";`).
2. Trocar `export const getPortfolioSnapshot = cache(traced(...))` por:

```ts
const snapshotFor = cache(
  traced(
    "view.portfolio-snapshot",
    async (filter: ClassFilter): Promise<PortfolioSnapshot> => {
      await connection(); // usa a hora atual: só em tempo de requisição
      const [transactions, targets, dividends] = await Promise.all([
        getMyTransactions(),
        getMyTargetAssets(),
        getMyDividends(),
      ]);
      const tickers = [
        ...new Set([...transactions.map((t) => t.ticker), ...targets.map((t) => t.ticker)]),
      ];
      const [assets, classes] = await Promise.all([
        getAssetSnapshots(tickers),
        getAssetClasses(tickers),
      ]);
      return buildSnapshot(
        scopeToClass(
          {
            now: new Date(),
            transactions,
            targets,
            dividends,
            prices: toPriceInfo(assets),
            classes,
          },
          filter,
        ),
      );
    },
    (snapshot, filter) => ({
      "koinos.view.positions": snapshot.positions.length,
      "koinos.view.closed": snapshot.closed.length,
      "koinos.view.strategy_rows": snapshot.strategy.rows.length,
      "koinos.view.stale_quotes": snapshot.quotes.staleCount,
      "koinos.view.alerts": snapshot.alerts.length,
      "koinos.view.class_filter": filter,
    }),
  ),
);

/**
 * Visão consolidada da carteira do usuário logado (dashboard, Carteira Alvo, Recomendações), na
 * classe pedida. O `cache` é por argumento: a função normaliza o padrão para que `()` e
 * `("TODOS")` sejam a mesma consulta. O resultado é um DTO sem ids internos.
 */
export const getPortfolioSnapshot = (filter: ClassFilter = "TODOS") => snapshotFor(filter);

/** Os lançamentos da classe. Com "TODOS", nem lê o catálogo. */
async function transactionsOf(filter: ClassFilter) {
  const transactions = await getMyTransactions();
  if (filter === "TODOS") return transactions;
  const classes = await getAssetClasses(transactions.map((entry) => entry.ticker));
  return byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter);
}
```

3. Em `getEvolution` e `getPeriodResults`: assinatura `async (filter: ClassFilter = "TODOS")`, trocar `const transactions = await getMyTransactions();` por `const transactions = await transactionsOf(filter);`, e acrescentar ao `describe` o segundo parâmetro: `(points, filter = "TODOS") => ({ ..., "koinos.view.class_filter": filter })` (idem para `results`).

- [ ] **Step 5: Rosca e composição na visão Ações**

Em `src/features/portfolio/components/allocation-charts.tsx`:
- `Donut` ganha a prop `toggle = true` e renderiza o `SegmentedControl` só com `toggle`: `{toggle ? <SegmentedControl ... /> : null}`.
- `AllocationCharts` ganha `showCategory = true`:

```tsx
export function AllocationCharts({
  byCategory,
  byAsset,
  showCategory = true,
}: {
  byCategory: AllocationSlice[];
  byAsset: AllocationSlice[];
  /** Na visão Ações não há categoria (spec etapa 2, §6.1): fica só a rosca por ativo. */
  showCategory?: boolean;
}) {
  const [shown, setShown] = useState<Mode>("category");
  if (!showCategory) {
    return (
      <Donut
        title="Por ativo"
        description="Os 5 maiores e o restante em Outros"
        slices={byAsset}
        mode="asset"
        shown="asset"
        onShow={setShown}
        toggle={false}
      />
    );
  }
  return (/* o grid de hoje, sem mudança */);
}
```

Em `src/features/portfolio/components/summary-cards.tsx`, no `PatrimonyCard`, renderizar `<Composition ... />` só com `byCategory.length > 0`.

- [ ] **Step 6: Página**

Em `src/app/(app)/dashboard/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { getEvolution, getPeriodResults, getPortfolioSnapshot } from "@/features/portfolio/server";
import { /* os mesmos de hoje */ } from "@/features/portfolio/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton, DashboardSkeleton } from "@/shared/components/skeletons";
import { parseClassParam, type ClassFilter } from "@/shared/lib/class-filter";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";

type SearchParams = PageProps<"/dashboard">["searchParams"];

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da carteira."
        actions={
          <Suspense fallback={null}>
            <QuoteStatus searchParams={searchParams} />
          </Suspense>
        }
      />
      <AssetClassControl className="mb-4 md:mb-6" />
      {/* searchParams é dado da requisição: fica dentro de <Suspense>. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function filterOf(searchParams: SearchParams): Promise<ClassFilter> {
  return parseClassParam((await searchParams).classe);
}

async function QuoteStatus({ searchParams }: { searchParams: SearchParams }) {
  const { quotes } = await getPortfolioSnapshot(await filterOf(searchParams));
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const filter = await filterOf(searchParams);
  const snapshot = await getPortfolioSnapshot(filter);
  if (snapshot.positions.length === 0 && snapshot.closed.length === 0) {
    return filter === "TODOS" ? <EmptyPortfolio /> : <EmptyClass filter={filter} />;
  }

  return (
    <div className="grid gap-4 md:gap-6">
      <SummaryCards
        summary={snapshot.summary}
        byCategory={filter === "ACAO" ? [] : snapshot.allocation.byCategory}
      />
      <Suspense fallback={<CardSkeleton />}>
        <PeriodSection filter={filter} />
      </Suspense>
      {filter === "ACAO" ? null : <AlertsPanel alerts={snapshot.alerts} />}
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <EvolutionSection filter={filter} />
        </Suspense>
        <ContributionsChart data={snapshot.contributions} />
      </div>
      <AllocationCharts
        byCategory={snapshot.allocation.byCategory}
        byAsset={snapshot.allocation.byAsset}
        showCategory={filter !== "ACAO"}
      />
      <PositionsTable rows={snapshot.positions} />
      <ClosedPositions rows={snapshot.closed} />
    </div>
  );
}

/** Visão de uma classe sem nenhum ativo, aberto ou encerrado. */
function EmptyClass({ filter }: { filter: Exclude<ClassFilter, "TODOS"> }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{filter === "FII" ? "Nenhum FII na carteira" : "Nenhuma ação na carteira"}</EmptyTitle>
        <EmptyDescription>Escolha Geral para ver a carteira toda.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// Pode buscar histórico no Yahoo na primeira vez: fica no próprio Suspense para não segurar o resto.
async function EvolutionSection({ filter }: { filter: ClassFilter }) {
  return <EvolutionChart points={await getEvolution(filter)} />;
}

// Pode buscar fechamentos no Yahoo (no máximo a cada 12 h): também fica no próprio Suspense.
async function PeriodSection({ filter }: { filter: ClassFilter }) {
  return <PeriodResults results={await getPeriodResults(filter)} />;
}
```

Mantenha os demais trechos do arquivo como estão.

- [ ] **Step 7: Conferir**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo passa.
Abrir `npm run dev` → `/dashboard`, `/dashboard?classe=fiis`, `/dashboard?classe=acoes`: na de ações, só a rosca por ativo, sem barra de composição nem alertas; trocar o seletor recarrega os cartões. `/carteira-alvo` e `/recomendacoes` iguais a antes.

- [ ] **Step 8: Commit**

```bash
git add src/features/portfolio src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(portfolio): show the dashboard per asset class"
```

---

### Task 4: Encerradas e IR por classe

**Goal:** `/encerradas`, `/encerradas/ir` com o filtro, e o IR da ação igual em qualquer visão.

**Files:**
- Modify: `src/features/portfolio/server/closed-positions-view.ts`
- Modify: `src/features/portfolio/domain/closed-positions.test.ts`
- Modify: `src/app/(app)/encerradas/page.tsx`
- Modify: `src/app/(app)/encerradas/ir/page.tsx`

**Acceptance Criteria:**
- [ ] Teste: o IR e o `taxExempt` de uma ação são iguais com o razão de ações e com o razão todo, num mês acima e num abaixo de R$ 20 mil.
- [ ] As duas páginas leem `?classe=` e mostram o `AssetClassControl`.
- [ ] Descrição de `/encerradas`: "Os ativos com posição zerada: o custo, o vendido e o resultado das vendas."
- [ ] Span `view.closed-positions` com `koinos.view.class_filter`.

**Verify:** `npx vitest run src/features/portfolio/domain/closed-positions.test.ts` → passa; `/encerradas?classe=acoes` e `/encerradas/ir?classe=acoes` no dev.

**Steps:**

- [ ] **Step 1: Teste**

No fim de `closed-positions.test.ts` (usa `entry`, `classes` e `closedPositions` do arquivo):

```ts
import { byClass } from "@/shared/lib/class-filter";

describe("closedPositions: visão Ações", () => {
  const classOf = (ticker: string) => classes.get(ticker) ?? null;
  const ledger = [
    entry("AAAA11", "BUY", 100, 10, "2026-01-05"),
    entry("AAAA11", "SELL", 100, 12, "2026-03-10"),
    // Março: R$ 25.000 em vendas de ações, acima da isenção.
    entry("PETR4", "BUY", 1000, 20, "2026-01-05"),
    entry("PETR4", "SELL", 1000, 25, "2026-03-10"),
    // Junho: R$ 5.000, isento.
    entry("VALE3", "BUY", 100, 40, "2026-01-05"),
    entry("VALE3", "SELL", 100, 50, "2026-06-10"),
  ];

  it("o IR de cada ação é o mesmo com o razão de ações e com o razão todo", () => {
    const all = closedPositions(ledger, classes);
    const stocks = closedPositions(byClass(ledger, classOf, "ACAO"), classes);
    for (const ticker of ["PETR4", "VALE3"]) {
      const a = all.find((row) => row.ticker === ticker)!;
      const b = stocks.find((row) => row.ticker === ticker)!;
      expect(b.estimatedTax).toBeCloseTo(a.estimatedTax, 6);
      expect(b.taxExempt).toBe(a.taxExempt);
    }
    expect(stocks.map((row) => row.ticker).sort()).toEqual(["PETR4", "VALE3"]);
  });
});
```

Se os campos do `ClosedPosition` tiverem outros nomes, use os de `portfolio/domain/types.ts` (`estimatedTax`, `taxExempt`).

Run: `npx vitest run src/features/portfolio/domain/closed-positions.test.ts` → PASS (o comportamento já existe; o teste trava a regra).

- [ ] **Step 2: View**

`src/features/portfolio/server/closed-positions-view.ts`:

```ts
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";

export const getClosedPositionsView = traced(
  "view.closed-positions",
  async (filter: ClassFilter = "TODOS"): Promise<ClosedPositionsView> => {
    const transactions = await getMyTransactions();
    const classes = await getAssetClasses(transactions.map((entry) => entry.ticker));
    // Na visão Ações, o razão ainda tem todas as vendas de ações: a isenção do mês não muda.
    const scoped = byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter);
    const rows = closedPositions(scoped, classes);
    // ... resto igual
  },
  (view, filter = "TODOS") => ({
    "koinos.view.closed": view.rows.length,
    "koinos.view.class_filter": filter,
  }),
);
```

- [ ] **Step 3: Páginas**

Nas duas páginas, seguir o padrão do Reinvestimento (`searchParams` dentro do `<Suspense>`):

```tsx
export default function ClosedPositionsPage({ searchParams }: PageProps<"/encerradas">) {
  return (
    <>
      <PageHeader
        title="Posições encerradas"
        description="Os ativos com posição zerada: o custo, o vendido e o resultado das vendas."
        actions={/* igual */}
        mobileActions={false}
      />
      <AssetClassControl className="mb-6" />
      <Suspense fallback={<ClosedPositionsSkeleton />}>
        <ClosedPositionsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClosedPositionsContent({
  searchParams,
}: Pick<PageProps<"/encerradas">, "searchParams">) {
  const view = await getClosedPositionsView(parseClassParam((await searchParams).classe));
  // ... igual
}
```

Em `/encerradas/ir/page.tsx`, o mesmo com `PageProps<"/encerradas/ir">`, `ClosedTaxContent`.

- [ ] **Step 4: Conferir e commit**

Run: `npm test && npm run typecheck && npm run lint` → passa.

```bash
git add src/features/portfolio src/app/\(app\)/encerradas
git commit -m "feat(portfolio): filter closed positions and the tax by asset class"
```

---

### Task 5: Proventos por classe e por tipo

**Goal:** `/proventos` com `?classe=` e `?tipo=`, e a soma por tipo no mês e no ano.

**Files:**
- Modify: `src/features/transactions/domain/types.ts` (`DIVIDEND_KIND_LABELS`), `src/features/transactions/index.ts` (exportar)
- Modify: `src/features/transactions/components/b3-import/preview-sections.tsx:30-36` (usar o compartilhado)
- Modify: `src/features/portfolio/domain/types.ts` (`UpcomingDividend.kind`, `KindAmount`, `byKind`)
- Modify: `src/features/portfolio/domain/dividends.ts` (`kind` no "a receber", `sumByKind`, `byKind`, `parseKindParam`)
- Create: `src/features/portfolio/domain/dividends.test.ts`
- Modify: `src/features/portfolio/server/dividends-view.ts`
- Create: `src/features/portfolio/components/dividends/kind-select.tsx`
- Modify: `src/features/portfolio/ui.ts` (exportar `DividendKindSelect`)
- Modify: `src/features/portfolio/components/dividends/month-cards.tsx`, `dividends-history.tsx`
- Modify: `src/app/(app)/proventos/page.tsx`

**Acceptance Criteria:**
- [ ] Teste: `parseKindParam("jcp")` → `"JCP"`, `("x")`/`undefined` → `null`.
- [ ] Teste: `upcomingDividends` marca B3 com o tipo do extrato e Yahoo como `RENDIMENTO`.
- [ ] Teste: `monthSummary(...).byKind` soma recebidos e "a receber" contados no mês, por tipo, só tipos com valor, na ordem de `DIVIDEND_KINDS`; `groupByYear` traz `byKind` por ano.
- [ ] View: com `kind` diferente de `RENDIMENTO`, sem Yahoo e sem "não divulgado"; `imported` olha a carteira toda.
- [ ] Na visão Ações, o "a receber" só tem itens da B3.
- [ ] O card "Total do mês" lista os tipos quando há mais de um; a tabela por ano mostra a quebra numa linha de rodapé.
- [ ] Span `view.dividends` com `koinos.view.class_filter` e `koinos.view.kind_filter` (o tipo ou `TODOS`).

**Verify:** `npx vitest run src/features/portfolio/domain/dividends.test.ts` → passa; `/proventos?classe=acoes&tipo=jcp` no dev.

**Steps:**

- [ ] **Step 1: Rótulos compartilhados**

Em `src/features/transactions/domain/types.ts`, depois de `DividendKind`:

```ts
/** Nome de cada tipo de provento na tela. */
export const DIVIDEND_KIND_LABELS: Record<DividendKind, string> = {
  RENDIMENTO: "Rendimento",
  REEMBOLSO: "Reembolso",
  DIVIDENDO: "Dividendo",
  JCP: "JCP",
  ALUGUEL: "Aluguel",
};
```

Exportar em `src/features/transactions/index.ts` (junto de `DIVIDEND_KINDS`). Em `preview-sections.tsx`, apagar o `DIVIDEND_LABELS` local e usar `DIVIDEND_KIND_LABELS` (importado da mesma origem dos outros tipos de domínio do arquivo, por import relativo `../../domain/types`).

- [ ] **Step 2: Testes do domínio**

```ts
// src/features/portfolio/domain/dividends.test.ts
import { describe, expect, it } from "vitest";
import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { groupByYear, monthSummary, parseKindParam, upcomingDividends } from "./dividends";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paid = (ticker: string, kind: DividendEntry["kind"], amount: number, iso: string): DividendEntry => ({
  ticker,
  paidAt: at(iso),
  kind,
  amount,
  quantity: null,
  perShare: null,
});
const buy: LedgerEntry = {
  id: "b1",
  ticker: "AAAA11",
  type: "BUY",
  quantity: 100,
  unitPrice: 10,
  fees: 0,
  date: at("2026-01-05"),
  createdAt: at("2026-01-05"),
};
const now = new Date("2026-10-20T15:00:00Z");

describe("parseKindParam", () => {
  it("lê o tipo em minúsculas", () => {
    expect(parseKindParam("jcp")).toBe("JCP");
    expect(parseKindParam("aluguel")).toBe("ALUGUEL");
  });
  it("desconhecido ou ausente é todos os tipos", () => {
    expect(parseKindParam("x")).toBeNull();
    expect(parseKindParam(undefined)).toBeNull();
    expect(parseKindParam(["dividendo"])).toBe("DIVIDENDO");
  });
});

describe("upcomingDividends: tipo", () => {
  it("B3 traz o tipo do extrato e o Yahoo conta como Rendimento", () => {
    const upcoming = upcomingDividends({
      now,
      transactions: [buy],
      received: [],
      announcements: new Map([["AAAA11", [{ exDate: at("2026-10-15"), perShare: 0.1 }]]]),
      forecast: {
        asOf: at("2026-10-01"),
        items: [
          { ticker: "PETR4", kind: "JCP", payDate: at("2026-10-25"), quantity: 100, perShare: 0.5, amount: 42.5 },
        ],
      },
    });
    expect(upcoming.find((item) => item.ticker === "PETR4")?.kind).toBe("JCP");
    expect(upcoming.find((item) => item.ticker === "AAAA11")?.kind).toBe("RENDIMENTO");
  });
});

describe("byKind", () => {
  it("o mês soma recebidos e a receber por tipo, na ordem dos tipos", () => {
    const summary = monthSummary(
      now,
      [paid("AAAA11", "RENDIMENTO", 10, "2026-10-14"), paid("PETR4", "JCP", 5, "2026-10-02")],
      [
        { ticker: "PETR4", kind: "DIVIDENDO", exDate: null, quantity: 1, perShare: 3, amount: 3, payBy: at("2026-10-28"), source: "B3" },
      ],
    );
    expect(summary.byKind).toEqual([
      { kind: "RENDIMENTO", amount: 10 },
      { kind: "DIVIDENDO", amount: 3 },
      { kind: "JCP", amount: 5 },
    ]);
  });

  it("o ano traz a soma por tipo", () => {
    const [year] = groupByYear([
      paid("AAAA11", "RENDIMENTO", 10, "2026-03-14"),
      paid("PETR4", "ALUGUEL", 2, "2026-04-02"),
      paid("AAAA11", "RENDIMENTO", 10, "2026-04-14"),
    ]);
    expect(year!.byKind).toEqual([
      { kind: "RENDIMENTO", amount: 20 },
      { kind: "ALUGUEL", amount: 2 },
    ]);
  });
});
```

Run: `npx vitest run src/features/portfolio/domain/dividends.test.ts` → FAIL (`parseKindParam`, `kind`, `byKind` não existem).

- [ ] **Step 3: Tipos**

Em `src/features/portfolio/domain/types.ts`:
- importar `DividendKind` de `@/features/transactions`;
- `export type KindAmount = { kind: DividendKind; amount: number };`
- `UpcomingDividend`: novo campo `kind: DividendKind;` com o comentário `/** Tipo do provento: o do extrato da B3; no anúncio do Yahoo, sempre Rendimento. */`;
- `DividendMonthSummary` e `DividendYearGroup`: novo campo `byKind: KindAmount[];` (`/** Soma por tipo, só os tipos com valor, na ordem de DIVIDEND_KINDS. */`).

- [ ] **Step 4: Domínio**

Em `src/features/portfolio/domain/dividends.ts`:

```ts
import { DIVIDEND_KINDS, type DividendKind } from "@/features/transactions";
import type { KindAmount } from "./types";

/** `?tipo=` da URL (rendimento, jcp…). Ausente ou desconhecido: todos os tipos. */
export function parseKindParam(value: string | readonly string[] | null | undefined): DividendKind | null {
  const raw = (typeof value === "string" ? value : value?.[0])?.toUpperCase();
  return DIVIDEND_KINDS.find((kind) => kind === raw) ?? null;
}

/** Soma por tipo, na ordem de DIVIDEND_KINDS, só os tipos com valor. */
export function sumByKind(items: readonly { kind: DividendKind; amount: number }[]): KindAmount[] {
  const sums = new Map<DividendKind, number>();
  for (const item of items) sums.set(item.kind, (sums.get(item.kind) ?? 0) + item.amount);
  return DIVIDEND_KINDS.filter((kind) => Math.abs(sums.get(kind) ?? 0) >= 0.005).map((kind) => ({
    kind,
    amount: sums.get(kind)!,
  }));
}
```

- `upcomingDividends`: no item da B3, `kind: item.kind`; no do Yahoo, `kind: "RENDIMENTO"`.
- `monthSummary`: guardar os dois filtros em constantes (`monthReceived`, `monthUpcoming`) e devolver também `byKind: sumByKind([...monthReceived, ...monthUpcoming])`.
- `groupByYear`: guardar os itens de cada ano (`items: DividendEntry[]` no acumulador) e devolver `byKind: sumByKind(group.items)`.
- Exportar `parseKindParam` e `sumByKind` em `src/features/portfolio/index.ts`.

Run: `npx vitest run src/features/portfolio/domain/dividends.test.ts` → PASS.

- [ ] **Step 5: View**

Em `src/features/portfolio/server/dividends-view.ts`:

```ts
import type { DividendKind } from "@/features/transactions";
import { inClass, type ClassFilter } from "@/shared/lib/class-filter";

export const getDividendsView = traced(
  "view.dividends",
  async (filter: ClassFilter = "TODOS", kind: DividendKind | null = null): Promise<DividendsView> => {
    await connection();
    const now = new Date();
    const [transactions, allReceived, allForecast] = await Promise.all([
      getMyTransactions(),
      getMyDividends(),
      getMyDividendForecast(),
    ]);
    const tickers = [
      ...new Set([
        ...transactions.map((entry) => entry.ticker),
        ...allReceived.map((item) => item.ticker),
        ...(allForecast?.items ?? []).map((item) => item.ticker),
      ]),
    ];
    const [assets, classes] = await Promise.all([getAssetSnapshots(tickers), getAssetClasses(tickers)]);
    const isFiiLike = (ticker: string) => classes.get(ticker) !== "ACAO";
    const ofClass = (ticker: string) => inClass(filter, classes.get(ticker) ?? null);
    const ofKind = (itemKind: DividendKind) => kind === null || itemKind === kind;
    // A conferência de "já pago" do Yahoo e o "não divulgado" olham todos os tipos da classe:
    // um FII alugado recebe Reembolso no lugar do Rendimento.
    const classReceived = allReceived.filter((item) => ofClass(item.ticker));
    const received = classReceived.filter((item) => ofKind(item.kind));
    const forecast = allForecast && {
      ...allForecast,
      items: allForecast.items.filter((item) => ofClass(item.ticker) && ofKind(item.kind)),
    };
    // A estimativa do Yahoo e o "não divulgado" são só de FIIs e só de Rendimento (spec etapa 2, §6.2).
    const withYahoo = kind === null || kind === "RENDIMENTO";
    const announcements = new Map(
      [...assets]
        .filter(([ticker]) => withYahoo && isFiiLike(ticker) && ofClass(ticker))
        .map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
    );
    const upcoming = upcomingDividends({ now, transactions, received: classReceived, announcements, forecast });
    const undisclosed = withYahoo
      ? undisclosedDividends({
          now,
          transactions,
          received: classReceived.filter((item) => isFiiLike(item.ticker)),
          announcements,
          upcoming,
        })
      : [];
    // ... daqui para baixo igual, usando `received` (classe + tipo), com duas trocas:
    //   imported: allReceived.length > 0,
    //   (o resto lê `received`, `upcoming` e `undisclosed` como hoje)
  },
  (view, filter = "TODOS", kind = null) => ({
    "koinos.view.upcoming": view.upcoming.length,
    "koinos.view.undisclosed": view.undisclosed.length,
    "koinos.view.months": view.byMonth.length,
    "koinos.view.fiis": view.byTicker.length,
    "koinos.view.class_filter": filter,
    "koinos.view.kind_filter": kind ?? "TODOS",
  }),
);
```

`undisclosedDividends` hoje recebe os anúncios e o `upcoming`: o resultado já sai só da classe porque `classReceived` e `announcements` estão filtrados; na visão Ações, `isFiiLike` zera a lista.

- [ ] **Step 6: Seletor de tipo**

```tsx
// src/features/portfolio/components/dividends/kind-select.tsx
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense } from "react";
import { DIVIDEND_KIND_LABELS, DIVIDEND_KINDS } from "@/features/transactions";
import { NativeSelect } from "@/shared/ui/native-select";

const KIND_PARAMS = DIVIDEND_KINDS.map((kind) => kind.toLowerCase()) as Lowercase<
  (typeof DIVIDEND_KINDS)[number]
>[];

/** Tipo de provento da página, em `?tipo=` (spec etapa 2, §6.2). O servidor relê a página. */
export function DividendKindSelect() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-9 w-44 rounded-lg bg-secondary pointer-coarse:h-11" />}>
      <KindSelect />
    </Suspense>
  );
}

function KindSelect() {
  const [kind, setKind] = useQueryState(
    "tipo",
    parseAsStringLiteral(KIND_PARAMS).withOptions({ history: "replace", shallow: false }),
  );
  return (
    <NativeSelect
      aria-label="Tipo de provento"
      value={kind ?? ""}
      onChange={(event) =>
        void setKind(event.target.value === "" ? null : (event.target.value as (typeof KIND_PARAMS)[number]))
      }
      wrapperClassName="max-md:w-full"
      className="max-md:w-full"
    >
      <option value="">Todos os tipos</option>
      {DIVIDEND_KINDS.map((item) => (
        <option key={item} value={item.toLowerCase()}>
          {DIVIDEND_KIND_LABELS[item]}
        </option>
      ))}
    </NativeSelect>
  );
}
```

Exportar em `src/features/portfolio/ui.ts`: `export { DividendKindSelect } from "./components/dividends/kind-select";`.

- [ ] **Step 7: Soma por tipo na tela**

- `month-cards.tsx`: no card "Total do mês", depois do conteúdo que já existe, quando `month.byKind.length > 1`:

```tsx
<StatList>
  {month.byKind.map((item) => (
    <StatRow
      key={item.kind}
      label={DIVIDEND_KIND_LABELS[item.kind]}
      value={<Sensitive>{formatBRL(item.amount)}</Sensitive>}
    />
  ))}
</StatList>
```

(importar `DIVIDEND_KIND_LABELS` de `@/features/transactions`).
- `dividends-history.tsx`, `ByYear`: na célula do total de cada ano (e na linha do ano na lista do celular), quando `row.byKind.length > 1`, acrescentar abaixo do valor:

```tsx
<span className="block text-footnote text-muted-foreground">
  {row.byKind.map((item) => `${DIVIDEND_KIND_LABELS[item.kind]} ${formatBRL(item.amount)}`).join(" · ")}
</span>
```

dentro de `<Sensitive>` (são valores da carteira).

- [ ] **Step 8: Página**

`src/app/(app)/proventos/page.tsx`:

```tsx
export default function DividendsPage({ searchParams }: PageProps<"/proventos">) {
  return (
    <>
      <PageHeader /* igual */ />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AssetClassControl />
        <DividendKindSelect />
      </div>
      <Suspense fallback={<DividendsSkeleton />}>
        <DividendsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DividendsContent({ searchParams }: Pick<PageProps<"/proventos">, "searchParams">) {
  const params = await searchParams;
  const view = await getDividendsView(parseClassParam(params.classe), parseKindParam(params.tipo));
  // ... igual
}
```

(`parseKindParam` de `@/features/portfolio`, `parseClassParam` de `@/shared/lib/class-filter`, `DividendKindSelect` de `@/features/portfolio/ui`.)

- [ ] **Step 9: Conferir e commit**

Run: `npm test && npm run typecheck && npm run lint` → passa.
Dev: `/proventos?classe=acoes` (só B3 no "a receber"), `/proventos?tipo=aluguel`, `/proventos?classe=fiis&tipo=rendimento`.

```bash
git add src/features/transactions src/features/portfolio src/app/\(app\)/proventos/page.tsx
git commit -m "feat(portfolio): filter dividends by asset class and kind"
```

---

### Task 6: Reinvestimento por classe

**Goal:** `/proventos/reinvestimento` com o rateio do "de proventos" pela classe.

**Files:**
- Modify: `src/features/portfolio/domain/reinvestment.ts` (`shareReinvestment`)
- Create: `src/features/portfolio/domain/reinvestment.test.ts`
- Modify: `src/features/portfolio/domain/types.ts` (`ReinvestmentView.currentClass`)
- Modify: `src/features/portfolio/index.ts` (exportar)
- Modify: `src/features/portfolio/server/reinvestment-view.ts`
- Modify: `src/features/portfolio/components/reinvestment/reinvestment-cards.tsx`
- Modify: `src/app/(app)/proventos/reinvestimento/page.tsx`

**Acceptance Criteria:**
- [ ] Teste: FIIs + Ações = total no aporte, no "de proventos" e no "do bolso".
- [ ] Teste: classe sem compra no mês → aporte 0, "de proventos" 0, `dividendsShare` null; aporte total 0 → 0.
- [ ] Teste: `unspent` da classe é 0.
- [ ] Na visão por classe: lista de compras só da classe; card com "Proventos da carteira"; prévia da % usa o rateio; salvar continua mandando só `{ month, percent }`.
- [ ] Span `view.reinvestment` com `koinos.view.class_filter`.

**Verify:** `npx vitest run src/features/portfolio/domain/reinvestment.test.ts` → passa; `/proventos/reinvestimento?classe=fiis` no dev.

**Steps:**

- [ ] **Step 1: Teste**

```ts
// src/features/portfolio/domain/reinvestment.test.ts
import { describe, expect, it } from "vitest";
import { shareReinvestment, splitAporte } from "./reinvestment";
import type { ReinvestmentMonth } from "./types";

const total = (aporte: number, dividends: number, percent = 100): ReinvestmentMonth => ({
  month: "2026-10",
  aporte,
  purchaseCount: 3,
  dividends,
  percent,
  isDefault: false,
  ...splitAporte(aporte, dividends, percent),
});

describe("shareReinvestment: rateio por classe", () => {
  it("FIIs + Ações somam o total", () => {
    const month = total(1000, 600);
    const fiis = shareReinvestment(month, { aporte: 700, purchaseCount: 2 });
    const stocks = shareReinvestment(month, { aporte: 300, purchaseCount: 1 });
    expect(fiis.aporte + stocks.aporte).toBeCloseTo(month.aporte, 6);
    expect(fiis.fromDividends + stocks.fromDividends).toBeCloseTo(month.fromDividends, 6);
    expect(fiis.fromPocket + stocks.fromPocket).toBeCloseTo(month.fromPocket, 6);
    expect(fiis.fromDividends).toBeCloseTo(420, 6);
  });

  it("classe sem compra no mês fica zerada", () => {
    const share = shareReinvestment(total(1000, 600), { aporte: 0, purchaseCount: 0 });
    expect(share.fromDividends).toBe(0);
    expect(share.fromPocket).toBe(0);
    expect(share.dividendsShare).toBeNull();
  });

  it("mês sem compra nenhuma fica zerado", () => {
    const share = shareReinvestment(total(0, 600), { aporte: 0, purchaseCount: 0 });
    expect(share.fromDividends).toBe(0);
  });

  it("o não gasto é da carteira: na classe, zero", () => {
    expect(shareReinvestment(total(100, 600), { aporte: 100, purchaseCount: 1 }).unspent).toBe(0);
  });
});
```

Run → FAIL (`shareReinvestment` não existe).

- [ ] **Step 2: Domínio**

Em `src/features/portfolio/domain/reinvestment.ts`, depois de `splitAporte`:

```ts
/**
 * A parte de uma classe no mês (spec etapa 2 das ações, §6.4). A conta continua sobre a carteira
 * toda; o "de proventos" é rateado pelo aporte da classe. O "não gasto" é da carteira: fica zero.
 */
export function shareReinvestment(
  total: ReinvestmentMonth,
  own: { aporte: number; purchaseCount: number },
): ReinvestmentMonth {
  const fromDividends = total.aporte > 0 ? (total.fromDividends * own.aporte) / total.aporte : 0;
  return {
    ...total,
    aporte: own.aporte,
    purchaseCount: own.purchaseCount,
    fromDividends,
    fromPocket: own.aporte - fromDividends,
    unspent: 0,
    dividendsShare: own.aporte > 0 ? fromDividends / own.aporte : null,
  };
}
```

Importar `ReinvestmentMonth` em `./types` (junto dos que já vêm de lá) e exportar `shareReinvestment` em `src/features/portfolio/index.ts`.

Em `types.ts`, `ReinvestmentView` ganha:

```ts
  /** Aporte e compras da classe no mês escolhido; null em Geral. A prévia da % rateia por ele. */
  currentClass: { aporte: number; purchaseCount: number } | null;
```

Run → PASS.

- [ ] **Step 3: View**

`src/features/portfolio/server/reinvestment-view.ts`:

```ts
import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";
import { /* os de hoje */, shareReinvestment } from "../domain/reinvestment";

export const getReinvestmentView = traced(
  "view.reinvestment",
  async (requested: string | null, filter: ClassFilter = "TODOS"): Promise<ReinvestmentView> => {
    const tenant = await getTenant();
    const nowMonth = currentMonthKey(new Date());
    const month = requested && isReportMonth(requested, nowMonth) ? requested : nowMonth;
    const [transactions, received, percents] = await Promise.all([
      getMyTransactions(),
      getMyDividends(),
      listReinvestmentPercents(tenant.portfolioId),
    ]);
    const classes =
      filter === "TODOS" ? null : await getAssetClasses(transactions.map((entry) => entry.ticker));
    const own = classes
      ? byClass(transactions, (ticker) => classes.get(ticker) ?? null, filter)
      : transactions;
    // Cada mês: a conta da carteira toda e, numa classe, a parte dela (rateio pelo aporte).
    const scoped = (months: string[]) => {
      const totals = reinvestmentHistory({ transactions, received, percents, months });
      if (!classes) return totals;
      const mine = reinvestmentHistory({ transactions: own, received: [], percents, months });
      return totals.map((total, index) => shareReinvestment(total, mine[index]!));
    };
    const purchases = monthPurchases(own, month);
    const assets = await getAssetSnapshots([...new Set(purchases.map((item) => item.ticker))]);
    const history = scoped(monthRange(addMonths(nowMonth, -(HISTORY_MONTHS - 1)), nowMonth));
    // `current` é o mês da carteira toda: a prévia da % refaz a conta no cliente e rateia.
    const [current] = reinvestmentHistory({ transactions, received, percents, months: [month] });
    const [mine] = classes
      ? reinvestmentHistory({ transactions: own, received: [], percents, months: [month] })
      : [];
    return {
      month,
      months: reinvestmentMonths(transactions, received, nowMonth, month),
      current: current!,
      currentClass: mine ? { aporte: mine.aporte, purchaseCount: mine.purchaseCount } : null,
      purchases: purchases.map((item) => ({
        ...item,
        name: assets.get(item.ticker)?.name ?? null,
        logoUrl: assets.get(item.ticker)?.logoUrl ?? null,
      })),
      history,
      last12: summarizeReinvestment(history.slice(-12)),
    };
  },
  (view, _requested, filter = "TODOS") => ({
    "koinos.view.purchases": view.purchases.length,
    "koinos.view.months": view.months.length,
    "koinos.view.class_filter": filter,
  }),
);
```

- [ ] **Step 4: Card**

Em `reinvestment-cards.tsx`:
- a prop `currentClass: ReinvestmentView["currentClass"]` entra junto de `current`;
- trocar `const split = splitAporte(current.aporte, current.dividends, percent);` por:

```ts
  const whole = { ...current, percent, ...splitAporte(current.aporte, current.dividends, percent) };
  // Numa classe, o "de proventos" é a parte dela no rateio do mês (spec etapa 2, §6.4).
  const shown = currentClass ? shareReinvestment(whole, currentClass) : whole;
  const split = shown;
```

- onde o card lê `current.aporte` e `current.purchaseCount` para mostrar, usar `shown.aporte` e `shown.purchaseCount` (linhas ~55, 59, 85, 100, 104, 174);
- o rótulo da linha de `current.dividends` (linhas ~83 e 111) vira `currentClass ? "Proventos da carteira" : <o rótulo de hoje>`;
- o "não gasto" (`split.unspent > 0.005`) some sozinho na classe, porque `unspent` é 0;
- `save.execute({ month: current.month, percent })` fica como está.

Importar `shareReinvestment` de `../../domain/reinvestment` e `ReinvestmentView` de `../../domain/types`.

- [ ] **Step 5: Página**

`src/app/(app)/proventos/reinvestimento/page.tsx`:
- `<AssetClassControl className="mb-6" />` entre o `PageHeader` e o `<Suspense>`;
- em `ReinvestmentContent`: `getReinvestmentView(typeof params.mes === "string" ? params.mes : null, parseClassParam(params.classe))`;
- `<ReinvestmentCards key={view.month} current={view.current} currentClass={view.currentClass} />`; a `key` vira `` `${view.month}|${view.currentClass ? "c" : "g"}` `` para a prévia recomeçar ao trocar de visão.

- [ ] **Step 6: Conferir e commit**

Run: `npm test && npm run typecheck && npm run lint` → passa.

```bash
git add src/features/portfolio src/app/\(app\)/proventos/reinvestimento/page.tsx
git commit -m "feat(portfolio): split reinvestment by asset class"
```

---

### Task 7: Transações por classe

**Goal:** a lista de Transações filtrada por classe no cliente.

**Files:**
- Modify: `src/features/transactions/components/types.ts`
- Modify: `src/app/(app)/transacoes/page.tsx`
- Modify: `src/features/transactions/components/transactions-table.tsx`

**Acceptance Criteria:**
- [ ] Cada `TransactionRow` traz `assetClass` (`"FII" | "ACAO" | null`).
- [ ] `/transacoes?classe=acoes` mostra só ações; a contagem "X de Y lançamentos" considera a classe.
- [ ] Trocar a classe volta à página 1 e reinicia a lista do celular.
- [ ] O seletor usa `shallow` (não refaz a página no servidor).

**Verify:** `npm run typecheck && npm run lint` → sem erros; `/transacoes?classe=acoes` no dev.

**Steps:**

- [ ] **Step 1: Tipo**

Em `src/features/transactions/components/types.ts`, `TransactionRow` ganha:

```ts
  /** Classe pelo catálogo (null: fundo fora das classes; conta como FII no filtro). */
  assetClass: AssetClass | null;
```

com `import type { AssetClass } from "@/features/market-data";`.

- [ ] **Step 2: Página**

`src/app/(app)/transacoes/page.tsx`:

```tsx
import { getAssetClasses } from "@/features/market-data/server";
import { AssetClassControl } from "@/shared/components/asset-class-control";

// No JSX da página, entre o PageHeader e o <Suspense>:
//   <AssetClassControl shallow className="mb-6" />

async function TransactionsContent() {
  const transactions = await getMyTransactions();
  const classes = await getAssetClasses(transactions.map((transaction) => transaction.ticker));
  // DTO mínimo: só o que a tela usa.
  const rows: TransactionRow[] = transactions.map((transaction) => ({
    // ... os campos de hoje
    assetClass: classes.get(transaction.ticker) ?? null,
  }));
  return <TransactionsTable rows={rows} />;
}
```

- [ ] **Step 3: Tabela**

Em `transactions-table.tsx`:
- import: `import { CLASS_PARAMS, inClass, parseClassParam } from "@/shared/lib/class-filter";`;
- em `useQueryStates`, acrescentar `classe: parseAsStringLiteral(CLASS_PARAMS),`;
- `const classFilter = parseClassParam(filters.classe);`
- no `rows.filter`, acrescentar `inClass(classFilter, row.assetClass) &&` como primeira condição;
- a `key` do `TransactionsList` ganha `${classFilter}|` no começo.

O `AssetClassControl` já zera `pagina`; a tabela continua lendo o mesmo `?classe=`.

- [ ] **Step 4: Conferir e commit**

Run: `npm run typecheck && npm run lint && npm test` → passa.

```bash
git add src/features/transactions src/app/\(app\)/transacoes/page.tsx
git commit -m "feat(transactions): filter the ledger by asset class"
```

---

### Task 8: Docs, verificação completa e conferência com os dados reais

**Goal:** CLAUDE.md e spec da etapa 1 atualizados, todas as checagens verdes e o critério 1 do spec conferido com os dados de produção, só lendo.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md` (§12)
- Modify: `docs/superpowers/specs/2026-10-31-acoes-etapa-2-design.md` (status)
- Create (fora do repositório, não commitar): `$SCRATCH/check-etapa-2.ts`

**Acceptance Criteria:**
- [ ] CLAUDE.md: em Rendering, `?classe=` e `?tipo=` na lista do `nuqs`; em Pages, o filtro de classe em Dashboard, Proventos, Encerradas/IR, Reinvestimento e Transações; em Domain flow, `scopeToClass`, o rateio do reinvestimento e a soma por tipo; na lista de testes, `shared/lib/class-filter.test.ts`, `portfolio/domain/dividends.test.ts` e `portfolio/domain/reinvestment.test.ts`; em Observabilidade, `koinos.view.class_filter` e `koinos.view.kind_filter`; em Product rules, "Stage 2 … gets its own spec" passa a apontar para `2026-10-31-acoes-etapa-2-design.md`.
- [ ] Spec da etapa 1, §12: nota "Feita no spec `2026-10-31-acoes-etapa-2-design.md`".
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.
- [ ] O script imprime, para encerradas (resultado e IR), proventos recebidos e investido das posições abertas: Geral, FIIs, Ações e a diferença `Geral − (FIIs + Ações)`, que deve ser 0,00 em todas.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo passa; o script mostra diferença 0,00.

**Steps:**

- [ ] **Step 1: Docs** — editar os trechos listados nos critérios, no estilo de frases curtas do CLAUDE.md. Status do spec da etapa 2: "aprovado e implementado (branch feat/acoes-etapa-2)".

- [ ] **Step 2: Checagens**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`
Expected: tudo passa. (Sem `.env.local`, o build usa as variáveis de exemplo de `.github/workflows/ci.yml`.)

- [ ] **Step 3: Script de conferência (só leitura)**

Copiar para a raiz do repositório só para rodar e apagar depois (os aliases `@/` não resolvem fora dele):

```ts
// check-etapa-2.ts — NÃO COMMITAR. Só lê o banco.
import { readCatalogTypes } from "@/features/market-data/repo";
import { assetClassOf } from "@/features/market-data";
import { closedPositions, summarizeClosedPositions } from "@/features/portfolio";
import { listDividends, listTransactions } from "@/features/transactions/repo";
import { replayLedger } from "@/features/transactions";
import { byClass, type ClassFilter } from "@/shared/lib/class-filter";

const portfolioId = process.argv[2];
if (!portfolioId) throw new Error("uso: npx tsx --conditions=react-server --env-file=.env.local check-etapa-2.ts <portfolioId>");

const [transactions, dividends, catalog] = await Promise.all([
  listTransactions(portfolioId),
  listDividends(portfolioId),
  readCatalogTypes(),
]);
const classes = new Map(
  [...new Set([...transactions, ...dividends].map((item) => item.ticker))].map((ticker) => [
    ticker,
    assetClassOf(ticker, catalog.get(ticker) ?? null),
  ]),
);
const classOf = (ticker: string) => classes.get(ticker) ?? null;

function measures(filter: ClassFilter) {
  const ledger = byClass(transactions, classOf, filter);
  const closed = summarizeClosedPositions(closedPositions(ledger, classes));
  const invested = replayLedger(ledger)
    .positions.filter((position) => position.quantity > 0)
    .reduce((sum, position) => sum + position.totalCost, 0);
  const received = byClass(dividends, classOf, filter).reduce((sum, item) => sum + item.amount, 0);
  return { resultado: closed.realizedPnL, ir: closed.estimatedTax, proventos: received, investido: invested };
}

const [all, fiis, stocks] = (["TODOS", "FII", "ACAO"] as const).map(measures);
for (const key of Object.keys(all!) as (keyof typeof all)[]) {
  const diff = all![key] - (fiis![key] + stocks![key]);
  console.log(key.padEnd(10), all![key].toFixed(2), fiis![key].toFixed(2), stocks![key].toFixed(2), "dif", diff.toFixed(2));
}
process.exit(0);
```

Ajuste os nomes de campo (`totalCost`, `realizedPnL`, `estimatedTax`) aos de `replayLedger` e `ClosedPositionsTotals` se diferirem. O `portfolioId` do dono sai de `listTransactions` de um script anterior ou do Mongo (coleção `transactions`, campo `portfolioId`), só lendo.

Run: `cp "$SCRATCH/check-etapa-2.ts" . && npx tsx --conditions=react-server --env-file=.env.local check-etapa-2.ts <portfolioId>; rm check-etapa-2.ts`
Expected: as quatro linhas com `dif 0.00`. Confirmar `git status` sem o script.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs
git commit -m "docs: describe the per-class views of stocks stage 2"
```

Nada vai para a `main` sem o ok do dono.
