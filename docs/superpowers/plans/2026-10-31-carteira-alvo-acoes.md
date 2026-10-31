# Carteira Alvo de ações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uma Carteira Alvo de ações ao lado da de FIIs, cada uma com os seus 100%, sem mudar as Recomendações.

**Architecture:** a classe do ticker define a carteira (nada novo no banco). `buildSnapshot` monta uma estratégia por classe com a mesma função; `snapshot.strategy` é a da visão (`view`), a cascata só usa a de FIIs. Os alertas se dividem em "da carteira" e "da estratégia" (por classe). `/carteira-alvo` ganha FIIs | Ações em `?classe=`.

**Tech Stack:** Next.js 16 (cacheComponents), TypeScript, next-safe-action, Zod, nuqs, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-carteira-alvo-acoes-design.md`

**Regras do repositório:**
- **Branch:** `feat/carteira-alvo-acoes`, que já existe, com a spec. Nada vai para a `main` sem o ok do dono.
- **Banco:** o `.env.local` aponta para produção. Nenhum passo grava nele.
- **Commits:** em inglês, Conventional Commits, terminando com as linhas de atribuição da sessão.
- **Código:** comentários e textos de tela em português do Brasil.

## Mapa de arquivos

| Arquivo | Papel |
| --- | --- |
| `src/features/portfolio/domain/snapshot.ts` | Estratégia por classe, `view` no lugar de `withAlerts` |
| `src/features/portfolio/domain/alerts.ts` | Alertas da carteira e da estratégia (por classe) |
| `src/features/portfolio/domain/snapshot.test.ts`, `alerts.test.ts` (novo) | Testes |
| `src/features/strategy/schemas.ts`, `actions.ts` | Ações aceitas por aba; categoria travada; % da mesma classe |
| `src/features/transactions/components/ticker-input.tsx` | `only?: "FII" \| "ACAO"` no lugar de `fiiOnly` |
| `src/shared/components/asset-class-control.tsx` | `includeAll` |
| `src/features/strategy/components/strategy-table.tsx`, `table/strategy-row.tsx`, `table/strategy-list.tsx`, `table/add-asset-form.tsx` | Aba Ações |
| `src/app/(app)/carteira-alvo/page.tsx` | Lê `?classe=` |
| `CLAUDE.md`, specs | Docs |

---

### Task 1: Estratégia por classe e alertas divididos (código puro)

**Goal:** `buildSnapshot` com uma estratégia por classe, a cascata só de FIIs, e os alertas da estratégia por classe.

**Files:**
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Modify: `src/features/portfolio/domain/alerts.ts`
- Modify: `src/features/portfolio/domain/snapshot.test.ts`
- Create: `src/features/portfolio/domain/alerts.test.ts`

**Acceptance Criteria:**
- [ ] Com alvos de FIIs e de ações, os `targetWeight` dos membros de cada classe somam 1 sozinhos.
- [ ] `cascadeInput` só tem FIIs; `sunoCascade` dá as mesmas ordens com e sem os alvos de ações.
- [ ] Em Geral, a ação configurada sai na tabela de posições com `inStrategy` true, `targetWeight` da carteira de ações e `priority` null.
- [ ] Na visão Ações (`scopeToClass(input, "ACAO")`), `strategy.rows` são as ações e `cascadeInput` é vazio.
- [ ] Em Geral, o alerta "fora da Carteira Alvo" de ações sai com id `sem-configuracao-acoes` e título com " (ações)"; na visão Ações, id `sem-configuracao`, sem sufixo; na visão FIIs, nenhum alerta de ações.
- [ ] `withAlerts` não existe mais; `SnapshotInput.view?: ClassFilter` (padrão `"TODOS"`).

**Verify:** `npx vitest run src/features/portfolio/domain` → todos passam; `npm run typecheck` → sem erros.

**Steps:**

- [ ] **Step 1: Testes**

Em `snapshot.test.ts`, trocar o teste "a visão Ações não tem estratégia nem alertas" (do `describe("scopeToClass: …")`) por:

```ts
  it("a visão Ações tem a estratégia das ações e nenhuma cascata", () => {
    const stocks = view("ACAO");
    expect(stocks.strategy.rows.map((row) => row.ticker)).toEqual(["PETR4"]);
    expect(stocks.cascadeInput).toEqual([]);
  });
