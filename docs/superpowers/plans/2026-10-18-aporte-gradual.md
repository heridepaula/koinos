# Entrada gradual no aporte: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nenhum FII leva mais que uma parte do aporte do mês (padrão 50%, ajustável na tela). Uma posição nova se monta em vários aportes e continua no topo da fila até a meta.

**Architecture:**
- **Regra:** a cascata Suno (`sunoCascade`) ganha um limite por ativo em % do aporte, com mínimo de 1 cota. Ele vale no passo 1 (fila) e no passo 2 (sobra).
- **Sem efeito na fila:** a fila de prioridade não muda.
- **Tela:** a calculadora lê o limite da URL (`?limite=50`) e explica as ordens cortadas.

**Tech Stack:** Next.js 16 (App Router), React 19, nuqs 2 (`parseAsNumberLiteral`), Tailwind + shadcn.

**Spec:** `docs/superpowers/specs/2026-10-18-aporte-gradual-design.md`.

**Sem testes automatizados** (decisão do usuário). Cada tarefa se verifica com `npx tsc --noEmit` e `npm run lint`. A Tarefa 3 roda um script descartável, fora do repositório, com a carteira real, casos sintéticos e uma comparação aleatória com a cascata antiga.

---

## Arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/features/smart-buy/domain/suno-cascade.ts` | alterar | Limite por ativo, `limited`, `gapAfter` e `aportesLeft` nas ordens, e `maxSharePercent` no resultado |
| `src/features/smart-buy/index.ts` | alterar | Exportar `MAX_SHARE_PERCENTS`, `DEFAULT_MAX_SHARE_PERCENT` e os tipos `MaxSharePercent` e `CascadeOptions` |
| `src/features/smart-buy/components/aporte-calculator.tsx` | alterar | Seletor "Máximo por FII", "Por quê" e o aviso da entrada aos poucos |
| `src/features/smart-buy/components/principles-banner.tsx` | alterar | Novo princípio "Monte posições aos poucos" |

---

### Task 1: Cascata com limite por FII

**Goal:** `sunoCascade(amount, assets, { maxSharePercent })` limita a compra de cada ativo a essa % do aporte, com mínimo de 1 cota. Com 100%, devolve exatamente as ordens de antes.

**Files:**
- Modify: `src/features/smart-buy/domain/suno-cascade.ts`
- Modify: `src/features/smart-buy/index.ts`

**Acceptance Criteria:**
- [ ] Com `maxSharePercent` 100, as ordens são idênticas às da versão anterior
- [ ] Com 50, nenhuma ordem passa de 50% do aporte, salvo quando 1 cota já passa disso
- [ ] O passo 2 roda quando todo elegível está na meta ou no limite, e respeita o limite
- [ ] A ordem cortada traz `limited: true`, `gapAfter` e `aportesLeft`
- [ ] `aportePriorities` não muda
- [ ] `npx tsc --noEmit` e `npm run -s lint` sem erros

**Verify:** `npx tsc --noEmit && npm run -s lint` → sem erros (o comportamento é conferido na Tarefa 3)

**Steps:**

- [ ] **Step 1: Comentário de abertura e tipos**

Em `src/features/smart-buy/domain/suno-cascade.ts`, o comentário de abertura ganha a entrada aos poucos:

```ts
// Motor de aporte pelo método Suno (orientações públicas da Suno no Suno Conecta):
// 1. só comprar abaixo do preço teto;
// 2. seguir o ranking respeitando a % sugerida: levar o 1º até a meta, depois o 2º, e assim por diante;
// 3. se todos estiverem abaixo do teto e na meta, aportar no de menor peso ou mais abaixo do preço médio.
// Na acumulação, a carteira se rebalanceia pelos aportes, sem vender.
// Entrada aos poucos ("investir aos poucos, distribuindo as compras ao longo de alguns meses"):
// nenhum ativo leva mais que uma parte do aporte. Uma posição nova se monta em vários aportes,
// e o preço médio se forma em várias compras.
```

Depois de `ExclusionReason`, entram as opções e o padrão:

```ts
/** Limites por ativo que a tela oferece, em % do aporte. 100 = sem limite. */
export const MAX_SHARE_PERCENTS = [25, 33, 50, 75, 100] as const;
export type MaxSharePercent = (typeof MAX_SHARE_PERCENTS)[number];
/** Padrão da entrada aos poucos: nenhum ativo leva mais que metade do aporte. */
export const DEFAULT_MAX_SHARE_PERCENT: MaxSharePercent = 50;

export type CascadeOptions = {
  /** Máximo que um ativo pode receber neste aporte, em %. 100 ou mais = sem limite. */
  maxSharePercent?: number;
};
```

`CascadeOrder` ganha três campos, depois de `gapBefore`:

