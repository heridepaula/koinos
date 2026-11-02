# Tabelas iguais para FIIs e ações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carteira Alvo com as mesmas colunas nas abas FIIs e Ações (viés nos FIIs, prioridade e ajuste de % nas ações) e Recomendações com uma tabela só para FIIs e ações.

**Architecture:** o viés entra na cascata de FIIs como regra de elegibilidade (`AGUARDAR`); o motor de ações passa a receber o peso efetivo (`weight`, reescalado como nos FIIs) e ganha `stockPriorities`; `mergeOrders` junta as ordens. As telas usam um componente só para as duas classes.

**Tech Stack:** Next.js 16 (cacheComponents), TypeScript, next-safe-action, nuqs, Vitest, Base UI, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-31-tabelas-unificadas-design.md`

**Regras do repositório:**
- **Branch:** `feat/tabelas-unificadas`, que já existe, com a spec. Nada vai para a `main` sem o ok do dono.
- **Banco:** o `.env.local` aponta para produção. Nenhum passo grava nele (nem pela tela).
- **Commits:** em inglês, Conventional Commits, terminando com as linhas de atribuição da sessão.
- **Código:** comentários e textos de tela em português do Brasil; `cn` de `@/shared/lib/utils`.

---

### Task 1: Viés na cascata, peso no motor de ações, prioridade das ações e `mergeOrders` (código puro)

**Goal:** as regras puras de §3.1, §3.2 e §3.4 da spec, testadas.

**Files:**
- Modify: `src/features/smart-buy/domain/fii-cascade.ts`, `fii-cascade.test.ts`
- Modify: `src/features/smart-buy/domain/stock-buy.ts`, `stock-buy.test.ts`
- Create: `src/features/smart-buy/domain/merge-orders.ts`, `merge-orders.test.ts`
- Modify: `src/features/smart-buy/index.ts`
- Modify (só para compilar): `src/features/smart-buy/components/aporte/explain.ts`, `explain.test.ts`, `stock-orders.tsx`, `src/features/portfolio/domain/snapshot.ts`, `snapshot.test.ts`

**Acceptance Criteria:**
- [ ] `CascadeAsset.bias?` opcional; um FII com `bias: "AGUARDAR"` sai com `AGUARDAR` (depois de `ACIMA_DO_TETO` na ordem das regras), não recebe na sobra e o seu valor continua em `strategyValue`; `aportePriorities` devolve `{ kind: "fora", reason: "AGUARDAR" }`; `EXCLUSION_LABELS.AGUARDAR = "Viés Aguardar"`; `REASON_HELP.AGUARDAR` e `REASON_ORDER` (antes de `ACIMA_DO_TETO`) em `explain.ts`.
- [ ] Os testes atuais da cascata passam sem mudança.
- [ ] `StockBuyAsset.weight` (fração) no lugar de `targetPercent`; meta = `base × weight`; `StockBuyOrder.targetWeight` (fração) no lugar de `targetPercent`. Os testes do motor de ações passam com `weight = pct / 100` (mesmos números de antes).
- [ ] `stockPriorities(assets): Map<string, AportePriority>`: fila pela margem de segurança (empate rank, ticker), motivos estáticos; uma função interna única de elegibilidade usada por `stockSmartBuy` e `stockPriorities`. Teste com a tabela do documento: AGRO3 1º, BBAS3 2º, TUPY3 3º; BBSE3/PETR4/AXIA7/ITSA4 com `ACIMA_DO_TETO`; e um caso `AGUARDAR` abaixo do teto.
- [ ] `mergeOrders(fii, stock): MergedOrder[]` (`{ kind: "FII", order: CascadeOrder } | { kind: "ACAO", order: StockBuyOrder }`) pelo total decrescente, empate pelo ticker; teste.
- [ ] O snapshot compila com `weight: (row.suggestedPercent ?? 0) / 100` (o Task 2 troca pela reescala) e o teste do snapshot passa ajustado para `weight`.

**Verify:** `npx vitest run src/features/smart-buy src/features/portfolio` → passa; `npm run typecheck` → limpo.

**Steps (resumo do código):**

```ts
// fii-cascade.ts
export type CascadeAsset = {
  // ...campos de hoje
  /** Viés da casa de análise; Aguardar tira o FII deste aporte. Sem viés, nada muda. */
  bias?: "COMPRAR" | "AGUARDAR" | null;
};
export type ExclusionReason = /* os de hoje */ | "AGUARDAR";
type EligibilityReason = "SEM_COTACAO" | "SEM_RANKING" | "SEM_TETO" | "ACIMA_DO_TETO" | "AGUARDAR";
// em eligibilityFailure, depois de ACIMA_DO_TETO:
if (asset.bias === "AGUARDAR") return "AGUARDAR";
/** Motivos que não dependem do aporte (a coluna Prioridade). */
export type PriorityReason = EligibilityReason | "NA_META" | "PEDIDO_PEQUENO";
export type AportePriority = { kind: "fila"; position: number } | { kind: "fora"; reason: PriorityReason };
```

```ts
// stock-buy.ts — elegibilidade numa função só
function classify(amount: number, assets: readonly StockBuyAsset[]) {
  // devolve { budget, base, valueOf, excluded (só motivos estáticos), candidates ordenados pela margem }
}
export function stockSmartBuy(amount: number, assets: readonly StockBuyAsset[]): StockBuyResult {
  // usa classify(amount, …); o laço de compra acrescenta SEM_SALDO como hoje
}
/** Prioridade com aporte zero (spec tabelas unificadas, §3.2). */
export function stockPriorities(assets: readonly StockBuyAsset[]): Map<string, AportePriority> {
  const { excluded, candidates } = classify(0, assets);
  const map = new Map<string, AportePriority>();
  candidates.forEach((candidate, index) =>
    map.set(candidate.asset.ticker, { kind: "fila", position: index + 1 }),
  );
  for (const item of excluded) map.set(item.ticker, { kind: "fora", reason: item.reason });
  return map;
}
```

```ts
// merge-orders.ts
import type { StockBuyOrder } from "./stock-buy";
import type { CascadeOrder } from "./fii-cascade";