```

E acrescentar no fim do arquivo:

```ts
describe("buildSnapshot: Carteira Alvo de ações", () => {
  const input: SnapshotInput = {
    now: new Date(Date.UTC(2026, 9, 31)),
    transactions: [buy("AAAA11", 10), buy("BBBB11", 30), buy("PETR4", 20), buy("VALE3", 5)],
    targets: [
      target("AAAA11", true, 60, 1),
      target("BBBB11", true, 40, 2),
      { ...target("PETR4", true, 70, 1), category: "ACAO" },
      { ...target("VALE3", true, 30, 2), category: "ACAO" },
    ],
    dividends: [],
    prices: new Map(
      ["AAAA11", "BBBB11", "PETR4", "VALE3"].map((ticker) => [ticker, quote] as const),
    ),
    classes: new Map<string, AssetClass | null>([
      ["AAAA11", "FII"],
      ["BBBB11", "FII"],
      ["PETR4", "ACAO"],
      ["VALE3", "ACAO"],
    ]),
  };
  const fiiOnly: SnapshotInput = {
    ...input,
    targets: input.targets.filter((item) => !["PETR4", "VALE3"].includes(item.ticker)),
  };

  it("cada carteira fecha 100% sozinha", () => {
    const { positions } = buildSnapshot(input);
    const sum = (tickers: string[]) =>
      positions
        .filter((row) => tickers.includes(row.ticker))
        .reduce((total, row) => total + (row.targetWeight ?? 0), 0);
    expect(sum(["AAAA11", "BBBB11"])).toBeCloseTo(1, 6);
    expect(sum(["PETR4", "VALE3"])).toBeCloseTo(1, 6);
  });

  it("a cascata só tem FIIs e as ordens não mudam com as ações configuradas", () => {
    const withStocks = buildSnapshot(input);
    const without = buildSnapshot(fiiOnly);
    expect(withStocks.cascadeInput.map((asset) => asset.ticker)).toEqual(["AAAA11", "BBBB11"]);
    expect(withStocks.cascadeInput).toEqual(without.cascadeInput);
    expect(sunoCascade(withStocks.cascadeInput, 10_000)).toEqual(
      sunoCascade(without.cascadeInput, 10_000),
    );
  });

  it("em Geral, a ação configurada está na estratégia dela, sem prioridade de aporte", () => {
    const petr = buildSnapshot(input).positions.find((row) => row.ticker === "PETR4")!;
    expect(petr.inStrategy).toBe(true);
    expect(petr.targetWeight).toBeCloseTo(0.7, 6);
    expect(petr.priority).toBeNull();
  });

  it("Geral e FIIs: snapshot.strategy é a de FIIs", () => {
    expect(buildSnapshot(input).strategy.rows.map((row) => row.ticker)).toEqual([
      "AAAA11",
      "BBBB11",
    ]);
  });
});
```

Confira a assinatura real de `sunoCascade` em `src/features/smart-buy/domain/suno-cascade.ts` (o arquivo de teste já a importa) e ajuste a chamada se ela receber um objeto.

Criar `src/features/portfolio/domain/alerts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAlerts } from "./alerts";
import type { StrategyRow } from "./types";

const row = (ticker: string, patch: Partial<StrategyRow> = {}): StrategyRow => ({
  ticker,
  name: null,
  logoUrl: null,
  configured: false,
  held: true,
  quantity: 10,
  inStrategy: false,
  sunoRank: null,
  ceilingPrice: null,
  suggestedPercent: null,
  category: null,
  suggestedCategory: null,
  price: 10,
  marginToCeiling: null,
  suspiciousCeiling: false,
  strategyWeight: null,
  targetWeight: null,
  priority: null,
  ...patch,
});