```ts
  /** Parou no limite por ativo com o ativo ainda abaixo da meta (entrada aos poucos). */
  limited: boolean;
  /** Quanto falta (R$) para a meta depois desta ordem. */
  gapAfter: number;
  /** Só em ordem limitada: quantos aportes iguais a este ainda faltam para a meta (estimativa). */
  aportesLeft: number | null;
```

`CascadeResult` ganha `maxSharePercent`, depois de `strategyValue`:

```ts
  /** Limite por ativo usado, em % do aporte (100 = sem limite). */
  maxSharePercent: number;
```

- [ ] **Step 2: Limite nos passos 1 e 2**

Assinatura:

```ts
export function sunoCascade(
  amount: number,
  assets: readonly CascadeAsset[],
  { maxSharePercent = DEFAULT_MAX_SHARE_PERCENT }: CascadeOptions = {},
): CascadeResult {
```

Depois de `affordable`, entra o limite:

```ts
  // Entrada aos poucos: teto de cotas por ativo neste aporte, com pelo menos 1 cota (senão um
  // ativo caro nunca entraria com aportes pequenos). Com 100%, não há teto.
  const limit = maxSharePercent >= 100 ? Infinity : (maxSharePercent / 100) * budget;
  const maxQuantity = (asset: Eligible) =>
    Math.max(1, Math.floor(limit / asset.price + EPSILON));
  const room = (asset: Eligible) => maxQuantity(asset) - asset.bought;
```

Passo 1 (o comentário e a quantidade mudam):

```ts
  // Passo 1: cascata pelo ranking, cada ativo até a meta ou até o limite. Se o dinheiro não
  // alcança um ativo, segue para os próximos (um mais barato ainda pode caber).
  for (const asset of eligible) {
    const quantity = Math.min(wanted(asset), room(asset), affordable(asset));
```

Passo 2 (a condição e os candidatos mudam):

```ts
  // Passo 2: sobra. Só quando todos os elegíveis estão na meta ou no limite; senão o dinheiro
  // fica guardado para o próximo aporte do ativo que ainda está abaixo dela.
  if (eligible.every((asset) => wanted(asset) === 0 || room(asset) <= 0)) {
```

```ts
      const candidates = eligible.filter(
        (asset) => asset.target > 0 && asset.price <= cash + EPSILON && room(asset) > 0,
      );
```

- [ ] **Step 3: Campos novos nas ordens e no resultado**

O `map` das ordens passa a ter corpo:

```ts
  const orders: CascadeOrder[] = eligible
    .filter((asset) => asset.bought > 0)
    .map((asset) => {
      const limited = room(asset) <= 0 && wanted(asset) > 0;
      const total = round2(asset.bought * asset.price);
      // Cada aporte igual compra cerca do mesmo total, e a meta cresce peso × aporte.
      const pace = total - asset.weight * budget;
      const gapAfter = round2(asset.target - (asset.value + asset.bought * asset.price));
      return {
        ticker: asset.ticker,
        rank: asset.rank,
        quantity: asset.bought,
        fromLeftover: asset.fromLeftover,
        price: asset.price,
        total,
        weightBefore: strategyValue > 0 ? asset.value / strategyValue : 0,
        weightAfter: totalAfter > 0 ? (asset.value + asset.bought * asset.price) / totalAfter : 0,
        targetWeight: asset.weight,
        marginToCeiling: (asset.ceiling - asset.price) / asset.ceiling,
        gapBefore: round2(asset.target - asset.value),
        limited,
        gapAfter,
        aportesLeft: limited && pace > 0 ? Math.ceil(gapAfter / pace) : null,
      };
    });
```

O `return` final ganha `maxSharePercent` depois de `strategyValue`:

```ts
  return {
    amount: budget,
    spent,
    leftover: round2(budget - spent),
    strategyValue,
    maxSharePercent,
    orders,
    excluded,
  };
```

`aportePriorities` continua chamando `sunoCascade(0, assets)`. Com aporte zero nada é comprado, então o limite não muda a fila.

- [ ] **Step 4: API da feature**

Em `src/features/smart-buy/index.ts`:

```ts
export {
  aportePriorities,
  DEFAULT_MAX_SHARE_PERCENT,
  EXCLUSION_LABELS,
  MAX_SHARE_PERCENTS,
  sunoCascade,
  type AportePriority,
  type CascadeAsset,
  type CascadeExclusion,
  type CascadeOptions,
  type CascadeOrder,
  type CascadeResult,
  type ExclusionReason,
  type MaxSharePercent,
} from "./domain/suno-cascade";
```

- [ ] **Step 5: Verificar e commitar**

Run: `npx tsc --noEmit && npm run -s lint`
Expected: sem saída de erro.