/** Uma ordem de qualquer carteira, para a tabela única das Recomendações. */
export type MergedOrder =
  | { kind: "FII"; order: CascadeOrder }
  | { kind: "ACAO"; order: StockBuyOrder };

/** As ordens das duas carteiras juntas, da maior para a menor (empate: ticker). */
export function mergeOrders(
  fii: readonly CascadeOrder[],
  stock: readonly StockBuyOrder[],
): MergedOrder[] {
  return [
    ...fii.map((order) => ({ kind: "FII" as const, order })),
    ...stock.map((order) => ({ kind: "ACAO" as const, order })),
  ].sort((a, b) => b.order.total - a.order.total || a.order.ticker.localeCompare(b.order.ticker));
}
```

Commit: `feat(smart-buy): add the bias to the FII cascade and the stock priorities`

---

### Task 2: Snapshot e ações do servidor

**Goal:** §3.3 e §4 da spec.

**Files:**
- Modify: `src/features/portfolio/domain/snapshot.ts`, `snapshot.test.ts`, `src/features/portfolio/domain/alerts.test.ts` (se precisar)
- Modify: `src/features/strategy/actions.ts`

**Acceptance Criteria:**
- [ ] A estratégia de ações usa `effectiveWeights` e o aviso da soma, como a de FIIs (sai o caso especial de ações em `strategyOf` e nos alertas). Teste: com as % das ações somando 81,5, o `targetWeight` da ação de 10% é 10/81,5 e há o alerta `pesos-acoes` em Geral.
- [ ] `stockBuyInput` montado de `strategies.ACAO.members` (com `weight` efetivo, `price` = `priceOf`, `quantity` da posição, `bias`), antes das linhas.
- [ ] `priorities` = cascata de FIIs + `stockPriorities(stockBuyInput)`; as linhas e posições de ações ganham a Prioridade. Teste.
- [ ] `bias` vai para as linhas das duas classes e para a `cascadeInput` dos FIIs. Teste: FII com Aguardar sai da cascata com o motivo.
- [ ] `updateTargetAssetAction` aceita viés em FIIs (sai "O viés é só para ações.").

**Verify:** `npm test && npm run typecheck && npm run lint` → passa.

Commit: `feat(portfolio): rescale the stock targets and give stocks a priority`

---

### Task 3: Carteira Alvo com as mesmas colunas nas duas abas

**Goal:** §5.1 da spec.

**Files:**
- Modify: `src/features/strategy/components/strategy-table.tsx`, `table/strategy-row.tsx`, `table/strategy-list.tsx`

**Acceptance Criteria:**
- [ ] Cabeçalho e linha iguais nas duas abas: Ativo, Estratégia, Rank, Teto (R$), % sugerida, Categoria, Viés, Preço atual, Margem, Peso / meta, Prioridade, remover. Na ação, a Categoria é o texto "Ação" (só leitura); nos FIIs, o `CategorySelect` de hoje. O `BiasSelect` nas duas.
- [ ] Lista do celular: resumo, selo "Aguardar" e `PriorityBadge` nas duas abas. Folha: Categoria (só leitura na ação), Viés e Prioridade nas duas.
- [ ] O painel de ajuste (`PercentFixPanel`) e o aviso da soma nas duas abas (sai `stock ? null : …`).
- [ ] A explicação: "Ranking, preço teto, % sugerida e viés pelo ranking. Os campos salvam ao sair. Sem teto, ou com viés Aguardar, o ativo não recebe aporte." O texto do ⓘ fala de categoria (FIIs) e viés (as duas).
- [ ] O comentário da lista do celular fala de 12 colunas.

**Verify:** `npm run typecheck && npm run lint && npm test` → passa.

Commit: `feat(strategy): give the stock tab the same columns as the FII tab`

---

### Task 4: Recomendações com uma tabela só

**Goal:** §5.2 da spec.

**Files:**
- Modify: `src/features/smart-buy/components/aporte-calculator.tsx`, `aporte/orders.tsx`, `aporte/excluded-card.tsx`, `aporte/explain.ts` (+ teste)
- Delete: `aporte/stock-orders.tsx`, `aporte/stock-excluded-card.tsx` (o conteúdo útil vai para `orders.tsx` e `excluded-card.tsx`)

**Acceptance Criteria:**
- [ ] `OrdersTable` e `OrdersList` recebem `MergedOrder[]` e `showClass` (selo "FII"/"Ação" ao lado do ativo quando há as duas classes). Colunas: Ativo, Qtd. ("Cotas" só FIIs; "Ações" só ações), Preço, Total, % antes → depois, % meta, Por quê (`shortReason`/`explain` nos FIIs, `shortStockReason`/`explainStock` nas ações). A folha do celular abre o detalhe da classe (a de FIIs de hoje; a de ações que estava em `stock-orders.tsx`).
- [ ] Um card "Ordens de compra" em todas as visões: Geral pelo `mergeOrders`; FIIs na ordem do ranking; Ações na ordem da margem. A descrição diz a ordem. A nota das travas de risco aparece quando alguma trava cortou um FII.
- [ ] Um card "Fora deste aporte" com os motivos das duas carteiras juntos (`ExclusionReason` contém os das ações); o texto de ajuda de cada motivo fala da classe dos ativos daquele motivo (FIIs, ações ou os dois).
- [ ] "Copiar ordens" na ordem da tabela, com "cotas" ou "ações" por linha, o total e a sobra.
- [ ] `CALCULATION_NOTE` cita o viés Aguardar (FIIs e ações) e que as % das ações são reescaladas como as dos FIIs.

**Verify:** `npm test && npm run typecheck && npm run lint && npm run format:check` → passa.

Commit: `feat(smart-buy): show FII and stock orders in one table`

---

### Task 5: Docs e verificação completa

**Goal:** CLAUDE.md e specs atualizados; checagens verdes.

**Acceptance Criteria:**
- [ ] CLAUDE.md descreve o código atual: Pages (`/carteira-alvo` com as mesmas colunas e o painel nas duas abas; `/recomendacoes` com a tabela única e a ordem por visão), Asset class (viés nas duas classes), Domain flow item 3 (viés Aguardar na cascata; as % das ações reescaladas; `stockPriorities`; `mergeOrders`), Tests. Sem dizer que as % das ações valem "como gravadas" ou que o viés é só de ações.
- [ ] Spec do smart buy de ações: a nota de mudança. Spec das tabelas: status "aprovado e implementado (branch feat/tabelas-unificadas)".
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.

Commit: `docs: describe the unified target and order tables`