describe("buildAlerts: estratégia por classe", () => {
  const fiis = { rows: [row("AAAA11")], weightsWarning: null, tag: null, receivesAporte: true };

  it("em Geral, os alertas de ações levam o sufixo", () => {
    const alerts = buildAlerts({
      positions: [],
      strategies: [
        fiis,
        {
          rows: [row("PETR4")],
          weightsWarning: null,
          tag: { id: "acoes", label: "ações" },
          receivesAporte: false,
        },
      ],
    });
    const stock = alerts.find((alert) => alert.id === "sem-configuracao-acoes");
    expect(stock?.title).toBe("Ativos fora da Carteira Alvo (ações)");
    expect(stock?.detail).toContain("PETR4");
    expect(alerts.find((alert) => alert.id === "sem-configuracao")?.detail).toContain("AAAA11");
  });

  it("sem tag, o id e o título são os de sempre", () => {
    const alerts = buildAlerts({ positions: [], strategies: [fiis] });
    expect(alerts.map((alert) => alert.id)).toEqual(["sem-configuracao"]);
  });

  it("estratégia incompleta da ação não fala de aporte", () => {
    const alerts = buildAlerts({
      positions: [],
      strategies: [
        {
          rows: [row("PETR4", { configured: true, inStrategy: true })],
          weightsWarning: null,
          tag: null,
          receivesAporte: false,
        },
      ],
    });
    const incomplete = alerts.find((alert) => alert.id === "configuracao-incompleta");
    expect(incomplete?.detail).toBe("PETR4: sem ranking ou sem preço teto.");
  });
});
```

Run: `npx vitest run src/features/portfolio/domain` → FAIL (assinatura nova de `buildAlerts`, ações fora da estratégia).

- [ ] **Step 2: Alertas**

Em `src/features/portfolio/domain/alerts.ts`, a assinatura passa a ser:

```ts
/** A estratégia de uma classe, para os alertas dela. */
export type StrategyAlertInput = {
  rows: readonly StrategyRow[];
  weightsWarning: string | null;
  /** Em Geral, a carteira de ações se identifica no id e no título. null: sem sufixo. */
  tag: { id: string; label: string } | null;
  /** Só a estratégia de FIIs recebe aporte (as Recomendações são só de FIIs). */
  receivesAporte: boolean;
};

export function buildAlerts(input: {
  positions: readonly PositionRow[];
  strategies: readonly StrategyAlertInput[];
}): PortfolioAlert[] {
  // concentração e "sem cotação": como hoje, sobre input.positions
  // depois: for (const strategy of input.strategies) alerts.push(...strategyAlerts(strategy));
}
```

Mover os cinco alertas da estratégia (teto suspeito, estratégia incompleta, ranking repetido, % sugeridas, fora da Carteira Alvo) para `function strategyAlerts({ rows, weightsWarning, tag, receivesAporte }: StrategyAlertInput): PortfolioAlert[]`, com o mesmo texto de hoje e:

```ts
  const id = (base: string) => (tag ? `${base}-${tag.id}` : base);
  const title = (base: string) => (tag ? `${base} (${tag.label})` : base);
```

aplicados em cada `id`/`title`. Em "estratégia incompleta", o `detail` vira:

```ts
      detail: receivesAporte
        ? `${list}: sem ranking ou sem preço teto não recebem aporte.`
        : `${list}: sem ranking ou sem preço teto.`,
```

(`list` = os tickers juntados por ", ", como hoje).

- [ ] **Step 3: Snapshot**

Em `src/features/portfolio/domain/snapshot.ts`:

1. `SnapshotInput`: trocar `withAlerts?: boolean` por

```ts
  /** Visão do snapshot (spec etapa 2): decide a estratégia de `strategy` e os alertas. Padrão: Geral. */
  view?: ClassFilter;
```

e em `scopeToClass` trocar as linhas de `targets` e `withAlerts` por:

```ts
    targets: byClass(input.targets, classOf, filter),
    view: filter,
```

e a doc da função: "Cada classe tem a sua Carteira Alvo: na visão Ações, só os alvos de ações."

2. Em `buildSnapshot`, receber `view = "TODOS"` no lugar de `withAlerts = true`. Trocar o comentário de `isStock` por "A cascata (Recomendações) é só de FIIs; cada classe tem a sua Carteira Alvo." e acrescentar:

```ts
  type StrategyClass = "FII" | "ACAO";
  const classKey = (ticker: string): StrategyClass => (isStock(ticker) ? "ACAO" : "FII");

  // Estratégia de uma classe: os membros, os pesos que fecham 100% dentro dela e o valor.
  const strategyOf = (cls: StrategyClass) => {
    const members = targets.filter((target) => target.inStrategy && classKey(target.ticker) === cls);
    const { weights, sumOfSuggested, warning } = effectiveWeights(
      members.map((member) => ({ ticker: member.ticker, suggestedPercent: member.suggestedPercent })),
    );
    const value = members.reduce((sum, member) => sum + valueOf(member.ticker), 0);
    return {
      members,
      weights,
      sumOfSuggested,
      weightsWarning: warning,
      strategyValue: value,
      weightOf: (ticker: string) => (value > 0 ? valueOf(ticker) / value : 0),
    };
  };
  const strategies = { FII: strategyOf("FII"), ACAO: strategyOf("ACAO") } as const;
