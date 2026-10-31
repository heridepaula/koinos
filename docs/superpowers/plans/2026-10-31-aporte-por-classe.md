# Aporte entre FIIs e ações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dividir o aporte entre FIIs e ações por uma meta de alocação entre as classes e rodar uma cascata por carteira, com o troco cruzado.

**Architecture:** código puro em `smart-buy/domain`: `sunoCascade` ganha `caps` opcional (`STOCK_CAPS` para ações), `splitByClassTarget` divide pela meta, `classAporte` orquestra as cascatas e o troco. O snapshot ganha `stockCascadeInput` e `classValues`. A meta fica em `class_targets` (feature strategy), editada na Carteira Alvo. A calculadora roda tudo no navegador.

**Tech Stack:** Next.js 16 (cacheComponents), TypeScript, Mongoose, next-safe-action, Zod, nuqs, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-aporte-por-classe-design.md`

**Regras do repositório:**
- **Branch:** `feat/aporte-por-classe`, que já existe, com a spec. Nada vai para a `main` sem o ok do dono.
- **Banco:** o `.env.local` aponta para produção. Nenhum passo grava nele (nem pela tela). O script do Task 6 só lê.
- **Commits:** em inglês, Conventional Commits, terminando com as linhas de atribuição da sessão.
- **Código:** comentários e textos de tela em português do Brasil.

## Mapa de arquivos

| Arquivo | Papel |
| --- | --- |
| `src/features/smart-buy/domain/risk.ts` | `STOCK_CAPS`, tipo `RiskCaps` |
| `src/features/smart-buy/domain/suno-cascade.ts` | `caps` opcional |
| `src/features/smart-buy/domain/class-split.ts` (novo) + teste | `splitByClassTarget` |
| `src/features/smart-buy/domain/class-aporte.ts` (novo) + teste | `classAporte` |
| `src/features/smart-buy/index.ts` | Exportar o novo |
| `src/features/portfolio/domain/snapshot.ts`, `types.ts` + teste | `stockCascadeInput`, `classValues` |
| `src/features/strategy/server/class-target.model.ts`, `class-target-repo.ts`, `strategy-dal.ts`, `server.ts`, `schemas.ts`, `actions.ts` | Meta por classe |
| `src/features/strategy/components/class-target-panel.tsx` (novo), `ui.ts`, `strategy-table.tsx` | Painel da meta |
| `src/app/(app)/carteira-alvo/page.tsx` | Passa a meta e `classValues` |
| `src/features/smart-buy/components/aporte-calculator.tsx`, `aporte/explain.ts` + teste, `aporte/excluded-card.tsx`, `aporte/orders.tsx` | Divisão, ordens por carteira |
| `src/app/(app)/recomendacoes/page.tsx` | Passa as duas entradas, a meta e `classValues` |
| `CLAUDE.md`, specs | Docs |

---

### Task 1: Cascata com limites por carteira, divisão e aporte combinado (código puro)

**Goal:** `sunoCascade` com `caps`, `splitByClassTarget` e `classAporte`, todos testados.

**Files:**
- Modify: `src/features/smart-buy/domain/risk.ts`
- Modify: `src/features/smart-buy/domain/suno-cascade.ts:214-220`
- Create: `src/features/smart-buy/domain/class-split.ts`, `class-split.test.ts`
- Create: `src/features/smart-buy/domain/class-aporte.ts`, `class-aporte.test.ts`
- Modify: `src/features/smart-buy/domain/suno-cascade.test.ts` (um caso novo)
- Modify: `src/features/smart-buy/index.ts`

**Acceptance Criteria:**
- [ ] `sunoCascade(amount, assets)` sem `caps` dá os mesmos resultados de hoje (os testes atuais passam sem mudança).
- [ ] Com `STOCK_CAPS`, um ativo passa de 35% do aporte sem setor e o macro não limita; nenhum passa de 25%.
- [ ] `splitByClassTarget`: duas classes abaixo da meta; uma acima; as duas acima; uma que não pode receber; meta 0% nunca recebe; a soma das partes é o aporte, em centavos.
- [ ] `classAporte`: o troco das ações compra FIIs; o troco dos FIIs volta para as ações; `fii.spent + stock.spent + leftover = amount`; com `fiiPercent = 100`, `fii` é igual a `sunoCascade(amount, fii)` e não há ordens de ações; invariantes em 200 carteiras aleatórias com semente (nenhuma ação passa de 25% do `stock.amount`; a soma fecha).

**Verify:** `npx vitest run src/features/smart-buy` → todos passam.

**Steps:**

- [ ] **Step 1: Limites**

Em `src/features/smart-buy/domain/risk.ts`, depois de `RISK_CAPS`:

```ts
/** Travas como fração do aporte da carteira. Infinity: sem trava. */
export type RiskCaps = { asset: number; sector: number; macro: number };