```bash
git add src/features/smart-buy/domain/suno-cascade.ts src/features/smart-buy/index.ts
git commit -m "feat(smart-buy): cap how much of one aporte a single FII can take"
```

---

### Task 2: Seletor e explicação na calculadora

**Goal:** As Recomendações deixam escolher o máximo por FII (padrão 50%), mostram o limite e os aportes que faltam no "Por quê", e a faixa de princípios ganha "Monte posições aos poucos".

**Files:**
- Modify: `src/features/smart-buy/components/aporte-calculator.tsx`
- Modify: `src/features/smart-buy/components/principles-banner.tsx`

**Acceptance Criteria:**
- [ ] Seletor "Máximo por FII" com 25%, 33%, 50%, 75% do aporte e Sem limite; padrão 50%; guardado em `?limite=`
- [ ] Ordem cortada: o "Por quê" termina com "limite de 50% do aporte · faltam ≈ N aportes como este"
- [ ] Com alguma ordem cortada, o card das ordens mostra o aviso da entrada aos poucos
- [ ] Faixa de princípios com "Monte posições aos poucos"
- [ ] `npx tsc --noEmit`, `npm run -s lint` e `npm run -s build` sem erros

**Verify:** `npx tsc --noEmit && npm run -s lint && npm run -s build` → sem erros

**Steps:**

- [ ] **Step 1: Imports e constantes**

Em `aporte-calculator.tsx`, o import do nuqs ganha `parseAsNumberLiteral`, o do lucide ganha `LayersIcon`, e o do domínio ganha os novos nomes:

```ts
import { CopyIcon, LayersIcon } from "lucide-react";
import { parseAsFloat, parseAsNumberLiteral, useQueryState } from "nuqs";
```

```ts
import {
  DEFAULT_MAX_SHARE_PERCENT,
  EXCLUSION_LABELS,
  MAX_SHARE_PERCENTS,
  sunoCascade,
  type CascadeAsset,
  type CascadeOrder,
  type ExclusionReason,
  type MaxSharePercent,
} from "../domain/suno-cascade";
```

Depois de `REASON_ORDER`:

```ts
const selectClass =
  "h-10 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const limitLabel = (percent: MaxSharePercent) =>
  percent >= 100 ? "Sem limite" : `${percent}% do aporte`;
```

- [ ] **Step 2: "Por quê" com o limite**

```ts
function explain(order: CascadeOrder, maxSharePercent: number): string {
  const parts = [
    `${order.rank}º do ranking`,
    `${formatPercent(order.marginToCeiling, 1)} abaixo do teto`,
    order.gapBefore > 0 ? `faltavam ${formatBRL(order.gapBefore)} para a meta` : "já na meta",
  ];
  if (order.limited) {
    parts.push(`limite de ${maxSharePercent}% do aporte`);
    if (order.aportesLeft !== null) {
      parts.push(
        order.aportesLeft === 1
          ? "falta ≈ 1 aporte como este"
          : `faltam ≈ ${order.aportesLeft} aportes como este`,
      );
    }
  }
  if (order.fromLeftover > 0) parts.push(`${order.fromLeftover} cota(s) da sobra`);
  return parts.join(" · ");
}
```

- [ ] **Step 3: Estado do limite e cálculo**

Em `AporteCalculator`, depois do `useQueryState` do valor:

```ts
  const [maxShare, setMaxShare] = useQueryState(
    "limite",
    parseAsNumberLiteral(MAX_SHARE_PERCENTS)
      .withDefault(DEFAULT_MAX_SHARE_PERCENT)
      .withOptions({ history: "replace" }),
  );
```

O cálculo passa o limite:

```ts
  const result = amount > 0 ? sunoCascade(amount, assets, { maxSharePercent: maxShare }) : null;
  const limitedAny = result?.orders.some((order) => order.limited) ?? false;
```

- [ ] **Step 4: Seletor no card do valor**

O `CardDescription` do primeiro card:

```tsx
          <CardDescription>
            O cálculo usa as cotações atuais e a configuração da Carteira Alvo. O máximo por FII
            monta cada posição aos poucos: o preço médio se forma em várias compras.
          </CardDescription>
```

No `form`, entre o `div` do valor e o botão "Copiar ordens":

```tsx
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Máximo por FII
              <select
                className={selectClass}
                value={maxShare}
                onChange={(event) =>
                  void setMaxShare(Number(event.target.value) as MaxSharePercent)
                }
              >
                {MAX_SHARE_PERCENTS.map((percent) => (
                  <option key={percent} value={percent}>
                    {limitLabel(percent)}
                  </option>
                ))}
              </select>
            </label>
```

- [ ] **Step 5: Aviso e "Por quê" no card das ordens**

O `CardHeader` de "Ordens de compra":