```

(depois de `valueOf`). Remover o bloco antigo de `members`/`effectiveWeights`/`strategyValue`/`strategyWeightOf`; a `cascadeInput` passa a mapear `strategies.FII.members` e ler `strategies.FII.weights`.

3. Na tabela de posições:

```ts
      const strategy = strategies[classKey(position.ticker)];
      const inStrategy = target?.inStrategy ?? false;
      // ...
        strategyWeight: inStrategy ? strategy.weightOf(position.ticker) : null,
        targetWeight: inStrategy ? (strategy.weights.get(position.ticker) ?? 0) : null,
        priority: inStrategy ? (priorities.get(position.ticker) ?? null) : null,
```

(`priorities` só tem FIIs: na ação, `get` dá `undefined` → null). A categoria continua `stock ? "ACAO" : (target?.category ?? null)`.

4. As linhas da Carteira Alvo viram uma função por classe:

```ts
  const rowsOf = (cls: StrategyClass): StrategyRow[] => {
    const strategy = strategies[cls];
    return quoteTickers
      .filter((ticker) => classKey(ticker) === cls)
      .map((ticker) => {
        // ... o corpo de hoje, com:
        //   category: cls === "ACAO" ? "ACAO" : (target?.category ?? null),
        //   suggestedCategory: cls === "ACAO" ? "ACAO" : suggestCategory(info?.subType ?? null),
        //   strategyWeight: inStrategy ? strategy.weightOf(ticker) : null,
        //   targetWeight: inStrategy ? (strategy.weights.get(ticker) ?? 0) : null,
      })
      .sort(/* a ordenação de hoje */);
  };
  const viewClass: StrategyClass = view === "ACAO" ? "ACAO" : "FII";
  const alertClasses: StrategyClass[] = view === "TODOS" ? ["FII", "ACAO"] : [viewClass];
  const rowsByClass = { FII: rowsOf("FII"), ACAO: rowsOf("ACAO") };
```

5. No retorno:

```ts
    strategy: {
      rows: rowsByClass[viewClass],
      strategyValue: strategies[viewClass].strategyValue,
      sumOfSuggested: strategies[viewClass].sumOfSuggested,
      weightsWarning: strategies[viewClass].weightsWarning,
    },
    // ...
    alerts: buildAlerts({
      positions: positionRows,
      strategies: alertClasses.map((cls) => ({
        rows: rowsByClass[cls],
        weightsWarning: strategies[cls].weightsWarning,
        tag: cls === "ACAO" && view === "TODOS" ? { id: "acoes", label: "ações" } : null,
        receivesAporte: cls === "FII",
      })),
    }),