/**
 * Travas da carteira de ações (spec aporte por classe, §4.3): só 25% por ação. O app não tem setor
 * de ações, e o macro (papel/tijolo) é de FII.
 */
export const STOCK_CAPS: RiskCaps = { asset: 0.25, sector: Infinity, macro: Infinity };
```

Em `suno-cascade.ts`:

```ts
export function sunoCascade(
  amount: number,
  assets: readonly CascadeAsset[],
  limits: RiskCaps = RISK_CAPS,
): CascadeResult {
  const { budget, strategyValue, slots, excluded } = prepare(amount, assets);
  const caps = {
    asset: limits.asset * budget,
    sector: limits.sector * budget,
    macro: limits.macro * budget,
  };
```

(importar `type RiskCaps`). `Infinity * budget` é `Infinity`, e com `budget = 0` vira `NaN`: trate `budget <= 0` devolvendo o resultado vazio antes, se `prepare` ainda não o fizer — confira o comportamento atual com `amount = 0` e mantenha-o. O tipo `CascadeResult.caps` aceita `Infinity`.

Teste novo em `suno-cascade.test.ts` (use os helpers do arquivo para montar ativos; ajuste os nomes):

```ts
describe("sunoCascade: travas da carteira de ações", () => {
  it("sem setor nem macro, só 25% por ação", () => {
    // 4 ações no mesmo macro "Outros", sem setor, todas muito abaixo da meta.
    const assets = ["AAAA3", "BBBB3", "CCCC3", "DDDD3"].map((ticker, index) =>
      asset({ ticker, rank: index + 1, weight: 0.25, price: 10, ceiling: 20, macro: "Outros", sector: null }),
    );
    const withStock = sunoCascade(1000, assets, STOCK_CAPS);
    for (const order of withStock.orders) expect(order.total).toBeLessThanOrEqual(250 + 1e-6);
    expect(withStock.spent).toBeCloseTo(1000, 2);
    // Com as travas de FII, o macro "Outros" segura em 60%.
    expect(sunoCascade(1000, assets).spent).toBeLessThanOrEqual(600 + 1e-6);
  });
});
```

- [ ] **Step 2: Divisão — teste**

```ts
// src/features/smart-buy/domain/class-split.test.ts
import { describe, expect, it } from "vitest";
import { splitByClassTarget } from "./class-split";

const both = { FII: true, ACAO: true };

describe("splitByClassTarget", () => {
  it("as duas abaixo da meta: proporcional aos pedidos", () => {
    // Total depois = 1000 + 0 + 1000 = 2000; metas 1600 e 400; pedidos 600 e 400 = 1000.
    const split = splitByClassTarget({
      amount: 1000,
      target: { fiiPercent: 80 },
      values: { FII: 1000, ACAO: 0 },
      canReceive: both,
    });
    expect(split.FII).toEqual({ asked: 600, share: 600 });
    expect(split.ACAO).toEqual({ asked: 400, share: 400 });
  });

  it("pedidos maiores que o aporte: divide na proporção", () => {
    const split = splitByClassTarget({
      amount: 100,
      target: { fiiPercent: 50 },
      values: { FII: 0, ACAO: 0 },
      canReceive: both,
    });
    expect(split.FII.share + split.ACAO.share).toBeCloseTo(100, 2);
    expect(split.FII.share).toBeCloseTo(50, 2);
  });

  it("uma acima da meta: tudo para a outra", () => {
    const split = splitByClassTarget({
      amount: 1000,
      target: { fiiPercent: 80 },
      values: { FII: 10_000, ACAO: 0 },
      canReceive: both,
    });
    expect(split.FII.share).toBe(0);
    expect(split.ACAO.share).toBe(1000);
  });

  it("as duas acima (pedidos menores que o aporte): o resto vai pela %", () => {
    const split = splitByClassTarget({
      amount: 1000,
      target: { fiiPercent: 80 },
      values: { FII: 8000, ACAO: 2000 },
      canReceive: both,
    });
    expect(split.FII.share).toBeCloseTo(800, 2);
    expect(split.ACAO.share).toBeCloseTo(200, 2);
  });

  it("classe que não pode receber: a parte vai para a outra", () => {
    const split = splitByClassTarget({
      amount: 1000,
      target: { fiiPercent: 50 },
      values: { FII: 0, ACAO: 0 },
      canReceive: { FII: true, ACAO: false },
    });
    expect(split.FII.share).toBe(1000);
    expect(split.ACAO.share).toBe(0);
  });

  it("meta 0% nunca recebe, mesmo sendo a única que poderia", () => {
    const split = splitByClassTarget({
      amount: 1000,
      target: { fiiPercent: 100 },
      values: { FII: 0, ACAO: 0 },
      canReceive: { FII: false, ACAO: true },
    });
    expect(split.ACAO.share).toBe(0);
    expect(split.FII.share).toBe(0);
  });

  it("partes em centavos que somam o aporte", () => {
    const split = splitByClassTarget({
      amount: 100,
      target: { fiiPercent: 33 },
      values: { FII: 0, ACAO: 0 },
      canReceive: both,
    });
    expect(Math.round(split.FII.share * 100)).toBe(split.FII.share * 100);
    expect(split.FII.share + split.ACAO.share).toBeCloseTo(100, 6);
  });
});
```

Run → FAIL (módulo não existe).

- [ ] **Step 3: Divisão — código**

```ts
// src/features/smart-buy/domain/class-split.ts
// Divisão do aporte entre FIIs e ações pela meta por classe (spec aporte por classe, §4.2).

export type ClassKey = "FII" | "ACAO";
/** Meta de alocação entre as classes: a % de FIIs; a das ações é o resto. */
export type ClassTarget = { fiiPercent: number };
export type ClassShare = { asked: number; share: number };
export type ClassSplit = Record<ClassKey, ClassShare>;

/** Sem meta salva: tudo para FIIs, como antes da carteira de ações. */
export const DEFAULT_CLASS_TARGET: ClassTarget = { fiiPercent: 100 };

const KEYS: readonly ClassKey[] = ["FII", "ACAO"];
const round2 = (value: number) => Math.round(value * 100) / 100;
const floorCents = (value: number) => Math.floor(value * 100 + 1e-6) / 100;

/**
 * Cada classe pede o que falta para a meta × (patrimônio das duas + aporte). Pedidos acima do
 * aporte dividem na proporção; abaixo, o resto vai pela %. Meta 0% ou classe sem ativo elegível
 * não recebe, e a parte vai para a outra. As partes são em centavos e somam o aporte.
 */
export function splitByClassTarget(input: {
  amount: number;
  target: ClassTarget;
  values: Record<ClassKey, number>;
  canReceive: Record<ClassKey, boolean>;
}): ClassSplit {
  const { amount, values } = input;
  const percent: Record<ClassKey, number> = {
    FII: input.target.fiiPercent / 100,
    ACAO: 1 - input.target.fiiPercent / 100,
  };
  const total = values.FII + values.ACAO + amount;
  const asked: Record<ClassKey, number> = {
    FII: Math.max(0, percent.FII * total - values.FII),
    ACAO: Math.max(0, percent.ACAO * total - values.ACAO),
  };
  const receivers = KEYS.filter((key) => input.canReceive[key] && percent[key] > 0);
  const raw: Record<ClassKey, number> = { FII: 0, ACAO: 0 };
  if (amount > 0 && receivers.length === 1) {
    raw[receivers[0]!] = amount;
  } else if (amount > 0 && receivers.length === 2) {
    const sumAsked = asked.FII + asked.ACAO;
    for (const key of KEYS) {
      raw[key] =
        sumAsked >= amount
          ? (amount * asked[key]) / sumAsked
          : asked[key] + (amount - sumAsked) * percent[key];
    }
  }
  const share: Record<ClassKey, number> = { FII: floorCents(raw.FII), ACAO: floorCents(raw.ACAO) };
  const rest = round2(amount - share.FII - share.ACAO);
  if (rest > 0 && receivers.length > 0) {
    const key =
      receivers.length === 1 ? receivers[0]! : asked.ACAO > asked.FII ? "ACAO" : "FII";
    share[key] = round2(share[key] + rest);
  }
  return {
    FII: { asked: round2(asked.FII), share: share.FII },
    ACAO: { asked: round2(asked.ACAO), share: share.ACAO },
  };
}
```

Run → PASS.

- [ ] **Step 4: Aporte combinado — teste**

`src/features/smart-buy/domain/class-aporte.test.ts`: use os helpers de `suno-cascade.test.ts` como modelo (copie um `asset(...)` mínimo para este arquivo; ele não exporta helpers). Casos:

```ts
import { describe, expect, it } from "vitest";
import { classAporte } from "./class-aporte";
import { sunoCascade } from "./suno-cascade";
// const asset = (patch: Partial<CascadeAsset> & { ticker: string }): CascadeAsset => ({ ...defaults, ...patch });

describe("classAporte", () => {
  it("com meta 100% FIIs, igual à cascata só de FIIs e sem ações", () => {
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 10, ceiling: 20 })];
    const stock = [asset({ ticker: "PETR4", rank: 1, weight: 1, price: 30, ceiling: 50, macro: "Outros" })];
    const result = classAporte({ amount: 1000, target: { fiiPercent: 100 }, values: { FII: 0, ACAO: 0 }, fii, stock });
    expect(result.fii).toEqual(sunoCascade(1000, fii));
    expect(result.stock.orders).toEqual([]);
  });

  it("o troco das ações compra FIIs", () => {
    // Ações recebem 300 mas a cota custa 400: tudo vira troco e vai para os FIIs.
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 10, ceiling: 20 })];
    const stock = [asset({ ticker: "PETR4", rank: 1, weight: 1, price: 400, ceiling: 500, macro: "Outros" })];
    const result = classAporte({ amount: 1000, target: { fiiPercent: 70 }, values: { FII: 0, ACAO: 0 }, fii, stock });
    expect(result.split.ACAO.share).toBeCloseTo(300, 2);
    expect(result.stock.spent).toBe(0);
    expect(result.transfers.stockToFii).toBeCloseTo(300, 2);
    expect(result.fii.amount).toBeCloseTo(1000, 2);
  });

  it("o troco dos FIIs volta para as ações", () => {
    // FII de cota cara deixa troco; a ação barata absorve.
    const fii = [asset({ ticker: "AAAA11", rank: 1, weight: 1, price: 333, ceiling: 500 })];
    const stock = [asset({ ticker: "PETR4", rank: 1, weight: 1, price: 1, ceiling: 2, macro: "Outros" })];
    const result = classAporte({ amount: 1000, target: { fiiPercent: 90 }, values: { FII: 0, ACAO: 0 }, fii, stock });
    expect(result.transfers.fiiToStock).toBeGreaterThan(0);
    expect(result.stock.spent).toBeGreaterThan(100 - 1e-6);
  });

  it("gasto + troco = aporte, e nenhuma ação passa de 25% da parte final (200 carteiras)", () => {
    // gerador com semente (copie o do suno-cascade.test.ts, se houver), 2–6 FIIs e 1–5 ações,
    // preços de 5 a 500, metas de 0 a 100, patrimônios de 0 a 50 mil.
    // para cada caso:
    //   expect(result.fii.spent + result.stock.spent + result.leftover).toBeCloseTo(amount, 2);
    //   for (const order of result.stock.orders) expect(order.total).toBeLessThanOrEqual(0.25 * result.stock.amount + 1e-6);
  });
});
```

O caso aleatório deve ter o gerador escrito por inteiro (veja o de `suno-cascade.test.ts`, que roda 500 carteiras com semente, e reaproveite a mesma técnica).

Run → FAIL.

- [ ] **Step 5: Aporte combinado — código**

```ts
// src/features/smart-buy/domain/class-aporte.ts
// Aporte nas duas carteiras (spec aporte por classe, §4.4): divide pela meta, roda uma cascata
// por carteira e passa o troco de uma para a outra.
import { splitByClassTarget, type ClassKey, type ClassSplit, type ClassTarget } from "./class-split";
import { STOCK_CAPS } from "./risk";
import { sunoCascade, type CascadeAsset, type CascadeResult } from "./suno-cascade";

