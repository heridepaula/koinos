# Smart Buy de ações e divisão no aporte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** motor de ações do documento do dono (teto, meta, viés, margem de segurança), divisão do aporte escolhida em `/recomendacoes?fiis=`, e a remoção da meta por classe.

**Architecture:** `stockSmartBuy` puro em `smart-buy/domain/stock-buy.ts`; o snapshot entrega `stockBuyInput`; a calculadora divide pelo `?fiis=` e roda `sunoCascade` (FIIs, sem `caps`) e `stockSmartBuy` (ações). Saem `class_targets`, `splitByClassTarget`, `classAporte`, `STOCK_CAPS` e o `caps` da cascata. `target_assets` ganha `bias`.

**Tech Stack:** Next.js 16 (cacheComponents), TypeScript, Mongoose, next-safe-action, Zod, nuqs, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-smart-buy-acoes-design.md`

**Regras do repositório:**
- **Branch:** `feat/smart-buy-acoes`, que já existe, com a spec. Nada vai para a `main` sem o ok do dono.
- **Banco:** o `.env.local` aponta para produção. Nenhum passo grava nele (nem pela tela). O script do Task 5 só lê.
- **Commits:** em inglês, Conventional Commits, terminando com as linhas de atribuição da sessão.
- **Código:** comentários e textos de tela em português do Brasil.

---

### Task 1: Motor de ações `stockSmartBuy` (código puro)

**Goal:** o algoritmo do documento, testado.

**Files:**
- Create: `src/features/smart-buy/domain/stock-buy.ts`
- Create: `src/features/smart-buy/domain/stock-buy.test.ts`
- Modify: `src/features/smart-buy/index.ts`

**Acceptance Criteria:**
- [ ] Tabela do documento (preços da tabela, carteira vazia, R$ 5.000): UNIP6 vem antes de VALE3; BBSE3 `ACIMA_DO_TETO`; PETR4, AXIA7 e ITSA4 `ACIMA_DO_TETO` (preço > teto) — e, com viés Aguardar e preço abaixo do teto, `AGUARDAR`.
- [ ] Nenhuma ordem passa do déficit; `spent + leftover = amount`.
- [ ] Viés null não bloqueia; `AGUARDAR` bloqueia.
- [ ] Empate de margem: menor rank primeiro.
- [ ] `PEDIDO_PEQUENO` e `SEM_SALDO` nos casos certos.
- [ ] Invariantes em 300 carteiras aleatórias com semente.

**Verify:** `npx vitest run src/features/smart-buy/domain/stock-buy.test.ts` → passa.

**Steps:**

- [ ] **Step 1: Teste** — `stock-buy.test.ts`, com um helper `asset(patch)` (padrões: `rank: 1`, `ceiling: 20`, `price: 10`, `quantity: 0`, `targetPercent: 10`, `bias: null`) e os casos dos critérios. A tabela do documento:

```ts
const TABLE: StockBuyAsset[] = [
  { ticker: "BBSE3", rank: 1, price: 41.25, ceiling: 35.5, targetPercent: 10, bias: "AGUARDAR", quantity: 0 },
  { ticker: "BBAS3", rank: 2, price: 16.48, ceiling: 25, targetPercent: 10, bias: "COMPRAR", quantity: 0 },
  { ticker: "UNIP6", rank: 3, price: 51, ceiling: 70, targetPercent: 10, bias: "COMPRAR", quantity: 0 },
  { ticker: "SEER3", rank: 4, price: 10.71, ceiling: 14, targetPercent: 7.5, bias: "COMPRAR", quantity: 0 },
  { ticker: "VALE3", rank: 5, price: 62.01, ceiling: 78, targetPercent: 10, bias: "COMPRAR", quantity: 0 },
  { ticker: "SLCE3", rank: 6, price: 16.94, ceiling: 20.4, targetPercent: 7.5, bias: "COMPRAR", quantity: 0 },
  { ticker: "PETR4", rank: 7, price: 52.93, ceiling: 38, targetPercent: 7.5, bias: "AGUARDAR", quantity: 0 },
  { ticker: "AXIA7", rank: 8, price: 47.9, ceiling: 42.4, targetPercent: 5, bias: "AGUARDAR", quantity: 0 },
  { ticker: "TUPY3", rank: 9, price: 14.5, ceiling: 21, targetPercent: 4, bias: "COMPRAR", quantity: 0 },
  { ticker: "AGRO3", rank: 10, price: 17.31, ceiling: 27.5, targetPercent: 2.5, bias: "COMPRAR", quantity: 0 },
  { ticker: "EGIE3", rank: 11, price: 26.26, ceiling: 28.6, targetPercent: 2.5, bias: "COMPRAR", quantity: 0 },
  { ticker: "ITSA4", rank: 12, price: 12.46, ceiling: 11.5, targetPercent: 5, bias: "AGUARDAR", quantity: 0 },
];
```

Com carteira vazia, base = 5.000; meta da UNIP6 = 500 → 9 ações (459), da VALE3 = 500 → 8 (496,08). Afirme a ordem das ordens pela margem (AGRO3 58,9%, BBAS3 51,7%, TUPY3 44,8%, UNIP6 37,3%, SEER3 30,7%, VALE3 25,8%, SLCE3 20,4%, EGIE3 8,9%), que UNIP6 vem antes de VALE3, e os motivos das 4 de fora.

Run → FAIL.

- [ ] **Step 2: Código**

```ts
// Smart Buy de ações (documento do dono "Smart Buy Ações (Dividendos)"; spec smart-buy-acoes, §3):
// só compra abaixo do teto, abaixo da meta e sem viés Aguardar; a maior margem de segurança
// (teto ÷ preço − 1) é atendida primeiro, cada ação até a sua meta.