```

Procure outros usos de `withAlerts` (`rg -n withAlerts src`) e remova.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/features/portfolio/domain && npm test && npm run typecheck && npm run lint`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add src/features/portfolio/domain
git commit -m "feat(portfolio): build one target strategy per asset class"
```

---

### Task 2: Ações do servidor e busca de ticker por classe

**Goal:** a Carteira Alvo aceita ações pela aba certa, com a categoria travada e as % de uma classe por vez.

**Files:**
- Modify: `src/features/strategy/schemas.ts`
- Modify: `src/features/strategy/actions.ts`
- Modify: `src/features/transactions/components/ticker-input.tsx`
- Modify: `src/features/strategy/components/table/add-asset-form.tsx` (só a troca de `fiiOnly`; a classe da aba é o Task 3)

**Acceptance Criteria:**
- [ ] `addTargetAssetAction({ ticker, assetClass })`: ticker de outra classe → `ActionError` "PETR4 é ação: adicione na aba Ações." / "HGLG11 não é ação: adicione na aba FIIs."; ação nasce com categoria "ACAO".
- [ ] `updateTargetAssetAction` numa ação com `category` diferente de "ACAO" → `ActionError` "A categoria de uma ação é sempre Ação.". Os demais campos da ação editam normalmente.
- [ ] `setSuggestedPercentsAction` com FIIs e ações misturados → `ActionError` "As % de FIIs e de ações ficam em carteiras separadas.".
- [ ] `TickerInput` tem `only?: "FII" | "ACAO"` (FII: `fii`/`fi-agro`, como o antigo `fiiOnly`; ACAO: o resto) e `fiiOnly` sai.
- [ ] O `traceInput` de `addTargetAsset` continua `["ticker"]`.

**Verify:** `npm run typecheck && npm run lint && npm test` → passa.

**Steps:**

- [ ] **Step 1: Schema**

Em `src/features/strategy/schemas.ts`:

```ts
/** Adicionar pela aba da Carteira Alvo: a classe da aba tem de bater com a do ticker. */
export const addTargetSchema = z.object({
  ticker: tickerSchema,
  assetClass: z.enum(["FII", "ACAO"]),
});
```

- [ ] **Step 2: Ações**

Em `src/features/strategy/actions.ts`, apagar `refuseStock` e:

```ts
/** A classe pelo catálogo: ACAO, ou FII para todo o resto (como o snapshot). */
async function classOf(ticker: string): Promise<"FII" | "ACAO"> {
  return (await getAssetClasses([ticker])).get(ticker) === "ACAO" ? "ACAO" : "FII";
}

/** Adiciona um ativo à Carteira Alvo da aba, já na estratégia. A ação nasce com a categoria Ação. */
export const addTargetAssetAction = authActionClient
  .metadata({ actionName: "addTargetAsset", traceInput: ["ticker"] })
  .inputSchema(addTargetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { ticker, assetClass } = parsedInput;
    const actual = await classOf(ticker);
    if (actual !== assetClass) {
      throw new ActionError(
        actual === "ACAO"
          ? `${ticker} é ação: adicione na aba Ações.`
          : `${ticker} não é ação: adicione na aba FIIs.`,
      );
    }
    const category =
      actual === "ACAO" ? "ACAO" : suggestCategory(await getCatalogSubType(ticker));
    await upsertTargetAsset(ctx.tenant.portfolioId, ticker, {}, { inStrategy: true, category });
    refresh();
    return { ok: true as const };
  });
```

Em `updateTargetAssetAction`, no lugar de `await refuseStock(ticker);`:

```ts
    if (patch.category != null && patch.category !== "ACAO" && (await classOf(ticker)) === "ACAO") {
      throw new ActionError("A categoria de uma ação é sempre Ação.");
    }
```

Em `setSuggestedPercentsAction`, antes do laço:

```ts
    const classes = await getAssetClasses(parsedInput.items.map((item) => item.ticker));
    const kinds = new Set(
      parsedInput.items.map((item) => (classes.get(item.ticker) === "ACAO" ? "ACAO" : "FII")),
    );
    if (kinds.size > 1) {
      throw new ActionError("As % de FIIs e de ações ficam em carteiras separadas.");
    }
```

Atualizar o import dos schemas (`addTargetSchema` no lugar de `targetTickerSchema` só onde o add usava; o remove continua com `targetTickerSchema`).

- [ ] **Step 3: `TickerInput`**

Em `ticker-input.tsx`, trocar a prop:

```ts
  /** Só sugere a classe pedida: FII (FIIs e Fiagros) ou ACAO (o resto). Sem ela, tudo. */
  only?: "FII" | "ACAO";
```

e o filtro:

```ts
  const isFiiLike = (item: TickerSuggestion) => item.subType === "fii" || item.subType === "fi-agro";
  const suggestions =
    only === "FII" ? data.filter(isFiiLike) : only === "ACAO" ? data.filter((item) => !isFiiLike(item)) : data;