export type ClassAporteResult = {
  split: ClassSplit;
  fii: CascadeResult;
  stock: CascadeResult;
  /** Troco que passou de uma carteira para a outra. */
  transfers: { stockToFii: number; fiiToStock: number };
  leftover: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Tem ao menos um ativo da estratégia com rank, teto e preço. */
const hasEligible = (assets: readonly CascadeAsset[]) =>
  assets.some(
    (asset) => asset.weight > 0 && asset.rank !== null && asset.ceiling !== null && asset.price !== null,
  );

export function classAporte(input: {
  amount: number;
  target: ClassTarget;
  values: Record<ClassKey, number>;
  fii: readonly CascadeAsset[];
  stock: readonly CascadeAsset[];
}): ClassAporteResult {
  const canReceive: Record<ClassKey, boolean> = {
    FII: hasEligible(input.fii) && input.target.fiiPercent > 0,
    ACAO: hasEligible(input.stock) && input.target.fiiPercent < 100,
  };
  const split = splitByClassTarget({
    amount: input.amount,
    target: input.target,
    values: input.values,
    canReceive,
  });
  let stock = sunoCascade(split.ACAO.share, input.stock, STOCK_CAPS);
  // O troco das ações vai para os FIIs, se eles podem receber.
  const stockToFii = canReceive.FII ? stock.leftover : 0;
  const fii = sunoCascade(round2(split.FII.share + stockToFii), input.fii);
  let fiiToStock = 0;
  if (fii.leftover > 0 && canReceive.ACAO) {
    // O troco das ações já foi para os FIIs: a nova rodada usa o que elas gastaram + o troco dos FIIs.
    const again = sunoCascade(round2(stock.spent + fii.leftover), input.stock, STOCK_CAPS);
    if (again.spent > stock.spent) {
      fiiToStock = round2(again.spent - stock.spent);
      stock = again;
    }
  }
  return {
    split,
    fii,
    stock,
    transfers: { stockToFii: round2(stockToFii), fiiToStock },
    leftover: round2(input.amount - fii.spent - stock.spent),
  };
}
```

Exportar em `src/features/smart-buy/index.ts`: `STOCK_CAPS`, `type RiskCaps`, `splitByClassTarget`, `DEFAULT_CLASS_TARGET`, `type ClassKey`, `type ClassTarget`, `type ClassSplit`, `type ClassShare`, `classAporte`, `type ClassAporteResult`.

Run: `npx vitest run src/features/smart-buy && npm run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/smart-buy
git commit -m "feat(smart-buy): split the aporte between FIIs and stocks by class target"
```

---

### Task 2: Snapshot com `stockCascadeInput` e `classValues`

**Goal:** o snapshot entrega a entrada da cascata de ações e o patrimônio de cada classe.

**Files:**
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Modify: `src/features/portfolio/domain/types.ts` (`PortfolioSnapshot`)
- Modify: `src/features/portfolio/domain/snapshot.test.ts`

**Acceptance Criteria:**
- [ ] `stockCascadeInput` tem só as ações na estratégia, com `weight` da carteira de ações (soma 1), `priceToBook: null`, `vacancy: null`, `macro: "Outros"`, `sector: null`, e `lastDividend`/`dividends12m` do `PriceInfo`.
- [ ] `classValues.FII + classValues.ACAO = summary.patrimony` em Geral.
- [ ] `cascadeInput` não muda (os testes atuais passam).

**Verify:** `npx vitest run src/features/portfolio/domain/snapshot.test.ts && npm run typecheck` → passa.

**Steps:**

- [ ] **Step 1: Teste** — no `describe("buildSnapshot: Carteira Alvo de ações")` de `snapshot.test.ts` (que já tem `input` com AAAA11, BBBB11, PETR4 70% e VALE3 30%):

```ts
  it("stockCascadeInput traz só as ações da estratégia, sem P/VP, vacância nem setor", () => {
    const { stockCascadeInput } = buildSnapshot(input);
    expect(stockCascadeInput.map((asset) => asset.ticker)).toEqual(["PETR4", "VALE3"]);
    expect(stockCascadeInput.map((asset) => asset.weight)).toEqual([0.7, 0.3]);
    for (const asset of stockCascadeInput) {
      expect(asset).toMatchObject({ priceToBook: null, vacancy: null, macro: "Outros", sector: null });
    }
  });

  it("classValues soma o patrimônio", () => {
    const snapshot = buildSnapshot(input);
    expect(snapshot.classValues.FII + snapshot.classValues.ACAO).toBeCloseTo(snapshot.summary.patrimony, 6);
    expect(snapshot.classValues.ACAO).toBeCloseTo(250, 6); // 20 PETR4 + 5 VALE3 a R$ 10
  });
```

(Confira a ordem: a cascata de FIIs segue a ordem dos alvos; mantenha a mesma regra.)

- [ ] **Step 2: Código** — em `snapshot.ts`, extrair o corpo do `map` da `cascadeInput` para uma função `toCascadeAsset(member, weights, stock: boolean)`: com `stock`, `priceToBook: null`, `vacancy: null`, `macro: "Outros"`, `sector: null` (sem chamar `classifyRisk`); sem `stock`, como hoje. Então:

```ts
  const cascadeInput = strategies.FII.members.map((member) => toCascadeAsset(member, strategies.FII.weights, false));
  // Carteira de ações (spec aporte por classe, §4.5): só a margem até o teto e o freio de proventos agem.
  const stockCascadeInput = strategies.ACAO.members.map((member) =>
    toCascadeAsset(member, strategies.ACAO.weights, true),
  );
```

`classValues`, depois de `open`/`valueOf`:

```ts
  const classValues = { FII: 0, ACAO: 0 };
  for (const position of open) classValues[classKey(position.ticker)] += valueOf(position.ticker);
```

Retornar `stockCascadeInput` e `classValues`; em `types.ts`, `PortfolioSnapshot` ganha `stockCascadeInput: CascadeAsset[];` e `classValues: { FII: number; ACAO: number };` com comentários curtos.

- [ ] **Step 3: Conferir e commit**

Run: `npm test && npm run typecheck && npm run lint` → passa.

```bash
git add src/features/portfolio/domain
git commit -m "feat(portfolio): expose the stock cascade input and class values"
```

---

### Task 3: Meta por classe (dados e ação do servidor)

**Goal:** guardar e ler a meta por portfólio.

**Files:**
- Create: `src/features/strategy/server/class-target.model.ts`
- Create: `src/features/strategy/server/class-target-repo.ts`
- Modify: `src/features/strategy/server/strategy-dal.ts`, `src/features/strategy/server.ts`
- Modify: `src/features/strategy/schemas.ts`, `src/features/strategy/actions.ts`

**Acceptance Criteria:**
- [ ] Coleção `class_targets` com `portfolioId` (único) e `fiiPercent` (inteiro 0–100), timestamps.
- [ ] `getMyClassTarget()` (React `cache`, tenant da sessão) devolve `{ fiiPercent } | null`.
- [ ] `setClassTargetAction({ fiiPercent })`: Zod inteiro 0–100, upsert por `portfolioId`, `refresh()`, `metadata({ actionName: "setClassTarget" })` sem `traceInput`.

**Verify:** `npm run typecheck && npm run lint && npm test` → passa. (Não chame a ação contra o banco.)

**Steps:**

- [ ] **Step 1: Modelo** — seguir `target-asset.model.ts`:

```ts
// src/features/strategy/server/class-target.model.ts
import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Meta de alocação entre FIIs e ações (spec aporte por classe, §5). Uma por portfólio. */
export interface ClassTargetDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  fiiPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

const classTargetSchema = new Schema<ClassTargetDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true, unique: true },
    fiiPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: { validator: Number.isInteger, message: "A % de FIIs é um número inteiro." },
    },
  },
  { timestamps: true },
);