```tsx
            <CardHeader>
              <CardTitle>Ordens de compra</CardTitle>
              <CardDescription>
                Na ordem do ranking. Os preços são de referência: confira na corretora.
              </CardDescription>
              {limitedAny ? (
                <p className="flex items-start gap-2 text-sm">
                  <LayersIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  Entrada aos poucos: nenhum FII leva mais de {result.maxSharePercent}% do aporte, e
                  o resto vai para os outros FIIs. Quem parou no limite volta a receber no próximo
                  aporte, até chegar à meta.
                </p>
              ) : null}
            </CardHeader>
```

A célula do "Por quê" passa o limite:

```tsx
                            {explain(order, result.maxSharePercent)}
```

- [ ] **Step 6: Princípio novo**

Em `principles-banner.tsx`, o import ganha `LayersIcon`, e a lista ganha o item depois de "Siga o ranking até a % sugerida":

```ts
import {
  CalendarCheckIcon,
  LayersIcon,
  ListOrderedIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "lucide-react";

// Princípios de aporte da Suno, sempre à vista na tela de recomendações.
const PRINCIPLES = [
  { icon: CalendarCheckIcon, text: "Aporte todo mês" },
  { icon: ShieldCheckIcon, text: "Só abaixo do preço teto" },
  { icon: ListOrderedIcon, text: "Siga o ranking até a % sugerida" },
  { icon: LayersIcon, text: "Monte posições aos poucos" },
  { icon: ScaleIcon, text: "Rebalanceie com aportes, não com vendas" },
] as const;
```

- [ ] **Step 7: Verificar e commitar**

Run: `npx tsc --noEmit && npm run -s lint && npm run -s build`
Expected: sem erros. O build usa um env de mentira, como o CI, se o `.env.local` não estiver no worktree.

```bash
git add src/features/smart-buy/components/aporte-calculator.tsx src/features/smart-buy/components/principles-banner.tsx
git commit -m "feat(recomendacoes): choose the max share per FII and explain capped orders"
```

---

### Task 3: Conferência com a carteira real e verificações finais

**Goal:** Mostrar, com a carteira real e casos sintéticos, que "Sem limite" reproduz a cascata antiga, que 50% não muda as ordens de hoje, e que um FII novo leva no máximo 50% e chega à meta em poucos aportes, sempre em 1º na fila.

**Files:**
- Create (fora do repositório, no scratchpad): `aporte/old-cascade.ts` (cópia da versão anterior) e `aporte/check-aporte.ts`

**Acceptance Criteria:**
- [ ] 2.000 carteiras aleatórias e a real: "Sem limite" dá as mesmas ordens da cascata antiga
- [ ] Carteira real, R$ 15.000 a 50%: mesmas ordens de antes
- [ ] FII novo no topo: ≤ 50% do aporte por mês, 1º na fila até a meta, meta em 4 a 5 aportes
- [ ] Casos sintéticos: 1 cota mínima, um só elegível (sobra 50%), todos na meta (sobra com limite)
- [ ] `npm run -s format:check`, `lint`, `typecheck` e `build` passam
- [ ] Screenshot das Recomendações com `?valor=15000`

**Verify:** saída do `check-aporte.ts` com "ok" em todas as checagens

**Steps:**

- [ ] **Step 1: Cópia da cascata antiga**

```bash
git show e9f1f14:src/features/smart-buy/domain/suno-cascade.ts > "$SCRATCH/aporte/old-cascade.ts"
```

- [ ] **Step 2: Script de conferência**

O script, `check-aporte.ts`, roda a partir da raiz do worktree:
- importa `sunoCascade`, `aportePriorities` e o `buildSnapshot` do worktree;
- importa a cascata antiga pela cópia;
- lê a carteira com `findUserIdByEmail`, `listTransactions`, `listTargetAssets` e `getAssetSnapshots`, como `inspect-cascade.ts`;
- compara as ordens por `ticker` e `quantity`.

Para o FII novo, a simulação de 6 meses:
- todos os pesos passam a 1/18;
- o FII entra com rank 0, preço R$ 100, teto R$ 120 e 0 cotas;
- os preços ficam fixos;
- a cada mês, as ordens viram cotas, com o preço médio recalculado.

Run: `npx tsx --conditions=react-server --env-file=../../.env.local "$SCRATCH/aporte/check-aporte.ts" <e-mail do usuário>`
Expected: todas as linhas "ok" e a tabela mês a mês do FII novo.

- [ ] **Step 3: Verificações do projeto**

Run: `npm run -s format:check && npm run -s lint && npm run -s typecheck && npm run -s build`
Expected: tudo passa.

- [ ] **Step 4: Tela**

Subir o app do worktree (`npm run dev` com o `.env.local` do checkout principal) e fotografar `/recomendacoes?valor=15000`, em claro e em escuro.