```

Em `add-asset-form.tsx`, trocar `fiiOnly` por `only="FII"` nas duas ocorrências e passar `assetClass: "FII"` no `add.execute` (o Task 3 troca pela classe da aba).

- [ ] **Step 4: Conferir e commit**

Run: `npm run typecheck && npm run lint && npm test` → passa.

```bash
git add src/features/strategy src/features/transactions/components/ticker-input.tsx
git commit -m "feat(strategy): accept stocks in their own target portfolio"
```

---

### Task 3: Aba Ações em `/carteira-alvo`

**Goal:** `/carteira-alvo?classe=acoes` mostra e edita a carteira de ações.

**Files:**
- Modify: `src/shared/components/asset-class-control.tsx`
- Modify: `src/features/strategy/components/strategy-table.tsx`
- Modify: `src/features/strategy/components/table/strategy-row.tsx`
- Modify: `src/features/strategy/components/table/strategy-list.tsx`
- Modify: `src/features/strategy/components/table/add-asset-form.tsx`
- Modify: `src/app/(app)/carteira-alvo/page.tsx`

**Acceptance Criteria:**
- [ ] `AssetClassControl includeAll={false}` mostra só FIIs | Ações; sem `?classe=`, FIIs marcado; escolher FIIs remove o parâmetro.
- [ ] `/carteira-alvo` sem parâmetro (ou `?classe=fiis`) = a tela de hoje; `?classe=acoes` = a carteira de ações.
- [ ] Na aba Ações: sem coluna/campo de categoria e de prioridade (tabela, lista e folha do celular); a linha "As Recomendações ainda são só de FIIs." abaixo do título (e no ⓘ do celular); o painel dos 100% funciona com as ações.
- [ ] O formulário de adicionar manda a classe da aba e sugere só tickers dela; o texto da folha e o toast falam "ativo".
- [ ] A página lê `searchParams` dentro da `<Suspense>`.

**Verify:** `npm run typecheck && npm run lint && npm test` → passa; `npm run dev`, abrir `/carteira-alvo` e `/carteira-alvo?classe=acoes` (só leitura; não salvar nada no banco de produção).

**Steps:**

- [ ] **Step 1: `includeAll`**

Em `asset-class-control.tsx`:
- `Props` ganha `/** false: só FIIs \| Ações, com FIIs como padrão (a Carteira Alvo). */ includeAll?: boolean;`
- `Control` recebe `includeAll = true`; as opções viram `includeAll ? OPTIONS : OPTIONS.slice(1)`; o valor, `classe ?? (includeAll ? "geral" : "fiis")`; e o `onChange`:

```ts
      onChange={(next) => {
        // Sem Geral, FIIs é o padrão: não precisa ficar na URL.
        const isDefault = next === "geral" || (!includeAll && next === "fiis");
        void setParams({ classe: isDefault ? null : next, pagina: null });
      }}