export const ClassTargetModel: Model<ClassTargetDoc> =
  (mongoose.models.ClassTarget as Model<ClassTargetDoc> | undefined) ??
  mongoose.model<ClassTargetDoc>("ClassTarget", classTargetSchema, "class_targets");
```

- [ ] **Step 2: Repositório** — seguir o estilo de `target-asset-repo.ts` (`connectMongo`, `toObjectId`, `mongoose.trusted` onde houver operador):

```ts
// src/features/strategy/server/class-target-repo.ts
import "server-only";
// imports de connectMongo/toObjectId como em target-asset-repo.ts
import { ClassTargetModel } from "./class-target.model";

export async function findClassTarget(portfolioId: string): Promise<{ fiiPercent: number } | null> {
  await connectMongo();
  const doc = await ClassTargetModel.findOne({ portfolioId: toObjectId(portfolioId) }).lean();
  return doc ? { fiiPercent: doc.fiiPercent } : null;
}

export async function saveClassTarget(portfolioId: string, fiiPercent: number): Promise<void> {
  await connectMongo();
  await ClassTargetModel.updateOne(
    { portfolioId: toObjectId(portfolioId) },
    { $set: { fiiPercent } },
    { upsert: true, runValidators: true },
  );
}
```

(Com `sanitizeFilter` ligado, `$set` em update é aceito; confira como `upsertTargetAsset` escreve o update e copie o padrão.)

- [ ] **Step 3: DAL** — em `strategy-dal.ts`, ao lado do leitor de alvos, `export const getMyClassTarget = cache(async () => findClassTarget((await getTenant()).portfolioId));` no mesmo estilo do arquivo; exportar em `strategy/server.ts`.

- [ ] **Step 4: Ação** — `schemas.ts`: `export const classTargetSchema = z.object({ fiiPercent: z.number().int("Use um número inteiro").min(0).max(100) });`. `actions.ts`:

```ts
/** Grava a meta entre FIIs e ações (spec aporte por classe, §5). */
export const setClassTargetAction = authActionClient
  .metadata({ actionName: "setClassTarget" })
  .inputSchema(classTargetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await saveClassTarget(ctx.tenant.portfolioId, parsedInput.fiiPercent);
    refresh();
    return { ok: true as const };
  });