export type StockBias = "COMPRAR" | "AGUARDAR";

export type StockBuyAsset = {
  ticker: string;
  rank: number | null;
  ceiling: number | null;
  price: number | null;
  quantity: number;
  /** % sugerida, usada como está (a carteira pode somar menos de 100%: o resto é caixa). */
  targetPercent: number | null;
  bias: StockBias | null;
};

export type StockExclusionReason =
  | "SEM_COTACAO"
  | "SEM_TETO"
  | "ACIMA_DO_TETO"
  | "AGUARDAR"
  | "NA_META"
  | "PEDIDO_PEQUENO"
  | "SEM_SALDO";

export type StockBuyOrder = {
  ticker: string;
  rank: number | null;
  quantity: number;
  price: number;
  total: number;
  marginOfSafety: number;
  deficitBefore: number;
  targetValue: number;
  targetPercent: number;
  weightBefore: number;
  weightAfter: number;
};

export type StockBuyResult = {
  amount: number;
  spent: number;
  leftover: number;
  base: number;
  orders: StockBuyOrder[];
  excluded: { ticker: string; rank: number | null; reason: StockExclusionReason }[];
};

const EPSILON = 1e-9;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function stockSmartBuy(amount: number, assets: readonly StockBuyAsset[]): StockBuyResult {
  const budget = Math.max(0, round2(amount));
  const valueOf = (asset: StockBuyAsset) => (asset.price !== null ? asset.quantity * asset.price : 0);
  const base = assets.reduce((sum, asset) => sum + valueOf(asset), 0) + budget;
  const excluded: StockBuyResult["excluded"] = [];
  const candidates: { asset: StockBuyAsset & { price: number; ceiling: number }; target: number; deficit: number; margin: number }[] = [];

  for (const asset of assets) {
    const out = (reason: StockExclusionReason) => excluded.push({ ticker: asset.ticker, rank: asset.rank, reason });
    if (asset.price === null || asset.price <= 0) { out("SEM_COTACAO"); continue; }
    if (asset.ceiling === null) { out("SEM_TETO"); continue; }
    if (asset.price > asset.ceiling + EPSILON) { out("ACIMA_DO_TETO"); continue; }
    if (asset.bias === "AGUARDAR") { out("AGUARDAR"); continue; }
    const target = (base * (asset.targetPercent ?? 0)) / 100;
    const deficit = target - valueOf(asset);
    if (deficit <= EPSILON) { out("NA_META"); continue; }
    if (deficit < asset.price - EPSILON) { out("PEDIDO_PEQUENO"); continue; }
    candidates.push({ asset: { ...asset, price: asset.price, ceiling: asset.ceiling }, target, deficit, margin: asset.ceiling / asset.price - 1 });
  }

  candidates.sort(
    (a, b) =>
      b.margin - a.margin ||
      (a.asset.rank ?? Infinity) - (b.asset.rank ?? Infinity) ||
      a.asset.ticker.localeCompare(b.asset.ticker),
  );

  let cash = budget;
  const orders: StockBuyOrder[] = [];
  const strategyBefore = base - budget;
  for (const { asset, target, deficit, margin } of candidates) {
    const shares = Math.floor(Math.min(deficit, cash) / asset.price + EPSILON);
    if (shares <= 0) {
      excluded.push({ ticker: asset.ticker, rank: asset.rank, reason: "SEM_SALDO" });
      continue;
    }
    const total = round2(shares * asset.price);
    cash = round2(cash - total);
    const before = valueOf(asset);
    orders.push({
      ticker: asset.ticker,
      rank: asset.rank,
      quantity: shares,
      price: asset.price,
      total,
      marginOfSafety: margin,
      deficitBefore: round2(deficit),
      targetValue: round2(target),
      targetPercent: asset.targetPercent ?? 0,
      weightBefore: strategyBefore > 0 ? before / strategyBefore : 0,
      weightAfter: base > 0 ? (before + total) / base : 0,
    });
  }

  return { amount: budget, spent: round2(budget - cash), leftover: cash, base: round2(base), orders, excluded };
}
```

(`weightAfter` usa a base com o aporte inteiro: é a fração da carteira de ações depois de investida a parte toda.) Exportar `stockSmartBuy` e os tipos em `smart-buy/index.ts`.

Run → PASS. Rode `npm run format` (o código acima está compacto de propósito; deixe o Prettier formatar).

- [ ] **Step 3: Commit**

```bash
git add src/features/smart-buy
git commit -m "feat(smart-buy): add the stock smart buy by margin of safety"
```

---

### Task 2: Viés nos alvos e `stockBuyInput` no snapshot

**Goal:** guardar o viés das ações e entregar a entrada do motor de ações.

**Files:**
- Modify: `src/features/strategy/domain/` (novo `bias.ts` com `BIASES`, `BIAS_LABELS`, `type Bias`), `src/features/strategy/index.ts`
- Modify: `src/features/strategy/server/target-asset.model.ts`, `target-asset-repo.ts` (record e patch)
- Modify: `src/features/strategy/schemas.ts`, `src/features/strategy/actions.ts`
- Modify: `src/features/portfolio/domain/types.ts` (`TargetConfig`, `StrategyRow`, `PortfolioSnapshot`), `snapshot.ts`, `snapshot.test.ts`
- Modify: `src/features/strategy/server/strategy-dal.ts` (se o mapeamento para `TargetConfig` estiver lá)

**Acceptance Criteria:**
- [ ] `target_assets.bias`: enum `["COMPRAR", "AGUARDAR", null]`, padrão null.
- [ ] `targetPatchSchema.bias` opcional (`z.enum(BIASES).nullable().optional()`); `updateTargetAssetAction` recusa `bias` não nulo num não-ação com "O viés é só para ações.".
- [ ] `StrategyRow.bias` e `TargetConfig.bias`.
- [ ] Snapshot: `stockBuyInput: StockBuyAsset[]` (uma por ação na estratégia, `targetPercent` = % gravada sem reescalar, `bias`, `rank`, `ceiling`, `price`, `quantity`) e `stockMeta: { ticker; name; logoUrl }[]`. `stockCascadeInput` e `stockStrategyMeta` saem (ajuste quem os usa: a página de Recomendações passa a usar `stockBuyInput`/`stockMeta`, e a calculadora pode ficar quebrada só até o Task 3 — se o typecheck exigir, adapte o mínimo na calculadora para compilar, sem mudar comportamento visível além de usar o motor novo).
- [ ] Teste: `stockBuyInput` com a % sem reescalar (ex.: 70 e 30 numa carteira que soma 100; e 10 numa que soma 81,5 continua 10) e o viés.

**Verify:** `npm test && npm run typecheck && npm run lint` → passa.

**Steps:** seguir os padrões dos campos existentes (`category`) em cada arquivo; teste primeiro no `snapshot.test.ts`.

```bash
git commit -m "feat(strategy): store the stock bias and feed the stock smart buy"
```

---

### Task 3: Recomendações com a divisão escolhida e remoção da meta por classe

**Goal:** `/recomendacoes?valor=&fiis=` com os dois motores; tudo de `class_targets`/`classAporte` sai.

**Files:**
- Modify: `src/features/smart-buy/components/aporte-calculator.tsx`, `aporte/explain.ts` + `explain.test.ts`, `aporte/excluded-card.tsx`, `aporte/orders.tsx`
- Create (se ajudar): `src/features/smart-buy/components/aporte/stock-orders.tsx`
- Modify: `src/app/(app)/recomendacoes/page.tsx`
- Delete: `src/features/smart-buy/domain/class-split.ts` + teste, `class-aporte.ts` + teste
- Modify: `src/features/smart-buy/domain/risk.ts` (sai `STOCK_CAPS`, `RiskCaps`), `suno-cascade.ts` (sai o parâmetro de limites e o `scaled`; volta ao corpo de antes da Fase 3 — veja `git show 79de569^:src/features/smart-buy/domain/suno-cascade.ts`), `suno-cascade.test.ts` (sai o caso de `STOCK_CAPS` e o de aporte zero com Infinity), `smart-buy/index.ts`
- Delete: `src/features/strategy/server/class-target.model.ts`, `class-target-repo.ts`, `src/features/strategy/components/class-target-panel.tsx`
- Modify: `src/features/strategy/server/strategy-dal.ts`, `server.ts`, `schemas.ts`, `actions.ts`, `ui.ts`; `src/app/(app)/carteira-alvo/page.tsx` (sem o painel e sem buscar a meta)

**Acceptance Criteria:**
- [ ] `?fiis=` inteiro 0–100 via `nuqs` (`parseAsInteger`, padrão 100, `history: "replace"`); fora da faixa vira o limite mais próximo. Parte FIIs = `Math.floor(valor × fiis) / 100`; ações = valor − FIIs.
- [ ] Campo "% para FIIs" ao lado do valor (com "Ações: X%"), e "Hoje: FIIs A% · Ações B%" de `classValues`.
- [ ] Card FIIs só com parte > 0: `sunoCascade(parteFIIs, cascadeInput)` e as exclusões de sempre. Sem `?fiis=`, a tela é a de antes da Fase 3 (título "Ordens de compra", sem card de ações).
- [ ] Card Ações só com parte > 0: `stockSmartBuy(parteAções, stockBuyInput)`, ordens na ordem da margem, exclusões com os textos de `STOCK_REASON_HELP` (novo, para os 7 motivos de §3.3 da spec).
- [ ] `explainStock(order)`: "Margem de segurança de 37% (teto R$ 70,00, preço R$ 51,00) · faltavam R$ X para a meta de Y%"; `shortStockReason(order)`: "37% abaixo do teto · faltavam R$ X". Teste em `explain.test.ts`. As funções de FII voltam à assinatura de antes (sem `kind`), e `reasonHelp`/`OrderClass` saem se não forem mais usados.
- [ ] Resumo: aporte, total das ordens (FIIs + ações) e troco somado; "Copiar ordens" com "FIIs:" e "Ações:" ("ações" nas linhas de ações).
- [ ] Sem nenhuma referência a `class_targets`, `ClassTarget`, `classAporte`, `splitByClassTarget`, `STOCK_CAPS` em `src` (`rg`).

**Verify:** `npm test && npm run typecheck && npm run lint && npm run format:check` → passa.

```bash
git commit -m "feat(smart-buy): split the aporte at the screen and run the stock smart buy"
```

---

### Task 4: Carteira Alvo, aba Ações: viés e sem ajuste para 100%

**Goal:** a aba Ações edita o viés e não empurra a soma para 100%.

**Files:**
- Modify: `src/features/strategy/components/strategy-table.tsx`, `table/strategy-row.tsx`, `table/strategy-list.tsx`
- Create: `src/features/strategy/components/table/bias-select.tsx`

**Acceptance Criteria:**
- [ ] Coluna "Viés" na aba Ações (tabela, lista e folha do celular): `NativeSelect` com "—", "Comprar", "Aguardar", salvando `bias` pelo `useTargetRow`. A aba FIIs não muda.
- [ ] Na aba Ações, sem o `PercentFixPanel` e sem o aviso das % no rodapé; a soma das % continua no rodapé.
- [ ] Na lista do celular, o viés aparece no resumo da linha ("Aguardar" em destaque discreto).

**Verify:** `npm run typecheck && npm run lint && npm test` → passa.

```bash
git commit -m "feat(strategy): edit the stock bias and keep the stock percentages as given"
```

---

### Task 5: Docs, verificação e conferência com os dados reais

**Goal:** CLAUDE.md e specs atualizados, checagens verdes, ordens de ações conferidas só lendo.

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-10-31-aporte-por-classe-design.md`, `2026-10-31-smart-buy-acoes-design.md`, script fora do repositório.

**Acceptance Criteria:**
- [ ] CLAUDE.md: Domain flow item 3 (dois motores; divisão na tela; `stockSmartBuy`), Pages (`/recomendacoes?valor=&fiis=`, `/carteira-alvo` sem a meta e com Viés), Product rules (aporte e Stocks), Data layer/Asset class (sai `class_targets`; `bias`), Tests. Sem menções a `class_targets`, `classAporte`, `STOCK_CAPS` como código atual.
- [ ] Spec do aporte por classe: nota de substituição. Spec do smart buy: status "aprovado e implementado (branch feat/smart-buy-acoes)".
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.
- [ ] Script só de leitura: monta o snapshot com os repositórios e `getAssetSnapshots` (só leitura), imprime `stockSmartBuy(5000, stockBuyInput)` (ordens e exclusões) e confere `spent + leftover = 5000`.

**Verify:** a verificação completa e a saída do script.

```bash
git commit -m "docs: describe the stock smart buy and the split chosen at the aporte"
```