```

O `SegmentedControl` é genérico em `T`: tipar as opções como `readonly SegmentedOption<"geral" | "fiis" | "acoes">[]` se o `slice` atrapalhar o tipo.

- [ ] **Step 2: Tabela**

`StrategyTable` ganha a prop `assetClass: "FII" | "ACAO"`:
- `const stock = assetClass === "ACAO";`
- abaixo da `CardDescription` da mesa e no `InfoSheet`, com `stock`: `<p className="text-footnote text-muted-foreground">As Recomendações ainda são só de FIIs.</p>`;
- no `InfoSheet`, o texto "a categoria" sai quando `stock`;
- `<AddAssetForm assetClass={assetClass} />`;
- os cabeçalhos "Categoria" e "Prioridade" só sem `stock`;
- `<StrategyList rows={rows} stock={stock} />` e `<StrategyRow key={row.ticker} row={row} stock={stock} />`;
- o texto vazio: `stock ? "Adicione as ações da sua carteira recomendada." : "Adicione os ativos da carteira recomendada da Suno."`.

`StrategyRow({ row, stock = false })`: as células de `CategorySelect` e `PriorityBadge` só sem `stock`.

`StrategyList({ rows, stock = false })`: passar `stock` até a folha e ao `RowList`; sem `stock`, como hoje; com `stock`, sem o `SheetRow` "Categoria", sem o `SheetRow` "Prioridade" e sem o `PriorityBadge` da linha.

- [ ] **Step 3: Formulário**

`AddAssetForm({ assetClass })`:
- `add.execute({ ticker, assetClass })`;
- `<TickerInput ... only={assetClass} />` nas duas ocorrências;
- o comentário do componente: "Adiciona um ativo à carteira da aba pelo ticker…".

- [ ] **Step 4: Página**

`src/app/(app)/carteira-alvo/page.tsx` (seguir o padrão de `src/app/(app)/encerradas/page.tsx`):

```tsx
export default function StrategyPage({ searchParams }: PageProps<"/carteira-alvo">) {
  return (
    <>
      <PageHeader /* igual */ />
      <AssetClassControl includeAll={false} className="mb-6" />
      <Suspense fallback={<TableSkeleton />}>
        <StrategyContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StrategyContent({ searchParams }: Pick<PageProps<"/carteira-alvo">, "searchParams">) {
  // Cada classe tem os seus 100%: sem Geral, FIIs é o padrão.
  const assetClass = parseClassParam((await searchParams).classe) === "ACAO" ? "ACAO" : "FII";
  const { strategy } = await getPortfolioSnapshot(assetClass);
  return (
    <StrategyTable
      assetClass={assetClass}
      rows={strategy.rows}
      strategyValue={strategy.strategyValue}
      sumOfSuggested={strategy.sumOfSuggested}
      weightsWarning={strategy.weightsWarning}
    />
  );
}
```

`QuoteStatus` continua com `getPortfolioSnapshot()` (a carteira toda).

Em `src/app/(app)/dashboard/page.tsx`, trocar `{filter === "ACAO" ? null : <AlertsPanel alerts={snapshot.alerts} />}` por `<AlertsPanel alerts={snapshot.alerts} />`: a visão Ações agora tem os alertas da carteira de ações (spec §5.2). Inclua o arquivo no commit.

Atenção: `getPortfolioSnapshot("FII")` filtra a estratégia de FIIs com as posições de FIIs, que é o mesmo `strategy` de `getPortfolioSnapshot()` (a estratégia não depende das posições de ações). Confira que a aba FIIs mostra as mesmas linhas, o mesmo "Valor da estratégia" e a mesma soma das % de antes.

- [ ] **Step 5: Conferir e commit**

Run: `npm run typecheck && npm run lint && npm test` → passa.

```bash
git add src/shared/components/asset-class-control.tsx src/features/strategy src/app/\(app\)/carteira-alvo/page.tsx
git commit -m "feat(strategy): add the stocks tab to the target portfolio"
```

---

### Task 4: Docs e verificação completa

**Goal:** CLAUDE.md e specs atualizados e todas as checagens verdes.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md`
- Modify: `docs/superpowers/specs/2026-10-31-carteira-alvo-acoes-design.md`

**Acceptance Criteria:**
- [ ] CLAUDE.md:
  - **Asset class:** "Stocks never enter the strategy…" passa a dizer que as ações têm a sua Carteira Alvo (mesmos campos, categoria sempre Ação) e ficam fora da cascata e das Recomendações.
  - **Pages:** `/carteira-alvo?classe=acoes`, FIIs como padrão, com o `AssetClassControl includeAll={false}`.
  - **Domain flow 2 e 3:** uma estratégia por classe (`strategyOf`), `snapshot.strategy` da visão (`view`), cascata só de FIIs, alertas da estratégia por classe com o sufixo " (ações)" em Geral; o `withAlerts` sai do texto.
  - **Product rules, Stocks:** a regra nova, com a data 2026-10-31 e o spec.
  - **Tests:** `portfolio/domain/alerts.test.ts` e os casos novos do `snapshot.test.ts`.
- [ ] Spec etapa 1: nota na regra da estratégia apontando para `2026-10-31-carteira-alvo-acoes-design.md`.
- [ ] Spec da Carteira Alvo de ações: status "aprovado e implementado (branch feat/carteira-alvo-acoes)". No §8, a conferência das Recomendações fica nos testes (a produção ainda não tem alvos de ações, então a `main` e a branch dão as mesmas ordens por construção).
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.

**Verify:** `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo passa.

**Steps:**

- [ ] **Step 1:** editar os docs listados, no estilo de frases curtas do CLAUDE.md.
- [ ] **Step 2:** rodar a verificação completa.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs
git commit -m "docs: describe the stock target portfolio"
```