```

- [ ] **Step 5: Conferir e commit**

```bash
git add src/features/strategy
git commit -m "feat(strategy): store the allocation target between FIIs and stocks"
```

---

### Task 4: Painel "Meta entre classes" na Carteira Alvo

**Goal:** ver e editar a meta nas duas abas da Carteira Alvo.

**Files:**
- Create: `src/features/strategy/components/class-target-panel.tsx`
- Modify: `src/features/strategy/ui.ts`
- Modify: `src/features/strategy/components/strategy-table.tsx` (tirar a linha "As Recomendações ainda são só de FIIs.")
- Modify: `src/app/(app)/carteira-alvo/page.tsx`

**Acceptance Criteria:**
- [ ] O painel mostra o campo da % de FIIs (salva ao sair, com `NumberField` inteiro 0–100 e `setClassTargetAction`), a % de ações calculada e a alocação atual de cada classe (`classValues`).
- [ ] Sem meta salva: "Sem meta: o aporte vai todo para FIIs." e o campo vazio.
- [ ] No celular (`max-md`), o painel é uma célula de `InsetGroup` que abre uma `Drawer`/`ResponsiveDialog` com o campo.
- [ ] A linha "As Recomendações ainda são só de FIIs." sai da aba Ações (tabela e ⓘ).
- [ ] A página busca `getMyClassTarget()` e `classValues` de `getPortfolioSnapshot()` (o mesmo que o `QuoteStatus` já pede), dentro da `<Suspense>`.

**Verify:** `npm run typecheck && npm run lint && npm test` → passa; `npm run dev` → `/carteira-alvo` mostra o painel (não salve nada: o banco é produção).

**Steps:**

- [ ] **Step 1:** criar `ClassTargetPanel({ target, values }: { target: { fiiPercent: number } | null; values: { FII: number; ACAO: number } })` como um `Card` pequeno (`size="sm"`), no estilo dos cards da tela: título "Meta entre classes", a linha "FIIs X% · Ações Y%" com o campo (reaproveite `table/number-field.tsx` com `integer` e validação 0–100), e "Hoje: FIIs A% · Ações B%" (`formatPercent` sobre `values`). Use `useAction(setClassTargetAction)` com `toast` de erro (`actionErrorMessage`), como `use-target-row.ts`. Valores dentro de `<Sensitive>` quando forem R$; % não precisam.
- [ ] **Step 2:** exportar em `ui.ts`; na página, dentro do `StrategyContent`, buscar em paralelo `getMyClassTarget()` e `getPortfolioSnapshot()` (para `classValues`) além do snapshot da classe, e renderizar `<div className="grid gap-4 md:gap-6"><ClassTargetPanel … /><StrategyTable … /></div>`.
- [ ] **Step 3:** em `strategy-table.tsx`, remover a linha e o parágrafo do ⓘ "As Recomendações ainda são só de FIIs.".
- [ ] **Step 4: Conferir e commit**

```bash
git add src/features/strategy src/app/\(app\)/carteira-alvo/page.tsx
git commit -m "feat(strategy): edit the class target on the target portfolio"
```

---

### Task 5: Recomendações com as duas carteiras

**Goal:** a calculadora divide o aporte, mostra as ordens por carteira e o troco final.

**Files:**
- Modify: `src/app/(app)/recomendacoes/page.tsx`
- Modify: `src/features/smart-buy/components/aporte-calculator.tsx`
- Modify: `src/features/smart-buy/components/aporte/explain.ts`, `explain.test.ts`
- Modify: `src/features/smart-buy/components/aporte/excluded-card.tsx`, `orders.tsx` (prop da classe, se precisar do texto)

**Acceptance Criteria:**
- [ ] A página passa `fiiAssets={cascadeInput}`, `stockAssets={stockCascadeInput}`, `target={await getMyClassTarget()}`, `values={classValues}` e `meta` com nome/logo de FIIs e ações (das linhas da estratégia de FIIs + das posições).
- [ ] A calculadora usa `classAporte` (com `DEFAULT_CLASS_TARGET` sem meta) e mostra: a divisão "FIIs R$ X · Ações R$ Y" com "Ações em A% contra a meta de B%"; quando houve troco cruzado, a linha "R$ Z do troco das ações foi para FIIs" (ou o contrário); os cards de resumo com aporte, ordens (soma das duas) e troco final.
- [ ] As ordens em dois cards, "FIIs" e "Ações" (o de ações só quando há parte ou ordens de ações), cada um com a sua lista/tabela e a sua `ExcludedCard`.
- [ ] `explain(order, "ACAO")` e `shortReason(order, "ACAO")`: sem P/VP nem vacância; o limite "ativo" diz "limite de 25% da parte das ações"; `REASON_HELP` de `LIMITE_ATIVO` para ações fala "da parte das ações". Teste em `explain.test.ts`.
- [ ] Sem meta salva: aviso "Defina a meta entre FIIs e ações na Carteira Alvo." com link para `/carteira-alvo`.
- [ ] "Copiar ordens" copia as duas carteiras, com um cabeçalho por carteira, o total e o troco.
- [ ] `RISK_NOTE` e `CALCULATION_NOTE` mencionam as ações (25% por ação, só teto e proventos).

**Verify:** `npx vitest run src/features/smart-buy && npm run typecheck && npm run lint` → passa; `npm run dev` → `/recomendacoes?valor=10000` (só leitura).

**Steps:**

- [ ] **Step 1: "Por quê"** — `explain.ts`:
  - `type OrderClass = "FII" | "ACAO";`
  - `limitText(order, kind)`: para `"ativo"`, `kind === "ACAO" ? \`limite de ${formatPercent(STOCK_CAPS.asset, 0)} da parte das ações\` : <texto de hoje>`;
  - `explain(order, kind: OrderClass = "FII")` e `shortReason(order, kind: OrderClass = "FII")` passam `kind` para `limitText`; os ramos de P/VP e vacância já somem para ações porque `priceToBook` é null e o macro é "Outros" — mantenha assim;
  - `reasonHelp(kind)`: devolve `REASON_HELP` com `LIMITE_ATIVO` trocado para "Uma cota custa mais que o limite de 25% da parte das ações por ação." quando `kind === "ACAO"`.
  - Teste:

```ts
it("na ação, o limite fala da parte das ações e não há P/VP", () => {
  const order = { ...baseOrder, priceToBook: null, vacancy: null, macro: "Outros", limitedBy: "ativo" } as CascadeOrder;
  const parts = explain(order, "ACAO");
  expect(parts.join(" · ")).toContain("limite de 25% da parte das ações");
  expect(parts.join(" · ")).not.toContain("P/VP");
});
```

(use o `baseOrder`/fixture que o `explain.test.ts` já tem).

- [ ] **Step 2: Calculadora** — `AporteCalculator({ fiiAssets, stockAssets, target, values, meta })`:

```ts
  const result =
    amount > 0
      ? classAporte({ amount, target: target ?? DEFAULT_CLASS_TARGET, values, fii: fiiAssets, stock: stockAssets })
      : null;
```

  - Os cards de resumo usam `amount`, `result.fii.spent + result.stock.spent` e `result.leftover`.
  - Um bloco de divisão logo abaixo do campo (dentro do card do valor ou num `Card size="sm"`), com as partes, a alocação atual (`values`) e a meta.
  - Extrair o card de ordens atual para `OrdersCard({ title, result, kind, meta })` no mesmo arquivo (ou em `aporte/orders-card.tsx`), que monta `excludedByReason`, `limitedAny`, as listas e a `ExcludedCard` (passando `kind` para o texto de ajuda); renderizar `OrdersCard` para FIIs e, se `result.split.ACAO.share > 0 || result.stock.orders.length > 0`, para ações.
  - `copyOrders`: "FIIs:" + linhas, "Ações:" + linhas, "Total … · Troco …".
- [ ] **Step 3: Página** — `RecommendationsContent`:

```tsx
  const [{ cascadeInput, stockCascadeInput, classValues, strategy, positions }, target] = await Promise.all([
    getPortfolioSnapshot(),
    getMyClassTarget(),
  ]);
  const meta = [...strategy.rows, ...positions].map((row) => ({ ticker: row.ticker, name: row.name, logoUrl: row.logoUrl }));
  // (deduplique por ticker)
  return <AporteCalculator fiiAssets={cascadeInput} stockAssets={stockCascadeInput} target={target} values={classValues} meta={meta} />;
```

- [ ] **Step 4: Conferir e commit**

```bash
git add src/features/smart-buy src/app/\(app\)/recomendacoes/page.tsx
git commit -m "feat(smart-buy): recommend the aporte across FIIs and stocks"
```

---

### Task 6: Docs, verificação completa e conferência com os dados reais

**Goal:** docs atualizados, checagens verdes, e a divisão conferida com os dados reais, só lendo.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-31-carteira-alvo-acoes-design.md`, `2026-10-31-aporte-por-classe-design.md`
- Create (fora do repositório, não commitar): script de conferência

**Acceptance Criteria:**
- [ ] CLAUDE.md: Domain flow item 3 (divisão pela meta, cascata de ações com `STOCK_CAPS`, troco cruzado, `classAporte`), Pages (`/recomendacoes` com as duas carteiras; `/carteira-alvo` com o painel da meta), Product rules (Aporte engine e Stocks: as ações agora entram nas Recomendações pela meta), Asset class, Data layer (coleção `class_targets`), Tests (os arquivos novos).
- [ ] Spec da Carteira Alvo de ações: nota "As Recomendações passaram a incluir ações: ver `2026-10-31-aporte-por-classe-design.md`". Spec do aporte: status "aprovado e implementado (branch feat/aporte-por-classe)".
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.
- [ ] O script imprime, para R$ 10.000: com meta 100%, as ordens de FIIs iguais a `sunoCascade(10000, cascadeInput)` (e nenhuma de ações); com meta 80%, a divisão, as ordens das duas carteiras e o troco, com gasto + troco = 10.000.

**Verify:** `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo passa; o script mostra as duas tabelas.

**Steps:**

- [ ] **Step 1:** editar os docs.
- [ ] **Step 2:** rodar a verificação completa.
- [ ] **Step 3: Script (só leitura)** — copiar para a raiz do repositório só para rodar e apagar depois. Ele monta o `SnapshotInput` com os repositórios (`listTransactions`, `listDividends`, `listTargetAssets` com o `portfolioId` 6ad3f6d0e800c0b6c7b75ea5, `readCatalogTypes`, e as cotações de `assets` lidas pelo módulo de leitura de ativos de `market-data/server/*` — confira o nome real, sem chamar nada que busque fora ou grave), chama `buildSnapshot` e `classAporte` com as duas metas e imprime. Use `.mts` e `npx tsx --conditions=react-server --env-file=.env.local`. Confirme `git status` limpo depois.
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs
git commit -m "docs: describe the aporte split between FIIs and stocks"
```
