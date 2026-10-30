# Ações na carteira, etapa 1 (dados e contas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trazer as ações e units dos extratos da B3 para o Koinos: posições, proventos (dividendo, JCP, reembolso, rendimento), aluguel e IR estimado. A Carteira Alvo e as Recomendações continuam só com FIIs.

**Architecture:**
- **Classe do ativo:** `FII` ou `ACAO`, derivada na leitura pela função pura `assetClassOf`, sobre o catálogo da brapi.
  - As telas recebem a classe de `getAssetClasses` e passam um mapa para o código puro.
- **Atualização da B3:** ganha módulos puros em `transactions/import/b3/`: `codes.ts`, `classify.ts`, `lending.ts` e `dividends.ts`.
  - O `plan.ts` passa a gerenciar ações, com a pendência de bonificação e as ações que voltam a mais do aluguel.
- **Contas da carteira:** recebem o mapa de classes.
  - A estratégia ignora ações.
  - A composição ganha a fatia "Ações".
  - O IR das encerradas segue a regra da classe.

**Tech Stack:** Next.js 16, TypeScript, Mongoose, Zod 4, Vitest 5, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md`

**Regras do repositório:**
- **Branch:** `feat/acoes-etapa-1`, que já existe, com a spec. Cada push na `main` vai para produção, e só o Task 13 empurra, com o ok do dono.
- **Banco:** o `.env.local` aponta para o banco de produção. Nenhum passo grava nele: o script de importação roda com `--dry-run`, e o script de conferência só lê.
- **Variáveis dos comandos** (Git Bash):

  ```bash
  NEG="d:/Downloads/negociacao-2026-10-30-17-39-46.xlsx"
  MOV="d:/Downloads/movimentacao-2026-10-30-17-39-14.xlsx"
  EV="d:/Downloads/eventos-2026-10-30-17-42-18.xlsx"
  SCRATCH="<a pasta de rascunho da sessão, fora do repositório>"
  ```

- **Verificação completa:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.
- **Fora dos commits:** `.gitignore`, `.claude/` e `.mcp.json` foram mudados pela ferramenta code-review-graph, fora desta tarefa. Cada commit adiciona só os caminhos listados no próprio passo.
- **Hook desta máquina:** um hook troca alguns comandos (`grep -r`, `git diff`, `ls`) por `rtk`, que não está instalado. Se um deles falhar com `rtk: command not found`, use a ferramenta Grep, `git --no-pager diff` ou o PowerShell.
- **Banco em dia:** em 30/10/2026, o plano de hoje com estes extratos não mudava nada nos FIIs (zero lançamentos e proventos novos ou trocados). Por isso o critério 4 vale ao pé da letra.
- **Idiomas:** comentários e textos em pt-BR. Commits em inglês (Conventional Commits), terminando com as linhas de atribuição da sessão.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/features/market-data/domain/asset-class.ts` | Criar | `assetClassOf`: FII ou ação, pelo catálogo e pelo código |
| `src/features/market-data/domain/asset-class.test.ts` | Criar | Testes da classe |
| `src/features/market-data/index.ts` | Modificar | Exportar a classe |
| `src/features/market-data/server/catalog.ts` | Modificar | `getAssetClasses` sobre o catálogo em cache |
| `src/features/market-data/server.ts` | Modificar | Exportar `getAssetClasses` |
| `src/features/transactions/domain/types.ts` | Modificar | `BONIFICACAO`; `DIVIDENDO`, `JCP`, `ALUGUEL` |
| `src/features/transactions/domain/contributions.ts` | Modificar | A bonificação não é aporte |
| `src/features/transactions/server/dividend.model.ts` | Modificar | Ticker de ação |
| `src/features/transactions/server/dividend-forecast.model.ts` | Modificar | Ticker de ação |
| `src/features/transactions/schemas.ts` | Modificar | Respostas `bon:` e qualquer ticker |
| `src/features/transactions/import/b3/codes.ts` | Criar | Padrões de código da B3 e utilitários |
| `src/features/transactions/import/b3/lending.ts` | Criar | Saídas e voltas de aluguel (§5.5) |
| `src/features/transactions/import/b3/lending.test.ts` | Criar | Testes do aluguel |
| `src/features/transactions/import/b3/dividends.ts` | Criar | Proventos, "a receber" e conferência (§5.6 e §6) |
| `src/features/transactions/import/b3/dividends.test.ts` | Criar | Testes dos tipos e da conferência |
| `src/features/transactions/import/b3/classify.ts` | Criar | Classificação dos ativos dos extratos |
| `src/features/transactions/import/b3/plan.ts` | Modificar | Ações no plano |
| `src/features/transactions/import/b3/types.ts` | Modificar | Pendência de bonificação; classe no plano |
| `scripts/import-b3.ts` | Modificar | Textos do relatório |
| `src/features/transactions/components/b3-import/*` | Modificar | Pendência, rótulos e textos da prévia |
| `src/features/transactions/components/table/transaction-type.tsx` | Modificar | Rótulo da bonificação |
| `src/features/transactions/server/b3-import.ts` | Modificar | Texto do erro da conferência |
| `src/features/portfolio/domain/types.ts` | Modificar | `assetClass` nos DTOs; `taxExempt` |
| `src/features/portfolio/domain/snapshot.ts` | Modificar | Classes; estratégia só com FIIs |
| `src/features/portfolio/domain/snapshot.test.ts` | Modificar | Testes das ações no snapshot |
| `src/features/portfolio/domain/allocation.ts` | Modificar | Fatia "Ações" |
| `src/features/portfolio/domain/closed-positions.ts` | Modificar | IR das ações (§8) |
| `src/features/portfolio/domain/closed-positions.test.ts` | Criar | Testes do IR |
| `src/features/portfolio/server/snapshot.ts` | Modificar | Lê as classes |
| `src/features/portfolio/server/dividends-view.ts` | Modificar | Yahoo e "não divulgado" só FIIs |
| `src/features/portfolio/server/closed-positions-view.ts` | Modificar | Lê as classes |
| `src/features/portfolio/components/closed/*`, `closed-positions.tsx`, `dividends/*`, `reinvestment/purchases-table.tsx` | Modificar | "Isento", notas do IR e "Ativo" no lugar de "FII" |
| `src/features/transactions/components/ticker-input.tsx` | Modificar | Sugestões só de FIIs, quando pedido |
| `src/features/strategy/components/table/add-asset-form.tsx` | Modificar | Busca só de FIIs |
| `src/features/strategy/actions.ts` | Modificar | Recusa ação |
| `CLAUDE.md`, specs antigos | Modificar | Documentação |

---

### Task 1: Classe do ativo (FII ou ação)

**Goal:** `assetClassOf` decide se o ticker é FII ou ação pelo catálogo da brapi e, fora dele, pelo código. `getAssetClasses` aplica a regra sobre o catálogo em cache.

**Files:**
- Create: `src/features/market-data/domain/asset-class.ts`
- Create: `src/features/market-data/domain/asset-class.test.ts`
- Modify: `src/features/market-data/index.ts`
- Modify: `src/features/market-data/server/catalog.ts`
- Modify: `src/features/market-data/server.ts`

**Acceptance Criteria:**
- [ ] `assetClassOf("TAEE11", { type: "stock", subType: "unit" })` dá `"ACAO"`, e `assetClassOf("BOVA11", { type: "fund", subType: "etf" })` dá `null`.
- [ ] Fora do catálogo, `MALL11` dá `"FII"`, `NEOE3` dá `"ACAO"`, e `PETR1`, `PETR9`, `PETR10` e `BTLG12` dão `null`.
- [ ] `@/features/market-data/server` exporta `getAssetClasses`.
- [ ] O teste passa, e `npm run typecheck` e `npm run lint` terminam sem erros.

**Verify:** `npx vitest run src/features/market-data/domain/asset-class.test.ts && npm run typecheck && npm run lint` → 7 testes passam, sem erros.

**Steps:**

- [ ] **Step 1: Escrever o teste**

`src/features/market-data/domain/asset-class.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetClassOf } from "./asset-class";

const fund = (subType: string | null) => ({ type: "fund", subType });
const stock = (subType: string) => ({ type: "stock", subType });

describe("assetClassOf: pelo catálogo da brapi", () => {
  it("FII e Fiagro são FII", () => {
    expect(assetClassOf("BTLG11", fund("fii"))).toBe("FII");
    expect(assetClassOf("SNAG11", fund("fi-agro"))).toBe("FII");
  });

  it("ação e unit são ação", () => {
    expect(assetClassOf("PETR4", stock("stock"))).toBe("ACAO");
    expect(assetClassOf("TAEE11", stock("unit"))).toBe("ACAO");
  });

  it("fundo sem subtipo só é FII com código XXXX11", () => {
    expect(assetClassOf("ABCD11", fund(null))).toBe("FII");
    expect(assetClassOf("ABCD13", fund(null))).toBeNull();
  });

  it("ETF, FI-Infra, FIP e FIDC ficam de fora", () => {
    expect(assetClassOf("BOVA11", fund("etf"))).toBeNull();
    expect(assetClassOf("JURO11", fund("fi-infra"))).toBeNull();
    expect(assetClassOf("ABCD11", fund("fip"))).toBeNull();
    expect(assetClassOf("ABCD11", fund("fidc"))).toBeNull();
  });
});

describe("assetClassOf: fora do catálogo, pelo código", () => {
  it("XXXX11 é FII que saiu da bolsa", () => {
    expect(assetClassOf("MALL11", null)).toBe("FII");
  });

  it("4 caracteres + 3 a 8 é ação que saiu da bolsa", () => {
    expect(assetClassOf("NEOE3", null)).toBe("ACAO");
    expect(assetClassOf("B3SA3", null)).toBe("ACAO");
    expect(assetClassOf("ABCD8", null)).toBe("ACAO");
  });

  it("direitos, recibos e o resto ficam de fora", () => {
    for (const code of ["PETR1", "PETR2", "PETR9", "PETR10", "BTLG12", "SNCI13", "CDB"]) {
      expect(assetClassOf(code, null)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/market-data/domain/asset-class.test.ts`
Expected: FAIL, "Failed to resolve import "./asset-class"".

- [ ] **Step 3: Implementar**

`src/features/market-data/domain/asset-class.ts`:

```ts
// Classe do ativo no app (spec 2026-10-30-acoes-etapa-1, §4): FII (FIIs e Fiagros) ou ação
// (ações e units). Pura: decide pelo catálogo da brapi e, fora dele, pelo código.

export type AssetClass = "FII" | "ACAO";

/** Tipo e subtipo de um ticker no catálogo da brapi. */
export type CatalogType = { type: string | null; subType: string | null };

/** Cota de FII: 4 caracteres + 11. */
const FII_CODE = /^[A-Z0-9]{4}11$/;
/** Ação: 4 caracteres + 3 (ON) a 8 (PND). Direitos (1 e 2) e recibos (9 e 10) ficam de fora. */
const STOCK_CODE = /^[A-Z0-9]{4}[3-8]$/;

/**
 * FII ou ação; null para o que o app não acompanha (ETF, FI-Infra, FIP, FIDC, BDR, direitos,
 * recibos e renda fixa). `info` é a entrada do catálogo, ou null quando o ticker não está nele.
 */
export function assetClassOf(ticker: string, info: CatalogType | null): AssetClass | null {
  if (info) {
    if (info.type === "stock") return "ACAO";
    if (info.type !== "fund") return null;
    const subType = info.subType?.toLowerCase() ?? null;
    if (subType === "fii" || subType === "fi-agro") return "FII";
    return !subType && FII_CODE.test(ticker) ? "FII" : null;
  }
  // Fora do catálogo: quem saiu da bolsa (MALL11, NEOE3...).
  if (FII_CODE.test(ticker)) return "FII";
  if (STOCK_CODE.test(ticker)) return "ACAO";
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/features/market-data/domain/asset-class.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Exportar pela API pública**

Em `src/features/market-data/index.ts`, depois do bloco de `market-hours`, acrescente:

```ts
export { assetClassOf, type AssetClass, type CatalogType } from "./domain/asset-class";
```

- [ ] **Step 6: `getAssetClasses` no servidor**

Em `src/features/market-data/server/catalog.ts`, troque o import:

```ts
import type { CatalogEntry } from "../ports";
```

por:

```ts
import { assetClassOf, type AssetClass } from "../domain/asset-class";
import type { CatalogEntry } from "../ports";
```

E acrescente no fim do arquivo:

```ts
/**
 * Classe de cada ticker (FII ou ação, spec ações etapa 1, §4) pelo catálogo em cache; fora dele,
 * pelo código. As telas passam o mapa para as regras puras.
 */
export async function getAssetClasses(
  tickers: readonly string[],
): Promise<Map<string, AssetClass | null>> {
  const entries = await loadCatalog();
  const byTicker = new Map(entries.map((entry) => [entry.ticker, entry]));
  return new Map(
    [...new Set(tickers)].map((ticker) => {
      const entry = byTicker.get(ticker);
      return [
        ticker,
        assetClassOf(ticker, entry ? { type: entry.type, subType: entry.subType } : null),
      ];
    }),
  );
}
```

Em `src/features/market-data/server.ts`, troque:

```ts
export { getCatalogSubType, refreshCatalog, searchTickers } from "./server/catalog";
```

por:

```ts
export {
  getAssetClasses,
  getCatalogSubType,
  refreshCatalog,
  searchTickers,
} from "./server/catalog";
```

- [ ] **Step 7: Verificar e commitar**

```bash
npx vitest run src/features/market-data/domain/asset-class.test.ts && npm run typecheck && npm run lint
npx prettier --write src/features/market-data
git add src/features/market-data
git commit -m "feat(market-data): classify tickers as FII or stock"
```

---

### Task 2: Tipos novos de lançamento e provento

**Goal:** criar os tipos novos e ajustar o que depende deles:
- o livro-razão ganha `BONIFICACAO`, e os proventos ganham `DIVIDENDO`, `JCP` e `ALUGUEL`;
- os modelos aceitam ticker de ação;
- as respostas da prévia aceitam `bon:` (com 0) e qualquer ticker;
- a bonificação não conta como aporte.

**Files:**
- Modify: `src/features/transactions/domain/types.ts`
- Modify: `src/features/transactions/domain/contributions.ts`
- Modify: `src/features/transactions/server/dividend.model.ts`
- Modify: `src/features/transactions/server/dividend-forecast.model.ts`
- Modify: `src/features/transactions/schemas.ts`
- Modify: `src/features/transactions/components/table/transaction-type.tsx`
- Modify: `src/features/transactions/components/b3-import/preview-sections.tsx` (só os rótulos)

**Acceptance Criteria:**
- [ ] `TRANSACTION_KINDS` tem `BONIFICACAO`. `DIVIDEND_KINDS` é `RENDIMENTO`, `REEMBOLSO`, `DIVIDENDO`, `JCP`, `ALUGUEL`.
- [ ] O `match` do ticker em `dividends` e em `dividend_forecasts` é `/^[A-Z0-9]{4}\d{1,2}$/`.
- [ ] `b3AnswersSchema.parse({ prices: { "bon:EGIE3:2025-11-28": 0 }, exclude: ["PETR4"] })` passa.
- [ ] `monthlyContributions` pula a compra `BONIFICACAO`.
- [ ] `npm run typecheck`, `npm run lint` e `npm test` terminam sem erros.

**Verify:** `npx tsx "$SCRATCH/check-schema.ts" && npm run typecheck && npm run lint && npm test` → imprime o objeto aceito, e nada falha.

**Steps:**

- [ ] **Step 1: Os tipos**

Em `src/features/transactions/domain/types.ts`, troque:

```ts
/**
 * O que originou o lançamento. O livro-razão só conhece compra e venda: subscrição é compra,
 * desdobro é compra a preço 0 e incorporação é venda da origem + compra do destino pelo mesmo custo.
 */
export const TRANSACTION_KINDS = [
  "NEGOCIO",
  "SUBSCRICAO",
  "DESDOBRO",
  "INCORPORACAO",
```

por:

```ts
/**
 * O que originou o lançamento. O livro-razão só conhece compra e venda: subscrição é compra,
 * desdobro é compra a preço 0, bonificação é compra pelo custo que a empresa atribui e
 * incorporação é venda da origem + compra do destino pelo mesmo custo.
 */
export const TRANSACTION_KINDS = [
  "NEGOCIO",
  "SUBSCRICAO",
  "DESDOBRO",
  "BONIFICACAO",
  "INCORPORACAO",
```

E troque:

```ts
/** Provento recebido, como a B3 informa no extrato de Movimentação. */
export const DIVIDEND_KINDS = ["RENDIMENTO", "REEMBOLSO"] as const;
```

por:

```ts
/**
 * Provento recebido, como a B3 informa no extrato de Movimentação. `ALUGUEL` é a taxa do aluguel
 * (linha "Empréstimo" com valor). No `JCP`, `amount` já vem líquido dos 15% e `perShare` é o bruto.
 */
export const DIVIDEND_KINDS = ["RENDIMENTO", "REEMBOLSO", "DIVIDENDO", "JCP", "ALUGUEL"] as const;
```

- [ ] **Step 2: A bonificação não é aporte**

Em `src/features/transactions/domain/contributions.ts`, troque:

```ts
/**
 * Valor comprado (aportado) em cada mês pedido, incluindo meses sem compra (zero).
 * A compra do destino numa incorporação só transfere custo: não é aporte.
 */
```

por:

```ts
/**
 * Valor comprado (aportado) em cada mês pedido, incluindo meses sem compra (zero).
 * A compra do destino numa incorporação só transfere custo, e a bonificação não sai do bolso:
 * nenhuma das duas é aporte.
 */
```

E troque:

```ts
    if (entry.type !== "BUY" || entry.kind === "INCORPORACAO") continue;
```

por:

```ts
    if (entry.type !== "BUY" || entry.kind === "INCORPORACAO" || entry.kind === "BONIFICACAO")
      continue;
```

- [ ] **Step 3: Os modelos aceitam ticker de ação**

Em `src/features/transactions/server/dividend.model.ts` e em `src/features/transactions/server/dividend-forecast.model.ts`, troque em cada um:

```ts
    ticker: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z0-9]{4}11$/ },
```

por:

```ts
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]{4}\d{1,2}$/,
    },
```

- [ ] **Step 4: As respostas da prévia**

Em `src/features/transactions/schemas.ts`, troque:

```ts
/** Respostas às pendências da importação da B3 (spec §7). Os ids são recalculados no servidor. */
export const b3AnswersSchema = z.object({
  prices: z
    .record(z.string().regex(/^(sub|prev):[A-Z0-9]{4}11\b/), z.number().positive().max(10_000_000))
    .default({}),
  conversions: z
    .record(z.string().regex(/^conv:[A-Z0-9]{4}11:/), z.union([fiiCode, z.literal("NONE")]))
    .default({}),
  exclude: z.array(fiiCode).max(200).default([]),
});
```

por:

```ts
/**
 * Respostas às pendências da importação da B3 (spec §7). Os ids são recalculados no servidor.
 * O custo da bonificação (`bon:`) aceita 0; nos outros preços, o plano ignora o que não for > 0.
 */
export const b3AnswersSchema = z.object({
  prices: z
    .record(
      z.string().regex(/^(sub|prev|bon):[A-Z0-9]{4}\d{1,2}\b/),
      z.number().min(0).max(10_000_000),
    )
    .default({}),
  conversions: z
    .record(z.string().regex(/^conv:[A-Z0-9]{4}11:/), z.union([fiiCode, z.literal("NONE")]))
    .default({}),
  exclude: z.array(z.string().regex(TICKER_REGEX)).max(200).default([]),
});
```

- [ ] **Step 5: Os rótulos**

Em `src/features/transactions/components/table/transaction-type.tsx` e em `src/features/transactions/components/b3-import/preview-sections.tsx`, troque em cada um:

```ts
  DESDOBRO: "Desdobro",
```

por:

```ts
  DESDOBRO: "Desdobro",
  BONIFICACAO: "Bonificação",
```

Em `preview-sections.tsx`, troque também:

```ts
const DIVIDEND_LABELS: Record<DividendKind, string> = {
  RENDIMENTO: "Rendimento",
  REEMBOLSO: "Reembolso",
};
```

por:

```ts
const DIVIDEND_LABELS: Record<DividendKind, string> = {
  RENDIMENTO: "Rendimento",
  REEMBOLSO: "Reembolso",
  DIVIDENDO: "Dividendo",
  JCP: "JCP",
  ALUGUEL: "Aluguel",
};
```

- [ ] **Step 6: Conferir o schema**

Crie `$SCRATCH/check-schema.ts` (fora do repositório):

```ts
import { b3AnswersSchema } from "file:///D:/workspace/koinos/src/features/transactions/schemas.ts";

console.log(
  b3AnswersSchema.parse({ prices: { "bon:EGIE3:2025-11-28": 0 }, exclude: ["PETR4"] }),
);
```

Run: `npx tsx "$SCRATCH/check-schema.ts"`
Expected: `{ prices: { 'bon:EGIE3:2025-11-28': 0 }, conversions: {}, exclude: [ 'PETR4' ] }`

- [ ] **Step 7: Verificar e commitar**

```bash
npm run typecheck && npm run lint && npm test
npx prettier --write src/features/transactions
git add src/features/transactions
git commit -m "feat(transactions): add the bonus entry and the dividend, JCP and lending kinds"
```

---

### Task 3: Códigos da B3 e pareamento do aluguel

**Goal:** os padrões de código da B3 saem do `plan.ts` para `codes.ts`. O `lending.ts` acha as saídas e voltas de aluguel (spec §5.5) e tem testes.

**Files:**
- Create: `src/features/transactions/import/b3/codes.ts`
- Create: `src/features/transactions/import/b3/lending.ts`
- Create: `src/features/transactions/import/b3/lending.test.ts`

**Acceptance Criteria:**
- [ ] **Liquidação de negócio não vira aluguel:**
  - vale a soma dos negócios do dia, fracionário incluso, liquidada de 0 a 7 dias depois;
  - sem uma linha para a soma, vale cada negócio sozinho.
- [ ] **Pareamento:**
  - a volta fecha a saída mais antiga de mesma quantidade ou, sem ela, a maior saída menor que a volta;
  - no mesmo dia, a volta vem antes da saída.
- [ ] **Caso EGIE3:** a única volta maior que a saída é 32 (28/11/2025) → 44 (02/12/2025).
- [ ] **Volta sem saída aberta:** é ignorada.
- [ ] O teste passa.

**Verify:** `npx vitest run src/features/transactions/import/b3/lending.test.ts` → 10 testes passam.

**Steps:**

- [ ] **Step 1: `codes.ts`**

`src/features/transactions/import/b3/codes.ts`:

```ts
// Códigos da B3 e utilitários de data e quantidade da atualização (spec importacao-b3, §4 e §5.2;
// spec ações etapa 1, §5). Puro.

export const DAY = 86_400_000;
export const EPSILON = 1e-6;
/** Cota de FII: 4 caracteres + 11. */
export const FII_CODE = /^[A-Z0-9]{4}11$/;
/** Recibo de subscrição de FII (…13 a …19). */
export const RECEIPT_CODE = /^[A-Z0-9]{4}1[3-9]$/;
/** Direito ou recibo de FII (…12 a …19). */
export const RIGHTS_OR_RECEIPT_CODE = /^[A-Z0-9]{4}1[2-9]$/;
/** Códigos da família de um FII (cota, direito ou recibo): só eles podem ser levados ao FII. */
export const FII_FAMILY_CODE = /^[A-Z0-9]{4}1[1-9]$/;
/** Recibo de subscrição de ação (…9 e …10). */
export const STOCK_RECEIPT_CODE = /^[A-Z0-9]{4}(9|10)$/;
export const TICKER_CODE = /^[A-Z0-9]{4}\d{1,2}$/;

export const family = (code: string) => code.slice(0, 4);
export const fiiOf = (code: string) => `${family(code)}11`;
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const qtyKey = (quantity: number) => String(Math.round(quantity * 1e6) / 1e6);
export const sameQty = (a: number, b: number) => Math.abs(a - b) < EPSILON;
```

- [ ] **Step 2: Escrever o teste do aluguel**

`src/features/transactions/import/b3/lending.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lendingLegs } from "./lending";
import type { B3Trade, MovementRow } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Linha de "Transferência - Liquidação": crédito é volta (ou compra), débito é saída (ou venda). */
const settlement = (code: string, credit: boolean, iso: string, quantity: number): MovementRow => ({
  row: 0,
  credit,
  date: day(iso),
  kind: "Transferência - Liquidação",
  code,
  quantity,
  unitPrice: null,
  value: null,
});

const trade = (ticker: string, type: "BUY" | "SELL", iso: string, quantity: number): B3Trade => ({
  row: 0,
  date: day(iso),
  type,
  ticker,
  quantity,
  unitPrice: 10,
});

describe("lendingLegs: liquidação de negócio não é aluguel", () => {
  it("soma os negócios do dia, fracionário incluso (ITSA4: 2.300 + 10 numa linha de 2.310)", () => {
    const legs = lendingLegs(
      [settlement("ITSA4", false, "2023-01-02", 2310)],
      [trade("ITSA4", "SELL", "2022-12-28", 2300), trade("ITSA4", "SELL", "2022-12-28", 10)],
    );
    expect(legs).toEqual([]);
  });

  it("aceita a liquidação no próprio dia (D+0)", () => {
    const legs = lendingLegs(
      [settlement("XPML11", true, "2023-11-01", 10)],
      [trade("XPML11", "BUY", "2023-11-01", 10)],
    );
    expect(legs).toEqual([]);
  });

  it("sem uma linha para a soma do dia, casa cada negócio sozinho", () => {
    const legs = lendingLegs(
      [settlement("BBSE3", true, "2023-01-04", 60), settlement("BBSE3", true, "2023-01-04", 40)],
      [trade("BBSE3", "BUY", "2023-01-02", 60), trade("BBSE3", "BUY", "2023-01-02", 40)],
    );
    expect(legs).toEqual([]);
  });

  it("depois de 7 dias, a linha já não liquida o negócio: é saída de aluguel", () => {
    const legs = lendingLegs(
      [settlement("PETR4", false, "2023-01-20", 100)],
      [trade("PETR4", "SELL", "2023-01-02", 100)],
    );
    expect(legs).toEqual([
      { ticker: "PETR4", out: day("2023-01-20"), outQuantity: 100, back: null, backQuantity: null },
    ]);
  });
});

describe("lendingLegs: pareamento das saídas e voltas", () => {
  it("a volta fecha a saída de mesma quantidade", () => {
    const legs = lendingLegs(
      [settlement("EGIE3", false, "2023-02-13", 100), settlement("EGIE3", true, "2023-02-28", 100)],
      [],
    );
    expect(legs).toEqual([
      {
        ticker: "EGIE3",
        out: day("2023-02-13"),
        outQuantity: 100,
        back: day("2023-02-28"),
        backQuantity: 100,
      },
    ]);
  });

  it("fecha a saída mais antiga; a outra continua alugada", () => {
    const legs = lendingLegs(
      [
        settlement("PETR4", false, "2024-01-10", 100),
        settlement("PETR4", false, "2024-02-10", 100),
        settlement("PETR4", true, "2024-03-10", 100),
      ],
      [],
    );
    expect(legs.map((leg) => [leg.out, leg.back])).toEqual([
      [day("2024-01-10"), day("2024-03-10")],
      [day("2024-02-10"), null],
    ]);
  });

  it("no mesmo dia, a volta vem antes da saída", () => {
    const legs = lendingLegs(
      [
        settlement("VALE3", false, "2024-01-10", 100),
        settlement("VALE3", false, "2024-02-01", 100),
        settlement("VALE3", true, "2024-02-01", 100),
      ],
      [],
    );
    expect(legs.map((leg) => [leg.out, leg.back])).toEqual([
      [day("2024-01-10"), day("2024-02-01")],
      [day("2024-02-01"), null],
    ]);
  });

  it("EGIE3: as 32 alugadas na bonificação voltaram 44 (+12)", () => {
    const legs = lendingLegs(
      [
        settlement("EGIE3", false, "2025-11-04", 32),
        settlement("EGIE3", false, "2025-11-06", 68),
        settlement("EGIE3", true, "2025-11-11", 32),
        settlement("EGIE3", false, "2025-11-13", 32),
        settlement("EGIE3", true, "2025-11-25", 32),
        settlement("EGIE3", false, "2025-11-28", 32),
        settlement("EGIE3", true, "2025-11-28", 68),
        settlement("EGIE3", true, "2025-12-02", 44),
      ],
      [],
    );
    expect(legs.filter((leg) => (leg.backQuantity ?? 0) > leg.outQuantity)).toEqual([
      {
        ticker: "EGIE3",
        out: day("2025-11-28"),
        outQuantity: 32,
        back: day("2025-12-02"),
        backQuantity: 44,
      },
    ]);
  });

  it("volta sem saída aberta é ignorada", () => {
    expect(lendingLegs([settlement("SNFF11", true, "2021-06-17", 1)], [])).toEqual([]);
  });

  it("ignora as outras linhas da Movimentação", () => {
    const transfer: MovementRow = {
      ...settlement("EGIE3", false, "2023-02-07", 100),
      kind: "Transferência",
    };
    expect(lendingLegs([transfer], [])).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/features/transactions/import/b3/lending.test.ts`
Expected: FAIL, "Failed to resolve import "./lending"".

- [ ] **Step 4: Implementar**

`src/features/transactions/import/b3/lending.ts`:

```ts
import { DAY, EPSILON, sameQty } from "./codes";
import type { B3Trade, MovementRow } from "./types";

// Aluguel de ações e cotas (spec ações etapa 1, §5.5). Puro: o plano decide o que fazer com as
// ações que voltam a mais, e a conferência pelos proventos usa as janelas do aluguel.

const SETTLEMENT_KIND = "Transferência - Liquidação";
/** Um negócio liquida de D+0 a D+7 corridos (D+2, mais fins de semana e feriados). */
const SETTLEMENT_MAX_DAYS = 7;

/** Um contrato de aluguel: a saída das ações e a volta, se já houve. */
export type LendingLeg = {
  ticker: string;
  out: Date;
  outQuantity: number;
  /** Null enquanto as ações estão alugadas. */
  back: Date | null;
  backQuantity: number | null;
};

/**
 * Saídas e voltas de aluguel, pelas linhas de "Transferência - Liquidação" que não liquidam
 * um negócio:
 * 1. Liquidação de negócio: os negócios do ativo no mesmo pregão e sentido, somados (fracionário
 *    incluso), de 0 a 7 dias depois; sem uma linha para a soma, cada negócio sozinho.
 * 2. O resto é aluguel: débito é saída, crédito é volta.
 * 3. Cada volta fecha a saída aberta mais antiga de mesma quantidade ou, sem ela, a maior saída
 *    aberta menor que a volta. No mesmo dia, as voltas vêm antes das saídas. Volta sem saída
 *    aberta é ignorada: é uma liquidação que o passo 1 não reconheceu.
 */
export function lendingLegs(
  rows: readonly MovementRow[],
  trades: readonly B3Trade[],
): LendingLeg[] {
  const settlements = rows
    .filter((row) => row.kind === SETTLEMENT_KIND && (row.quantity ?? 0) > EPSILON)
    .map((row) => ({
      code: row.code,
      credit: row.credit,
      date: row.date,
      quantity: row.quantity ?? 0,
      used: false,
    }));

  // 1. Negócios do pregão, somados por ativo, dia e sentido.
  const groups = new Map<
    string,
    { ticker: string; date: Date; buy: boolean; total: number; parts: number[] }
  >();
  for (const trade of trades) {
    const key = `${trade.ticker}|${trade.date.getTime()}|${trade.type}`;
    const group = groups.get(key) ?? {
      ticker: trade.ticker,
      date: trade.date,
      buy: trade.type === "BUY",
      total: 0,
      parts: [],
    };
    group.total += trade.quantity;
    group.parts.push(trade.quantity);
    groups.set(key, group);
  }
  const settle = (ticker: string, date: Date, buy: boolean, quantity: number) => {
    const match = settlements.find((row) => {
      const days = (row.date.getTime() - date.getTime()) / DAY;
      return (
        !row.used &&
        row.code === ticker &&
        row.credit === buy &&
        sameQty(row.quantity, quantity) &&
        days >= 0 &&
        days <= SETTLEMENT_MAX_DAYS
      );
    });
    if (match) match.used = true;
    return Boolean(match);
  };
  for (const group of [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (settle(group.ticker, group.date, group.buy, group.total)) continue;
    for (const part of group.parts) settle(group.ticker, group.date, group.buy, part);
  }

  // 2 e 3. O resto é aluguel.
  const loans = settlements
    .filter((row) => !row.used)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || Number(b.credit) - Number(a.credit));
  const open = new Map<string, { date: Date; quantity: number }[]>();
  const legs: LendingLeg[] = [];
  for (const row of loans) {
    const list = open.get(row.code) ?? [];
    open.set(row.code, list);
    if (!row.credit) {
      list.push({ date: row.date, quantity: row.quantity });
      continue;
    }
    let index = list.findIndex((item) => sameQty(item.quantity, row.quantity));
    if (index < 0) {
      const smaller = list.filter((item) => item.quantity < row.quantity - EPSILON);
      if (smaller.length > 0) {
        const largest = Math.max(...smaller.map((item) => item.quantity));
        index = list.findIndex((item) => item.quantity === largest);
      }
    }
    if (index < 0) continue;
    const [out] = list.splice(index, 1);
    legs.push({
      ticker: row.code,
      out: out!.date,
      outQuantity: out!.quantity,
      back: row.date,
      backQuantity: row.quantity,
    });
  }
  for (const [ticker, list] of open) {
    for (const item of list) {
      legs.push({ ticker, out: item.date, outQuantity: item.quantity, back: null, backQuantity: null });
    }
  }
  return legs.sort((a, b) => a.out.getTime() - b.out.getTime() || a.ticker.localeCompare(b.ticker));
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/features/transactions/import/b3/lending.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Verificar e commitar**

```bash
npm run typecheck && npm run lint
npx prettier --write src/features/transactions/import/b3
git add src/features/transactions/import/b3/codes.ts src/features/transactions/import/b3/lending.ts src/features/transactions/import/b3/lending.test.ts
git commit -m "feat(b3): pair the lending outs and backs of the movement statement"
```

---

### Task 4: Proventos, "a receber" e conferência num módulo próprio

**Goal:** `extractDividends`, `extractUpcoming` e `dividendCheck` saem do `plan.ts` para `dividends.ts`, já com os tipos das ações, o aluguel e a regra de conferência das ações, e ganham testes.
- O `plan.ts` passa a usar o módulo e o `codes.ts`.
- Nesta tarefa, ele continua mandando só os FIIs, e a única mudança no resultado é o aluguel dos FIIs.

**Files:**
- Create: `src/features/transactions/import/b3/dividends.ts`
- Create: `src/features/transactions/import/b3/dividends.test.ts`
- Modify: `src/features/transactions/import/b3/plan.ts`

**Acceptance Criteria:**
- [ ] Antes de mexer no `plan.ts`, `$SCRATCH/baseline.txt` guarda o dry-run atual.
- [ ] Os testes cobrem os tipos de cada linha (spec §6.1 e §6.2) e a conferência das ações (§5.6), e passam:
  - a janela de 365 dias;
  - a linha que bate sozinha;
  - a soma do mesmo provento;
  - a diferença explicada pelo aluguel.
- [ ] O `plan.ts` não tem mais `extractDividends`, `extractUpcoming`, `dividendCheck`, `DIVIDEND_ROW_KINDS` nem `FORECAST_EVENT_KINDS`.
- [ ] No dry-run depois da mudança, só a linha `Proventos:` muda, de `624 (R$ 172.602,80)` para `631 (R$ 172.749,66)`.
  - A diferença são os 7 aluguéis dos FIIs que ficam OK no dry-run sem carteira: BRCO11, SNAG11 e SNFF11.
  - VISC11 e XPML11 ficam PENDENTE sem a carteira, então o aluguel deles não entra.

**Verify:** `npx vitest run src/features/transactions/import/b3 && diff "$SCRATCH/baseline.txt" "$SCRATCH/task4.txt"` → os testes passam, e o `diff` mostra só a linha `Proventos:`.

**Steps:**

- [ ] **Step 1: Guardar o baseline, antes de qualquer mudança no `plan.ts`**

```bash
npm run -s import:b3 -- --negociacao "$NEG" --movimentacao "$MOV" --dry-run > "$SCRATCH/baseline.txt"
tail -n 3 "$SCRATCH/baseline.txt"
```

Expected: termina com `--dry-run: nada foi gravado.`

- [ ] **Step 2: Escrever os testes**

`src/features/transactions/import/b3/dividends.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
import type { EventoRow, MovementRow } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const time = (iso: string) => day(iso).getTime();

const movement = (
  kind: string,
  code: string,
  iso: string,
  fields: Partial<MovementRow> = {},
): MovementRow => ({
  row: 0,
  credit: true,
  date: day(iso),
  kind,
  code,
  quantity: null,
  unitPrice: null,
  value: null,
  ...fields,
});

const evento = (code: string, eventType: string, fields: Partial<EventoRow> = {}): EventoRow => ({
  row: 0,
  code,
  eventType,
  payDate: null,
  quantity: null,
  unitPrice: null,
  value: null,
  ...fields,
});

// Os ativos do teste: o SNCI11 (e os códigos da família dele) e quatro ações.
const STOCKS = new Set(["PETR4", "BBAS3", "EGIE3", "ITSA4"]);
const tickerOf = (code: string) =>
  STOCKS.has(code) ? code : /^SNCI1[1-9]$/.test(code) ? "SNCI11" : null;
const isStock = (ticker: string) => STOCKS.has(ticker);
const period = { start: day("2019-11-01"), end: day("2026-10-30") };
type Timeline = Map<string, [number, number][]>;

describe("extractDividends: o tipo de cada linha da Movimentação", () => {
  const planned = extractDividends(
    [
      movement("Rendimento", "SNCI11", "2026-01-15", { quantity: 1000, unitPrice: 0.11, value: 110 }),
      movement("Rendimento", "SNCI13", "2026-01-15", { quantity: 100, unitPrice: 0.05, value: 5 }),
      movement("Dividendo", "BBAS3", "2023-06-12", { quantity: 100, unitPrice: 0.123, value: 12.3 }),
      movement("Juros Sobre Capital Próprio", "BBAS3", "2023-03-31", {
        quantity: 100,
        unitPrice: 0.352,
        value: 29.92,
      }),
      movement("Rendimento", "PETR4", "2026-05-20", { quantity: 100, unitPrice: 0.016, value: 1.28 }),
      movement("Reembolso", "PETR4", "2024-05-20", { quantity: 0, value: 144.38 }),
      movement("Empréstimo", "EGIE3", "2023-03-31", { quantity: 0, value: 1.94 }),
      // O "Empréstimo" que abre o contrato não tem valor.
      movement("Empréstimo", "EGIE3", "2023-03-31", { quantity: 100 }),
      movement("Rendimento - Transferido", "SNCI11", "2021-04-20", { quantity: 54, value: 32.86 }),
      movement("Dividendo", "BBAS3", "2023-06-12", { credit: false, quantity: 100, value: 12.3 }),
      movement("Dividendo", "CDB", "2023-06-12", { value: 1 }),
    ],
    period,
    tickerOf,
    () => true,
    [],
  );

  it("leva cada crédito ao tipo da B3, com o valor que ela mostra", () => {
    expect(planned.inserts.map((item) => [item.ticker, item.kind, item.amount])).toEqual([
      ["SNCI11", "RENDIMENTO", 110],
      ["SNCI11", "RENDIMENTO", 5],
      ["BBAS3", "DIVIDENDO", 12.3],
      ["BBAS3", "JCP", 29.92],
      ["PETR4", "RENDIMENTO", 1.28],
      ["PETR4", "REEMBOLSO", 144.38],
      ["EGIE3", "ALUGUEL", 1.94],
    ]);
  });

  it("no JCP, o valor é o líquido e o valor por ação, o bruto", () => {
    expect(planned.inserts.find((item) => item.kind === "JCP")).toMatchObject({
      amount: 29.92,
      quantity: 100,
      perShare: 0.352,
    });
  });

  it("o aluguel vem com a quantidade do contrato e sem valor por ação", () => {
    expect(planned.inserts.find((item) => item.kind === "ALUGUEL")).toMatchObject({
      quantity: 0,
      perShare: null,
    });
  });

  it("o escopo da troca tem os ativos dos proventos", () => {
    expect(planned.tickers).toEqual(["BBAS3", "EGIE3", "PETR4", "SNCI11"]);
  });
});

describe("extractUpcoming: o tipo de cada linha do Eventos", () => {
  it("dividendo, JCP e reembolsos das ações; rendimento dos FIIs", () => {
    const ignored: string[] = [];
    const upcoming = extractUpcoming(
      {
        rows: [
          evento("PETR4", "Reembolso - JUROS SOBRE CAPITAL PRÓPRIO", {
            payDate: day("2026-11-23"),
            unitPrice: 0.67,
            value: 55.61,
          }),
          evento("PETR4", "Reembolso - DIVIDENDO", {
            payDate: day("2026-12-21"),
            unitPrice: 0.47,
            value: 47.15,
          }),
          evento("EGIE3", "DIVIDENDO", { quantity: 139, unitPrice: 0.54, value: 75.64 }),
          evento("BBAS3", "JUROS SOBRE CAPITAL PRÓPRIO", {
            payDate: day("2026-12-10"),
            quantity: 200,
            unitPrice: 0.1,
            value: 17,
          }),
          evento("SNCI11", "RENDIMENTO", {
            payDate: day("2026-11-14"),
            quantity: 1000,
            unitPrice: 0.11,
            value: 110,
          }),
          evento("PETR4", "BONIFICAÇÃO EM ATIVOS", { value: 0 }),
        ],
        rowErrors: [],
      },
      day("2026-10-30"),
      tickerOf,
      (_reason, code) => ignored.push(code),
    );
    expect(upcoming.items.map((item) => [item.ticker, item.kind, item.payDate, item.amount])).toEqual([
      ["PETR4", "REEMBOLSO", day("2026-11-23"), 55.61],
      ["PETR4", "REEMBOLSO", day("2026-12-21"), 47.15],
      ["EGIE3", "DIVIDENDO", null, 75.64],
      ["BBAS3", "JCP", day("2026-12-10"), 17],
      ["SNCI11", "RENDIMENTO", day("2026-11-14"), 110],
    ]);
    expect(ignored).toEqual(["PETR4"]);
  });
});

describe("dividendCheck: ações", () => {
  it("acha a posição até um ano antes do pagamento (JCP pago depois da venda)", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      [
        "ITSA4",
        [
          [time("2022-01-03"), 2310],
          [time("2022-12-28"), 0],
        ],
      ],
    ]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "ITSA4", "2023-10-02", {
          quantity: 2310,
          unitPrice: 0.052,
          value: 101.19,
        }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1, explained: [], unexplained: [] });
  });

  it("no FII, a janela continua de 45 dias", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([
      [
        "SNCI11",
        [
          [time("2022-01-03"), 1000],
          [time("2022-12-28"), 0],
        ],
      ],
    ]);
    const check = dividendCheck({
      rows: [movement("Rendimento", "SNCI11", "2023-10-02", { quantity: 1000, value: 110 })],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check.unexplained).toHaveLength(1);
  });

  it("JCP e dividendo no mesmo dia, cada um sobre a posição inteira, batem", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([["BBAS3", [[time("2023-01-02"), 100]]]]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "BBAS3", "2023-06-12", {
          quantity: 100,
          unitPrice: 0.654,
          value: 55.62,
        }),
        movement("Dividendo", "BBAS3", "2023-06-12", { quantity: 100, unitPrice: 0.123, value: 12.3 }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1 });
  });

  it("o mesmo provento em duas corretoras bate pela soma", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([["PETR4", [[time("2023-01-02"), 100]]]]);
    const check = dividendCheck({
      rows: [
        movement("Dividendo", "PETR4", "2023-12-15", { quantity: 60, unitPrice: 0.575, value: 34.5 }),
        movement("Dividendo", "PETR4", "2023-12-15", { quantity: 40, unitPrice: 0.575, value: 23 }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [],
    });
    expect(check).toMatchObject({ months: 1, matched: 1 });
  });

  it("com as ações alugadas, a diferença fica explicada pelo aluguel", () => {
    const timeline: Timeline = new Map<string, [number, number][]>([["EGIE3", [[time("2023-01-02"), 139]]]]);
    const check = dividendCheck({
      rows: [
        movement("Juros Sobre Capital Próprio", "EGIE3", "2026-05-20", {
          quantity: 0.2,
          unitPrice: 0.088,
          value: 0.01,
        }),
      ],
      timeline,
      tickerOf,
      isStock,
      legs: [{ ticker: "EGIE3", out: day("2026-04-30"), outQuantity: 139, back: null, backQuantity: null }],
    });
    expect(check.explained).toEqual([
      { ticker: "EGIE3", month: "2026-05", official: 0.2, rebuilt: 139, reason: "ações alugadas (aluguel)" },
    ]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/features/transactions/import/b3/dividends.test.ts`
Expected: FAIL, "Failed to resolve import "./dividends"".

- [ ] **Step 4: Implementar `dividends.ts`**

`src/features/transactions/import/b3/dividends.ts`:

```ts
import type { DividendKind } from "../../domain/types";
import { normalizeHeader } from "./cells";
import { DAY, EPSILON, FII_CODE, RECEIPT_CODE, fiiOf, isoDay, sameQty } from "./codes";
import type { LendingLeg } from "./lending";
import type {
  DividendCheck,
  DividendCheckItem,
  EventosData,
  MovementRow,
  PlannedDividend,
  PlannedDividends,
  PlannedForecast,
  PlannedUpcoming,
} from "./types";

// Proventos, "a receber" e a conferência pelos proventos (spec proventos, §3.1; spec
// atualizacao-b3, §3; spec ações etapa 1, §5.6 e §6). Puro: o plano decide os ativos aceitos.

/**
 * O ativo de uma linha de provento ou de "a receber", se o app o acompanha: a própria ação ou o
 * FII da família (`…12` a `…19` vão ao `…11`). Null para o resto.
 */
export type DividendTickerOf = (code: string) => string | null;

// Map, e não objeto: um tipo de linha como "constructor" não pode achar nada no prototype.
const DIVIDEND_ROW_KINDS = new Map<string, DividendKind>([
  ["Rendimento", "RENDIMENTO"],
  ["Reembolso", "REEMBOLSO"],
  ["Dividendo", "DIVIDENDO"],
  ["Juros Sobre Capital Próprio", "JCP"],
  // A taxa do aluguel vem no "Empréstimo" com valor; o que abre o contrato não tem valor.
  ["Empréstimo", "ALUGUEL"],
]);

/** Os créditos de provento e de aluguel da Movimentação, com o valor que a B3 mostra. */
export function extractDividends(
  rows: readonly MovementRow[],
  period: PlannedDividends["period"],
  tickerOf: DividendTickerOf,
  accepts: (ticker: string) => boolean,
  acceptedTickers: readonly string[],
): PlannedDividends {
  const inserts: PlannedDividend[] = [];
  for (const row of rows) {
    const kind = DIVIDEND_ROW_KINDS.get(row.kind);
    if (!row.credit || !kind) continue;
    if (row.value === null || row.value <= 0) continue;
    const ticker = tickerOf(row.code);
    if (!ticker || !accepts(ticker)) continue;
    inserts.push({
      ticker,
      paidAt: row.date,
      kind,
      amount: row.value,
      quantity: row.quantity,
      perShare: row.unitPrice,
    });
  }
  // Escopo da troca: os ativos aceitos do plano e os que só aparecem pelos próprios proventos.
  const tickers = new Set([...acceptedTickers, ...inserts.map((item) => item.ticker)]);
  return { period, tickers: [...tickers].sort(), inserts };
}

// Map, e não objeto, pelo mesmo motivo de DIVIDEND_ROW_KINDS. Chaves sem acento e minúsculas.
const FORECAST_EVENT_KINDS = new Map<string, DividendKind>([
  ["rendimento", "RENDIMENTO"],
  ["reembolso - rendimento", "REEMBOLSO"],
  ["dividendo", "DIVIDENDO"],
  ["juros sobre capital proprio", "JCP"],
  ["reembolso - dividendo", "REEMBOLSO"],
  ["reembolso - juros sobre capital proprio", "REEMBOLSO"],
]);

/** A foto do "a receber" (extrato de Eventos): o valor líquido e a previsão da B3. */
export function extractUpcoming(
  eventos: EventosData,
  asOf: Date,
  tickerOf: DividendTickerOf,
  addIgnored: (reason: string, code: string) => void,
): PlannedUpcoming {
  const items: PlannedForecast[] = [];
  for (const row of eventos.rows) {
    // O que o app não acompanha já entrou nos ignorados pela classificação.
    const ticker = tickerOf(row.code);
    if (!ticker) continue;
    const kind = FORECAST_EVENT_KINDS.get(normalizeHeader(row.eventType));
    if (!kind || row.value === null || row.value <= 0) {
      addIgnored("Eventos que não são provento", row.code);
      continue;
    }
    items.push({
      ticker,
      kind,
      payDate: row.payDate,
      quantity: row.quantity,
      perShare: row.unitPrice,
      amount: row.value,
    });
  }
  return { asOf, items };
}

/** A ação paga muito depois da data com: o JCP do ITSA4 de out/2023 era da posição de dez/2022. */
const STOCK_LOOKBACK_DAYS = 365;
const FII_LOOKBACK_DAYS = 45;
const STOCK_CHECK_KINDS = new Set(["Dividendo", "Juros Sobre Capital Próprio", "Rendimento"]);

export type DividendCheckInput = {
  rows: readonly MovementRow[];
  /** Posição de cada ativo depois de cada lançamento: [data, quantidade]. */
  timeline: ReadonlyMap<string, [number, number][]>;
  tickerOf: DividendTickerOf;
  isStock: (ticker: string) => boolean;
  /** Contratos de aluguel (lending.ts): também explicam diferenças. */
  legs: readonly LendingLeg[];
};

type OfficialMonth = {
  ticker: string;
  month: string;
  /** Data do último pagamento do mês. */
  last: number;
  /** Quantidades que, se forem a posição de algum dia da janela, fazem o mês bater. */
  candidates: number[];
  /** A que a prévia mostra: nos FIIs, a soma do mês; nas ações, a maior linha. */
  shown: number;
};

/**
 * Conferência pelos proventos (spec importacao-b3, §6.7; spec ações etapa 1, §5.6).
 * - FIIs: créditos de Rendimento e Reembolso por FII e mês, somados (duas corretoras pagam
 *   duas linhas). A posição igual é buscada até 45 dias antes do pagamento.
 * - Ações: cada linha de Dividendo, JCP e Rendimento com quantidade, e a soma das linhas do
 *   mesmo provento (tipo, dia e valor por ação). O mês bate se uma delas é a posição de algum
 *   dia até 365 dias antes. O mês não é somado inteiro: JCP e dividendo do mesmo dia são, cada
 *   um, sobre a posição inteira.
 */
export function dividendCheck({
  rows,
  timeline,
  tickerOf,
  isStock,
  legs,
}: DividendCheckInput): DividendCheck {
  const quantityAt = (ticker: string, when: number) => {
    let quantity = 0;
    for (const [date, value] of timeline.get(ticker) ?? []) {
      if (date > when) break;
      quantity = value;
    }
    return quantity;
  };

  const fiiMonths = new Map<string, { ticker: string; month: string; quantity: number; last: number }>();
  const stockMonths = new Map<
    string,
    { ticker: string; month: string; last: number; rows: number[]; events: Map<string, number> }
  >();
  for (const row of rows) {
    if (!row.credit) continue;
    const ticker = tickerOf(row.code);
    if (!ticker) continue;
    const month = isoDay(row.date).slice(0, 7);
    const key = `${ticker}|${month}`;
    if (isStock(ticker)) {
      if (!STOCK_CHECK_KINDS.has(row.kind) || !row.quantity || row.quantity <= 0) continue;
      const item = stockMonths.get(key) ?? { ticker, month, last: 0, rows: [], events: new Map() };
      item.rows.push(row.quantity);
      const event = `${row.kind}|${row.date.getTime()}|${row.unitPrice ?? ""}`;
      item.events.set(event, (item.events.get(event) ?? 0) + row.quantity);
      item.last = Math.max(item.last, row.date.getTime());
      stockMonths.set(key, item);
      continue;
    }
    if (row.kind !== "Rendimento" && row.kind !== "Reembolso") continue;
    const item = fiiMonths.get(key) ?? { ticker, month, quantity: 0, last: 0 };
    item.quantity += row.quantity ?? 0;
    item.last = Math.max(item.last, row.date.getTime());
    fiiMonths.set(key, item);
  }
  const official: OfficialMonth[] = [
    ...[...fiiMonths.values()].map((item) => ({
      ticker: item.ticker,
      month: item.month,
      last: item.last,
      candidates: [item.quantity],
      shown: item.quantity,
    })),
    ...[...stockMonths.values()].map((item) => ({
      ticker: item.ticker,
      month: item.month,
      last: item.last,
      candidates: [...new Set([...item.rows, ...item.events.values()])],
      shown: Math.max(...item.rows),
    })),
  ];

  // Aluguel: do "Empréstimo" que abre o contrato (sem valor) até o que fecha (com a taxa).
  // Enquanto as cotas estão emprestadas, o rendimento vem como "Reembolso", sem quantidade.
  const lending: { ticker: string; from: number; to: number }[] = [];
  const loans = rows.filter(
    (row) =>
      row.credit && row.kind === "Empréstimo" && (FII_CODE.test(row.code) || isStock(row.code)),
  );
  for (const open of loans) {
    if (open.value !== null || !open.quantity) continue;
    const close = loans.find(
      (row) =>
        row.code === open.code &&
        row.value !== null &&
        sameQty(row.quantity ?? 0, open.quantity ?? 0) &&
        row.date >= open.date,
    );
    lending.push({
      ticker: open.code,
      from: open.date.getTime(),
      to: (close?.date.getTime() ?? open.date.getTime()) + 45 * DAY,
    });
  }
  const settlements = rows.filter((row) => row.kind === "Transferência - Liquidação");
  for (const out of settlements) {
    if (out.credit || out.unitPrice !== null || !FII_CODE.test(out.code)) continue;
    const back = settlements.find(
      (row) =>
        row.credit &&
        row.code === out.code &&
        sameQty(row.quantity ?? 0, out.quantity ?? 0) &&
        row.date >= out.date,
    );
    lending.push({
      ticker: out.code,
      from: out.date.getTime(),
      to: (back?.date.getTime() ?? out.date.getTime()) + 45 * DAY,
    });
  }
  // Os contratos pareados pelo lending.ts (ações e FIIs) entram junto.
  for (const leg of legs) {
    lending.push({
      ticker: leg.ticker,
      from: leg.out.getTime(),
      to: (leg.back ?? leg.out).getTime() + 45 * DAY,
    });
  }
  const receipts = rows.filter(
    (row) => row.credit && row.kind === "Recibo de Subscrição" && RECEIPT_CODE.test(row.code),
  );

  let matched = 0;
  const explained: DividendCheckItem[] = [];
  const unexplained: DividendCheckItem[] = [];
  for (const item of official) {
    const lookback = (isStock(item.ticker) ? STOCK_LOOKBACK_DAYS : FII_LOOKBACK_DAYS) * DAY;
    let ok = false;
    for (let when = item.last - lookback; when <= item.last - DAY && !ok; when += DAY) {
      const rebuilt = quantityAt(item.ticker, when);
      ok = item.candidates.some(
        (quantity) => sameQty(rebuilt, quantity) || sameQty(Math.floor(rebuilt + EPSILON), quantity),
      );
    }
    if (ok) {
      matched++;
      continue;
    }
    const rebuilt = quantityAt(item.ticker, item.last - 15 * DAY);
    const lent = lending.some(
      (window) =>
        window.ticker === item.ticker && item.last >= window.from && item.last <= window.to,
    );
    const proRata = receipts.some(
      (receipt) =>
        fiiOf(receipt.code) === item.ticker &&
        item.last >= receipt.date.getTime() &&
        item.last - receipt.date.getTime() <= 60 * DAY,
    );
    const reason = lent
      ? isStock(item.ticker)
        ? "ações alugadas (aluguel)"
        : "cotas emprestadas (aluguel)"
      : proRata
        ? "recibo de subscrição pró-rata"
        : null;
    (reason ? explained : unexplained).push({
      ticker: item.ticker,
      month: item.month,
      official: item.shown,
      rebuilt,
      reason,
    });
  }
  const byKey = (a: DividendCheckItem, b: DividendCheckItem) =>
    a.ticker.localeCompare(b.ticker) || a.month.localeCompare(b.month);
  return {
    months: official.length,
    matched,
    explained: explained.sort(byKey),
    unexplained: unexplained.sort(byKey),
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/features/transactions/import/b3/dividends.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: O `plan.ts` passa a usar `codes.ts` e `dividends.ts`**

Em `src/features/transactions/import/b3/plan.ts`:

1. Troque o bloco de imports e constantes, do primeiro `import` até `const EXERCISE_WINDOW = 10 * DAY;`:

```ts
import { findOversells } from "../../domain/positions";
import type { DividendKind, LedgerEntry, PriceSource, TransactionSource } from "../../domain/types";
import type { ParsedPlanilha } from "../parse-planilha";
import { normalizeHeader } from "./cells";
import type {
  AssetTypeInfo,
  B3ImportAnswers,
  B3ImportPlan,
  DividendCheck,
  DividendCheckItem,
  EventosData,
  ExistingTransaction,
  ForecastMismatch,
  MovementRow,
  MovimentacaoData,
  NegociacaoData,
  PendingItem,
  PlannedDividend,
  PlannedDividends,
  PlannedForecast,
  PlannedTransaction,
  PlannedUpcoming,
  TickerPlan,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-importacao-b3-design.md (§4 a §7).

const DAY = 86_400_000;
const EPSILON = 1e-6;
const FII_CODE = /^[A-Z0-9]{4}11$/;
const RECEIPT_CODE = /^[A-Z0-9]{4}1[3-9]$/;
const RIGHTS_OR_RECEIPT_CODE = /^[A-Z0-9]{4}1[2-9]$/;
/** Códigos da família de um FII (cota, direito ou recibo): só eles podem ser levados ao FII. */
const FII_FAMILY_CODE = /^[A-Z0-9]{4}1[1-9]$/;
const TICKER_CODE = /^[A-Z0-9]{4}\d{1,2}$/;
const EXERCISE_WINDOW = 10 * DAY;
```

por:

```ts
import { findOversells } from "../../domain/positions";
import type { LedgerEntry, PriceSource, TransactionSource } from "../../domain/types";
import type { ParsedPlanilha } from "../parse-planilha";
import {
  DAY,
  EPSILON,
  FII_CODE,
  FII_FAMILY_CODE,
  RECEIPT_CODE,
  RIGHTS_OR_RECEIPT_CODE,
  TICKER_CODE,
  family,
  fiiOf,
  isoDay,
  qtyKey,
  sameQty,
} from "./codes";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
import type {
  AssetTypeInfo,
  B3ImportAnswers,
  B3ImportPlan,
  EventosData,
  ExistingTransaction,
  ForecastMismatch,
  MovementRow,
  MovimentacaoData,
  NegociacaoData,
  PendingItem,
  PlannedTransaction,
  TickerPlan,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-importacao-b3-design.md (§4 a §7) e, para as ações,
// 2026-10-30-acoes-etapa-1-design.md (§5).

const EXERCISE_WINDOW = 10 * DAY;
```

2. Troque:

```ts
const family = (code: string) => code.slice(0, 4);
const fiiOf = (code: string) => `${family(code)}11`;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const qtyKey = (quantity: number) => String(Math.round(quantity * 1e6) / 1e6);
const sameQty = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const subId = (ticker: string, date: Date, quantity: number) =>
```

por:

```ts
const subId = (ticker: string, date: Date, quantity: number) =>
```

3. Depois do bloco:

```ts
  const outOfCatalog = (code: string) => {
    const result = classificationOf(code);
    return result.managed && result.outOfCatalog;
  };
```

acrescente:

```ts
  // O ativo de uma linha de provento: o FII da família (…12 a …19 vão ao …11).
  const dividendTickerOf = (code: string): string | null => {
    if (!FII_FAMILY_CODE.test(code)) return null;
    const ticker = fiiOf(code);
    return managed(ticker) ? ticker : null;
  };
```

4. Troque:

```ts
  const upcoming = eventos ? extractUpcoming(eventos, input.asOf, managed, addIgnored) : null;
```

por:

```ts
  const upcoming = eventos
    ? extractUpcoming(eventos, input.asOf, dividendTickerOf, addIgnored)
    : null;
```

5. Troque:

```ts
    check: dividendCheck(movimentacao.rows, final.timeline, managed),
    dividends: extractDividends(
      movimentacao.rows,
      { start: movimentacao.firstDate, end: movimentacao.lastDate },
      acceptsDividends,
      [...tickers].filter(accepted),
    ),
```

por:

```ts
    check: dividendCheck({
      rows: movimentacao.rows,
      timeline: final.timeline,
      tickerOf: dividendTickerOf,
      isStock: () => false,
      legs: [],
    }),
    dividends: extractDividends(
      movimentacao.rows,
      { start: movimentacao.firstDate, end: movimentacao.lastDate },
      dividendTickerOf,
      acceptsDividends,
      [...tickers].filter(accepted),
    ),
```

6. Apague as cópias antigas, do marcador `// --- Proventos (spec proventos, §3.1)` até o fim do arquivo:

```bash
node -e "const fs=require('fs');const p='src/features/transactions/import/b3/plan.ts';const s=fs.readFileSync(p,'utf8');const i=s.indexOf('// --- Proventos (spec proventos');if(i<0)throw new Error('marcador não achado');fs.writeFileSync(p,s.slice(0,i).trimEnd()+'\n');"
```

- [ ] **Step 7: Conferir que só o aluguel dos FIIs mudou**

```bash
npm run typecheck && npm run lint
npm run -s import:b3 -- --negociacao "$NEG" --movimentacao "$MOV" --dry-run > "$SCRATCH/task4.txt"
diff "$SCRATCH/baseline.txt" "$SCRATCH/task4.txt"
```

Expected: o `diff` mostra só a linha que começa com `Proventos:`, que passa de `624 (R$ 172.602,80)` para `631 (R$ 172.749,66)`. Qualquer outra diferença é regressão e precisa ser corrigida antes do commit.

- [ ] **Step 8: Commitar**

```bash
npx prettier --write src/features/transactions/import/b3
git add src/features/transactions/import/b3
git commit -m "refactor(b3): move dividends, upcoming and the check to their own module"
```

---

### Task 5: Ações na atualização da B3

**Goal:** o plano passa a gerenciar ações e units, conforme a spec §5:
- classificação;
- desdobro e bonificação, com a pendência `bon:`;
- leilão de fração;
- grupamento, atualização diferente e subscrição de ação, que não são suportados;
- ações que voltam a mais do aluguel;
- proventos e conferência das ações.

**Files:**
- Create: `src/features/transactions/import/b3/classify.ts`
- Modify: `src/features/transactions/import/b3/plan.ts`
- Modify: `src/features/transactions/import/b3/types.ts`
- Modify: `scripts/import-b3.ts`

**Acceptance Criteria:**
- [ ] **Dry-run sem respostas:**
  - as 9 ações aparecem na lista;
  - ITSA4 e EGIE3 ficam PENDENTE;
  - as pendências `bon:` são exatamente `bon:EGIE3:2025-11-28`, `bon:ITSA4:2021-12-22` e `bon:ITSA4:2022-11-14`, todas abertas.
- [ ] **Dry-run com as 3 respostas em 0:**
  - abertas: BBAS3 200, BBSE3 100, EGIE3 139, PETR4 100 e VALE3 100;
  - zeradas: ITSA4, NEOE3, ODPV3 e WIZS3;
  - todas OK.
- [ ] As linhas dos FIIs no dry-run (`^[A-Z0-9]{4}11 `) são iguais às do `$SCRATCH/task4.txt`.
- [ ] Os "Ignorados" do dry-run não têm mais "Ações e units".
- [ ] `npm run typecheck`, `npm run lint` e `npm test` terminam sem erros.

**Verify:** os dois dry-runs do Step 7 e o `diff` das linhas de FII; depois `npm run typecheck && npm run lint && npm test`. Esperado: as quantidades acima, `diff` vazio e nada falhando.

**Steps:**

- [ ] **Step 1: `classify.ts`**

`src/features/transactions/import/b3/classify.ts`:

```ts
import { assetClassOf, type AssetClass } from "@/features/market-data";
import { RIGHTS_OR_RECEIPT_CODE, TICKER_CODE } from "./codes";
import type { AssetTypeInfo } from "./types";

// Classificação dos ativos dos extratos (spec importacao-b3, §4; spec ações etapa 1, §5.1).

export type Classification =
  | { managed: true; assetClass: AssetClass; outOfCatalog: boolean }
  | { managed: false; reason: string };

/** FIIs, Fiagros, ações e units entram; o resto vai para os ignorados da prévia, por motivo. */
export function classify(
  code: string,
  types: ReadonlyMap<string, AssetTypeInfo | null>,
): Classification {
  const info = types.get(code) ?? null;
  const assetClass = assetClassOf(code, info);
  if (assetClass) return { managed: true, assetClass, outOfCatalog: info === null };
  if (info) {
    const subType = info.subType?.toLowerCase() ?? null;
    if (info.type === "bdr") return { managed: false, reason: "BDRs" };
    if (subType === "etf") return { managed: false, reason: "ETFs" };
    if (subType === "fi-infra") return { managed: false, reason: "FI-Infra" };
    return { managed: false, reason: "Outros fundos (FIP, FIDC...)" };
  }
  if (RIGHTS_OR_RECEIPT_CODE.test(code)) {
    return { managed: false, reason: "Direitos e recibos (o recibo entra como subscrição do FII)" };
  }
  if (TICKER_CODE.test(code)) return { managed: false, reason: "Outros ativos fora do catálogo" };
  return { managed: false, reason: "Renda fixa e Tesouro" };
}
```

- [ ] **Step 2: Os tipos do plano**

Em `src/features/transactions/import/b3/types.ts`:

1. No topo, antes de `import type {`, acrescente:

```ts
import type { AssetClass } from "@/features/market-data";
```

2. Troque:

```ts
  /** Preço por pendência (`sub:…` e `prev:…`). */
```

por:

```ts
  /** Preço por pendência (`sub:…`, `prev:…` e o custo da bonificação, `bon:…`, que aceita 0). */
```

3. No `PendingItem`, depois da variante `POSICAO_ANTERIOR`, que termina em:

```ts
      type: "POSICAO_ANTERIOR";
      ticker: string;
      date: Date;
      quantity: number;
      price: number | null;
      priceSource: PriceSource | null;
    }
```

acrescente:

```ts
  | {
      id: string;
      /** Custo atribuído por ação de uma bonificação (spec ações etapa 1, §5.4). Aceita 0. */
      type: "CUSTO_BONIFICACAO";
      ticker: string;
      /** Dia do evento (a linha "Bonificação em Ativos"). */
      date: Date;
      /** Ações creditadas, mais as que voltaram a mais do aluguel. */
      quantity: number;
      price: number | null;
      priceSource: PriceSource | null;
    }
```

4. Troque:

```ts
export type TickerPlan = {
  ticker: string;
  /** FIIs ligados por incorporação entram ou ficam de fora juntos. */
```

por:

```ts
export type TickerPlan = {
  ticker: string;
  /** FII ou ação (spec ações etapa 1, §4). */
  assetClass: AssetClass;
  /** FIIs ligados por incorporação entram ou ficam de fora juntos. */
```

- [ ] **Step 3: Tirar a classificação antiga do `plan.ts`**

```bash
node -e "const fs=require('fs');const p='src/features/transactions/import/b3/plan.ts';const s=fs.readFileSync(p,'utf8');const a=s.indexOf('// --- Classificação (§4)');const b=s.indexOf('// --- Simulação');if(a<0||b<a)throw new Error('marcadores não achados');fs.writeFileSync(p,s.slice(0,a)+s.slice(b));"
```

- [ ] **Step 4: Imports, id da bonificação e simulação**

Em `src/features/transactions/import/b3/plan.ts`:

1. Troque:

```ts
import {
  DAY,
  EPSILON,
  FII_CODE,
  FII_FAMILY_CODE,
  RECEIPT_CODE,
  RIGHTS_OR_RECEIPT_CODE,
  TICKER_CODE,
  family,
  fiiOf,
  isoDay,
  qtyKey,
  sameQty,
} from "./codes";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
```

por:

```ts
import { classify, type Classification } from "./classify";
import {
  DAY,
  EPSILON,
  FII_CODE,
  FII_FAMILY_CODE,
  RECEIPT_CODE,
  STOCK_RECEIPT_CODE,
  family,
  fiiOf,
  isoDay,
  qtyKey,
  sameQty,
} from "./codes";
import { dividendCheck, extractDividends, extractUpcoming } from "./dividends";
import { lendingLegs } from "./lending";
```

2. Troque:

```ts
const prevId = (ticker: string) => `prev:${ticker}`;
```

por:

```ts
const prevId = (ticker: string) => `prev:${ticker}`;
/** Uma pendência por bonificação: a ação e o dia do evento (as ações a mais do aluguel usam a mesma). */
const bonusId = (ticker: string, date: Date) => `bon:${ticker}:${isoDay(date)}`;
```

3. Em `SimContext`, troque:

```ts
  outOfCatalog: (ticker: string) => boolean;
  conversionAnswer: (id: string, ticker: string, date: Date) => string | null;
```

por:

```ts
  outOfCatalog: (ticker: string) => boolean;
  /** Só FII tem conversão: a "Atualização" de uma ação só confere o saldo. */
  isFii: (ticker: string) => boolean;
  conversionAnswer: (id: string, ticker: string, date: Date) => string | null;
```

4. Em `simulate`, troque:

```ts
    // "Atualização" que credita cotas de um FII (§5.2).
    const { ticker, quantity, date } = event;
    const receipt = receipts.find(
```

por:

```ts
    // "Atualização" que credita cotas de um FII (§5.2).
    const { ticker, quantity, date } = event;
    if (!context.isFii(ticker)) {
      // Ação: igual à posição, só atualiza o saldo; diferente não é suportada (spec ações, §5.3).
      if (!sameQty(state(ticker).quantity, quantity)) {
        problem(
          ticker,
          `Atualização de ${qtyKey(quantity)} ações em ${isoDay(date)} com posição ${qtyKey(state(ticker).quantity)} não é suportada.`,
        );
      }
      continue;
    }
    const receipt = receipts.find(
```

5. Troque:

```ts
        if (other === ticker || current.quantity <= EPSILON) return false;
```

por:

```ts
        if (other === ticker || current.quantity <= EPSILON || !context.isFii(other)) return false;
```

- [ ] **Step 5: Classes, respostas e registros no `planB3Import`**

1. Troque o `dividendTickerOf` do Task 4:

```ts
  // O ativo de uma linha de provento: o FII da família (…12 a …19 vão ao …11).
  const dividendTickerOf = (code: string): string | null => {
    if (!FII_FAMILY_CODE.test(code)) return null;
    const ticker = fiiOf(code);
    return managed(ticker) ? ticker : null;
  };
```

por:

```ts
  const classOf = (code: string) => {
    const result = classificationOf(code);
    return result.managed ? result.assetClass : null;
  };
  const isStock = (code: string) => classOf(code) === "ACAO";
  /** O ativo cuja posição a linha mexe: a cota `…11` do FII ou a própria ação. */
  const holdingOf = (code: string): string | null =>
    isStock(code) || (FII_CODE.test(code) && managed(code)) ? code : null;
  // O ativo de uma linha de provento: a própria ação ou o FII da família (…12 a …19 vão ao …11).
  const dividendTickerOf = (code: string): string | null => {
    if (isStock(code)) return code;
    if (!FII_FAMILY_CODE.test(code)) return null;
    const ticker = fiiOf(code);
    return managed(ticker) ? ticker : null;
  };
```

2. Depois do bloco `answeredPrice`:

```ts
  const answeredPrice = (id: string): { price: number; source: PriceSource } | null => {
    const price = answers.prices?.[id];
    if (price === undefined || !(price > 0)) return null;
    return { price, source: answers.estimated?.includes(id) ? "ESTIMADO" : "USUARIO" };
  };
```

acrescente:

```ts
  // O custo atribuído da bonificação pode ser 0: a empresa nem sempre atribui custo (spec ações, §5.4).
  const answeredBonus = (id: string): { price: number; source: PriceSource } | null => {
    const price = answers.prices?.[id];
    if (price === undefined || !(price >= 0)) return null;
    return { price, source: answers.estimated?.includes(id) ? "ESTIMADO" : "USUARIO" };
  };
```

3. Troque:

```ts
  const previousConversion = new Map<string, string>();
```

por:

```ts
  const previousConversion = new Map<string, string>();
  const previousBonus = new Map<string, { price: number; source: PriceSource }>();
```

4. Troque:

```ts
    if (entry.kind === "INCORPORACAO" && entry.type === "BUY" && entry.relatedTicker) {
      previousConversion.set(`${entry.ticker}:${isoDay(entry.date)}`, entry.relatedTicker);
    }
  }
```

por:

```ts
    if (entry.kind === "INCORPORACAO" && entry.type === "BUY" && entry.relatedTicker) {
      previousConversion.set(`${entry.ticker}:${isoDay(entry.date)}`, entry.relatedTicker);
    }
    // O lançamento da linha de bonificação tem a data do evento; o das ações que voltaram do
    // aluguel tem a da volta e só repete o mesmo custo.
    if (
      entry.kind === "BONIFICACAO" &&
      (entry.priceSource === "USUARIO" || entry.priceSource === "ESTIMADO")
    ) {
      previousBonus.set(bonusId(entry.ticker, entry.date), {
        price: entry.unitPrice,
        source: entry.priceSource,
      });
    }
  }
```

5. Troque:

```ts
  const b3Tickers = new Set<string>();
```

por:

```ts
  const b3Tickers = new Set<string>();
  // Bonificações e desdobros (spec ações, §5.3 e §5.5): as ações a mais do aluguel seguem o evento.
  const corporateEvents: { ticker: string; date: Date; kind: "BONIFICACAO" | "DESDOBRO" }[] = [];
  const bonusPending = new Map<string, Extract<PendingItem, { type: "CUSTO_BONIFICACAO" }>>();
  const stockReceipts: MovementRow[] = [];
  /** A compra da bonificação: o custo por ação vem da pendência, que soma as quantidades. */
  const addBonus = (ticker: string, eventDate: Date, date: Date, quantity: number, note: string) => {
    const id = bonusId(ticker, eventDate);
    const answer = answeredBonus(id) ?? previousBonus.get(id) ?? null;
    const pending = bonusPending.get(id);
    if (pending) pending.quantity += quantity;
    else {
      bonusPending.set(id, {
        id,
        type: "CUSTO_BONIFICACAO",
        ticker,
        date: eventDate,
        quantity,
        price: answer?.price ?? null,
        priceSource: answer?.source ?? null,
      });
    }
    b3Tickers.add(ticker);
    touch(ticker, date);
    planned.push({
      ticker,
      type: "BUY",
      quantity,
      unitPrice: answer?.price ?? 0,
      fees: 0,
      date,
      kind: "BONIFICACAO",
      priceSource: answer?.source ?? null,
      relatedTicker: null,
      notes: note,
    });
  };
```

- [ ] **Step 6: As linhas de ação na Movimentação**

1. Troque:

```ts
      case "Recibo de Subscrição": {
        if (!row.credit || !RECEIPT_CODE.test(row.code) || quantity <= 0) break;
```

por:

```ts
      case "Recibo de Subscrição": {
        if (row.credit && STOCK_RECEIPT_CODE.test(row.code) && quantity > 0) {
          stockReceipts.push(row); // subscrição de ação: não suportada (spec ações, §5.3)
          break;
        }
        if (!row.credit || !RECEIPT_CODE.test(row.code) || quantity <= 0) break;
```

2. Troque:

```ts
      case "Atualização": {
        if (!row.credit || !FII_CODE.test(row.code) || !managed(row.code) || quantity <= 0) break;
        b3Tickers.add(row.code);
        updates.push({ ticker: row.code, quantity, date: row.date, row: row.row });
        break;
      }
      case "Desdobro": {
        if (!row.credit || !FII_CODE.test(row.code) || !managed(row.code) || quantity <= 0) break;
        b3Tickers.add(row.code);
        touch(row.code, row.date);
        planned.push({
          ticker: row.code,
          type: "BUY",
```

por:

```ts
      case "Atualização": {
        // A da ação só confere o saldo na simulação (spec ações, §5.3).
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        b3Tickers.add(ticker);
        updates.push({ ticker, quantity, date: row.date, row: row.row });
        break;
      }
      case "Bonificação em Ativos": {
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        corporateEvents.push({ ticker, date: row.date, kind: "BONIFICACAO" });
        addBonus(ticker, row.date, row.date, quantity, "Bonificação");
        break;
      }
      case "Desdobro": {
        const ticker = holdingOf(row.code);
        if (!row.credit || !ticker || quantity <= 0) break;
        b3Tickers.add(ticker);
        touch(ticker, row.date);
        corporateEvents.push({ ticker, date: row.date, kind: "DESDOBRO" });
        planned.push({
          ticker,
          type: "BUY",
```

3. Troque:

```ts
      case "Grupamento": {
        if (!FII_FAMILY_CODE.test(row.code)) break;
        const ticker = fiiOf(row.code);
        if (managed(ticker))
          unsupported.set(ticker, `Grupamento em ${isoDay(row.date)} não é suportado.`);
        break;
      }
      case "Leilão de Fração": {
        if (!FII_FAMILY_CODE.test(row.code)) break;
```

por:

```ts
      case "Grupamento": {
        const ticker = isStock(row.code)
          ? row.code
          : FII_FAMILY_CODE.test(row.code)
            ? fiiOf(row.code)
            : null;
        if (ticker && managed(ticker))
          unsupported.set(ticker, `Grupamento em ${isoDay(row.date)} não é suportado.`);
        break;
      }
      case "Leilão de Fração": {
        if (isStock(row.code)) {
          // Ação: a fração veio de bonificação ou desdobro e já está na posição (spec ações, §5.3).
          if (!row.credit || quantity <= 0) break;
          const price = row.unitPrice ?? (row.value !== null ? row.value / quantity : null);
          if (!price) break;
          b3Tickers.add(row.code);
          touch(row.code, row.date);
          planned.push({
            ticker: row.code,
            type: "SELL",
            quantity,
            unitPrice: price,
            fees: 0,
            date: row.date,
            kind: "FRACAO",
            priceSource: "B3",
            relatedTicker: null,
            notes: "Leilão de fração",
          });
          break;
        }
        if (!FII_FAMILY_CODE.test(row.code)) break;
```

- [ ] **Step 7: Subscrição de ação e ações a mais do aluguel, depois da Movimentação**

Troque:

```ts
  // Tudo o que aparece nos extratos e não é FII entra na lista de ignorados da prévia.
  for (const row of movimentacao.rows) classificationOf(row.code);
  for (const trade of negociacao.trades) classificationOf(trade.ticker);
  for (const row of eventos?.rows ?? []) classificationOf(row.code);
```

por:

```ts
  // Tudo o que aparece nos extratos e o app não acompanha entra na lista de ignorados da prévia.
  for (const row of movimentacao.rows) classificationOf(row.code);
  for (const trade of negociacao.trades) classificationOf(trade.ticker);
  for (const row of eventos?.rows ?? []) classificationOf(row.code);

  // Subscrição de ação (recibo …9 ou …10): não suportada; a ação da mesma família fica de fora.
  for (const receipt of stockReceipts) {
    for (const ticker of b3Tickers) {
      if (isStock(ticker) && family(ticker) === family(receipt.code)) {
        unsupported.set(
          ticker,
          `Subscrição (recibo ${receipt.code}) em ${isoDay(receipt.date)} não é suportada.`,
        );
      }
    }
  }

  // Aluguel (spec ações, §5.5): os extratos inteiros, para parear também o aluguel aberto antes do
  // período. Ações que voltaram a mais entram como o evento que houve durante o aluguel.
  const legs = lendingLegs(
    movimentacao.rows.filter((row) => holdingOf(row.code) !== null),
    negociacao.trades.filter((trade) => holdingOf(trade.ticker) !== null),
  );
  for (const leg of legs) {
    const back = leg.back;
    if (!back || leg.backQuantity === null || !inPeriod(back)) continue;
    const extra = leg.backQuantity - leg.outQuantity;
    if (extra <= EPSILON) continue;
    const event = corporateEvents.find(
      (item) => item.ticker === leg.ticker && item.date >= leg.out && item.date <= back,
    );
    if (!event) {
      warnings.push(
        `${leg.ticker}: voltaram ${qtyKey(extra)} a mais do aluguel em ${isoDay(back)}, sem bonificação ou desdobro durante o aluguel. A posição não muda.`,
      );
      continue;
    }
    if (event.kind === "BONIFICACAO") {
      addBonus(leg.ticker, event.date, back, extra, "Bonificação (ações que estavam alugadas)");
      continue;
    }
    b3Tickers.add(leg.ticker);
    touch(leg.ticker, back);
    planned.push({
      ticker: leg.ticker,
      type: "BUY",
      quantity: extra,
      unitPrice: 0,
      fees: 0,
      date: back,
      kind: "DESDOBRO",
      priceSource: "B3",
      relatedTicker: null,
      notes: "Desdobro (ações que estavam alugadas)",
    });
  }
```

- [ ] **Step 8: Contexto, pendências, classe no resumo e conferência**

1. Troque:

```ts
  const context: SimContext = {
    receipts: receiptRegistry,
    lastActivity,
    redemptions,
    fractions,
    outOfCatalog,
```

por:

```ts
  const context: SimContext = {
    receipts: receiptRegistry,
    lastActivity,
    redemptions,
    fractions,
    outOfCatalog,
    isFii: (ticker) => classOf(ticker) === "FII",
```

2. Troque:

```ts
  const pending = [
    ...subscriptionPending,
    ...final.acquisitions,
```

por:

```ts
  const pending = [
    ...subscriptionPending,
    ...bonusPending.values(),
    ...final.acquisitions,
```

3. Troque:

```ts
    return {
      ticker,
      group: groups.get(root(ticker)) ?? [ticker],
```

por:

```ts
    return {
      ticker,
      // Todo ativo do plano é acompanhado; o "FII" de reserva só satisfaz o tipo.
      assetClass: classOf(ticker) ?? "FII",
      group: groups.get(root(ticker)) ?? [ticker],
```

4. Troque:

```ts
      isStock: () => false,
      legs: [],
```

por:

```ts
      isStock,
      legs,
```

- [ ] **Step 9: Textos do relatório do script**

Em `scripts/import-b3.ts`:
- troque `Por tipo (todos os FIIs)` por `Por tipo (todos os ativos)`;
- na linha `Proventos: …`, troque os dois `FIIs` por `ativos`;
- troque `"\nFII       situação   cotas      preço médio  L/P realizado   lançamentos"` por `"\nAtivo     situação   qtd.       preço médio  L/P realizado   lançamentos"`;
- troque `Conferência pelos rendimentos` por `Conferência pelos proventos` nas duas mensagens.

- [ ] **Step 10: Conferir com os extratos**

```bash
npm run typecheck && npm run lint && npm test
npm run -s import:b3 -- --negociacao "$NEG" --movimentacao "$MOV" --dry-run > "$SCRATCH/task5-sem-respostas.txt"
grep -E "^(BBAS3|BBSE3|EGIE3|ITSA4|NEOE3|ODPV3|PETR4|VALE3|WIZS3) " "$SCRATCH/task5-sem-respostas.txt"
grep -E "bon:" "$SCRATCH/task5-sem-respostas.txt"
printf '{ "prices": { "bon:ITSA4:2021-12-22": 0, "bon:ITSA4:2022-11-14": 0, "bon:EGIE3:2025-11-28": 0 } }' > "$SCRATCH/respostas-bonificacao.json"
npm run -s import:b3 -- --negociacao "$NEG" --movimentacao "$MOV" --respostas "$SCRATCH/respostas-bonificacao.json" --dry-run > "$SCRATCH/task5.txt"
grep -E "^(BBAS3|BBSE3|EGIE3|ITSA4|NEOE3|ODPV3|PETR4|VALE3|WIZS3) " "$SCRATCH/task5.txt"
grep -E "^[A-Z0-9]{4}11 " "$SCRATCH/task4.txt" > "$SCRATCH/fii-antes.txt"
grep -E "^[A-Z0-9]{4}11 " "$SCRATCH/task5.txt" > "$SCRATCH/fii-depois.txt"
diff "$SCRATCH/fii-antes.txt" "$SCRATCH/fii-depois.txt" && echo "FIIs iguais"
grep -c "Ações e units" "$SCRATCH/task5.txt"
```

Expected:
- **Sem respostas:**
  - as 9 linhas de ação aparecem, com ITSA4 e EGIE3 `PENDENTE`;
  - há 3 linhas `ABERTA  bon:…`, que são `bon:EGIE3:2025-11-28`, `bon:ITSA4:2021-12-22` e `bon:ITSA4:2022-11-14`.
- **Com respostas:**
  - todas as 9 ações ficam `OK`;
  - as quantidades são BBAS3 200, BBSE3 100, EGIE3 139, PETR4 100 e VALE3 100, e as outras 4 ficam com 0.
- **FIIs:** sai `FIIs iguais`.
- **Ignorados:** o último `grep -c` dá `0`.

- [ ] **Step 11: Commitar**

```bash
npx prettier --write src/features/transactions/import/b3 scripts/import-b3.ts
git add src/features/transactions/import/b3 scripts/import-b3.ts
git commit -m "feat(b3): bring stocks into the B3 update"
```

---

### Task 6: Tela da atualização com ações

**Goal:** mostrar as ações na tela da atualização:
- a prévia pergunta o custo da bonificação, que aceita 0, e marca as ações;
- os textos dizem "ativo" onde querem dizer qualquer ativo, e "proventos" no lugar de "rendimentos".

**Files:**
- Modify: `src/features/transactions/components/b3-import/answers.ts`
- Modify: `src/features/transactions/components/b3-import/pending-list.tsx`
- Modify: `src/features/transactions/components/b3-import/preview-sections.tsx`
- Modify: `src/features/transactions/components/b3-import/b3-import-wizard.tsx`
- Modify: `src/features/transactions/server/b3-import.ts`

**Acceptance Criteria:**
- [ ] `toAnswers` manda o `bon:` digitado como 0. Os outros preços em 0 não vão.
- [ ] A pendência `CUSTO_BONIFICACAO` pergunta o custo atribuído por ação e usa "ações" ou "cotas" pela classe.
- [ ] A situação por ativo mostra a marca "ação" e "ações" na quantidade das ações.
- [ ] `grep -n "deixe o FII\|pelos rendimentos\|nos rendimentos\|só os FIIs\|Situação por FII" src/features/transactions` não acha nada.
- [ ] `npm run typecheck`, `npm run lint` e `npm run format:check` terminam sem erros.

**Verify:** `npm run typecheck && npm run lint && npm run format:check && grep -rn "deixe o FII\|pelos rendimentos\|nos rendimentos\|só os FIIs\|Situação por FII" src/features/transactions; test $? -eq 1` → sem erros, e o grep não acha nada.

**Steps:**

- [ ] **Step 1: A resposta 0 da bonificação**

Em `answers.ts`, troque:

```ts
  for (const [id, text] of Object.entries(draft.prices)) {
    const value = parseNumberInput(text);
    if (Number.isFinite(value) && value > 0) prices[id] = value;
  }
```

por:

```ts
  for (const [id, text] of Object.entries(draft.prices)) {
    const value = parseNumberInput(text);
    // O custo da bonificação pode ser 0 (a empresa não atribuiu custo); os outros preços, não.
    const allowsZero = id.startsWith("bon:");
    if (Number.isFinite(value) && (value > 0 || (allowsZero && value === 0))) prices[id] = value;
  }
```

- [ ] **Step 2: A pergunta da bonificação**

Em `pending-list.tsx`:

1. Troque:

```tsx
function Question({ item, priorDate }: { item: Pending; priorDate: Date }) {
  const ticker = <strong className="font-semibold">{item.ticker}</strong>;
  const quantity = formatQuantity(item.quantity);
```

por:

```tsx
function Question({
  item,
  priorDate,
  units,
}: {
  item: Pending;
  priorDate: Date;
  /** "cotas" ou "ações", pela classe do ativo. */
  units: string;
}) {
  const ticker = <strong className="font-semibold">{item.ticker}</strong>;
  const quantity = formatQuantity(item.quantity);
  if (item.type === "CUSTO_BONIFICACAO") {
    return (
      <>
        Bonificação de {ticker}: {quantity} {units} em {formatTradeDate(item.date)}.{" "}
        <span className="text-muted-foreground">
          Qual o custo atribuído por ação? Ele consta no fato relevante da empresa; use 0 se ela não
          atribuiu custo.
        </span>
      </>
    );
  }
```

2. Troque `{ticker} já tinha {quantity} cotas antes do extrato` por `{ticker} já tinha {quantity} {units} antes do extrato`.

3. Troque:

```tsx
  const excluded = new Set(draft.exclude);
```

por:

```tsx
  const excluded = new Set(draft.exclude);
  const classes = new Map(preview.tickers.map((row) => [row.ticker, row.assetClass]));
  const unitsOf = (ticker: string) => (classes.get(ticker) === "ACAO" ? "ações" : "cotas");
```

4. Troque:

```tsx
              <Question item={item} priorDate={preview.priorDate} />
```

por:

```tsx
              <Question item={item} priorDate={preview.priorDate} units={unitsOf(item.ticker)} />
```

5. Troque:

```tsx
                    aria-label={`Preço de ${item.ticker}`}
```

por:

```tsx
                    aria-label={
                      item.type === "CUSTO_BONIFICACAO"
                        ? `Custo por ação da bonificação de ${item.ticker}`
                        : `Preço de ${item.ticker}`
                    }
```

- [ ] **Step 3: Os textos e a marca de ação na prévia**

Em `preview-sections.tsx`:

1. Depois de `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";`, acrescente:

```tsx
import { Badge } from "@/shared/ui/badge";
```

2. Trocas de texto, uma ocorrência cada:

| Texto atual | Novo texto |
| --- | --- |
| `Responda abaixo (ou deixe o FII de fora) para liberar a importação.` | `Responda abaixo (ou deixe o ativo de fora) para liberar a importação.` |
| `` `${plural(divergences, "divergência", "divergências")} nos rendimentos` `` | `` `${plural(divergences, "divergência", "divergências")} nos proventos` `` |
| `"Revise as divergências e confirme na conferência pelos rendimentos para importar."` | `"Revise as divergências e confirme na conferência pelos proventos para importar."` |
| `A B3 não lista nenhum rendimento de FII a receber.` | `A B3 não lista nenhum provento a receber.` |
| `"a B3 lista um provento a receber, mas a carteira não tem cotas dele."` | `"a B3 lista um provento a receber, mas a carteira não tem posição nele."` |
| `` `a B3 lista ${formatQuantity(item.quantity ?? 0)} cotas a receber, e a carteira tem ${formatQuantity(item.held)}.` `` | `` `a B3 lista provento sobre ${formatQuantity(item.quantity ?? 0)}, e a carteira tem ${formatQuantity(item.held)}.` `` |
| `<CardTitle>Situação por FII</CardTitle>` | `<CardTitle>Situação por ativo</CardTitle>` |
| `<CardDescription>Como cada FII fica depois da atualização.</CardDescription>` | `<CardDescription>Como cada ativo fica depois da atualização.</CardDescription>` |
| `Todos os {formatQuantity(settled.length)} FIIs ficam ok.` | `Todos os {formatQuantity(settled.length)} ativos ficam ok.` |
| `` `Ver os ${formatQuantity(settled.length)} FIIs ok` `` | `` `Ver os ${formatQuantity(settled.length)} ativos ok` `` |
| `` `Ver os ${formatQuantity(settled.length)} FIIs` `` | `` `Ver os ${formatQuantity(settled.length)} ativos` `` |
| `<TableHead className="text-right">Cotas</TableHead>` | `<TableHead className="text-right">Qtd.</TableHead>` |
| `O app acompanha só os FIIs: o resto dos extratos fica de fora, agrupado por motivo.` | `O app acompanha FIIs e ações: o resto dos extratos fica de fora, agrupado por motivo.` |
| `Conferência pelos rendimentos` | `Conferência pelos proventos` |

3. Trocas com `replace_all`:

| Texto atual | Novo texto | Ocorrências |
| --- | --- | --- |
| `<TableHead>FII</TableHead>` | `<TableHead>Ativo</TableHead>` | 2 |
| `<TableHead className="pl-(--card-spacing)">FII</TableHead>` | `<TableHead className="pl-(--card-spacing)">Ativo</TableHead>` | 2 |
| `<TableHead className="hidden text-right @min-[600px]:table-cell">Cotas</TableHead>` | `<TableHead className="hidden text-right @min-[600px]:table-cell">Qtd.</TableHead>` | 3 |

4. No "a receber" da prévia, troque o texto do cabeçalho `Por cota` por `Unitário`.

5. Na `TickerList`, troque:

```tsx
                <span className="font-medium">{item.ticker}</span>
                {item.status !== "OK" ? (
```

por:

```tsx
                <span className="font-medium">{item.ticker}</span>
                {item.assetClass === "ACAO" ? <Badge variant="outline">ação</Badge> : null}
                {item.status !== "OK" ? (
```

E troque:

```tsx
                  ? `${formatQuantity(item.quantity)} cotas · PM ${formatBRL(item.averagePrice)}`
```

por:

```tsx
                  ? `${formatQuantity(item.quantity)} ${item.assetClass === "ACAO" ? "ações" : "cotas"} · PM ${formatBRL(item.averagePrice)}`
```

6. Na `TickerTable`, troque:

```tsx
                <TableCell className="pl-(--card-spacing) font-medium">{item.ticker}</TableCell>
```

por:

```tsx
                <TableCell className="pl-(--card-spacing) font-medium">
                  <span className="flex items-center gap-2">
                    {item.ticker}
                    {item.assetClass === "ACAO" ? <Badge variant="outline">ação</Badge> : null}
                  </span>
                </TableCell>
```

7. Na `DividendCheck`, troque:

```tsx
          {formatQuantity(check.matched)} de {formatQuantity(check.months)} meses batem com as cotas
          em que a B3 pagou rendimento · {formatQuantity(check.explained.length)} diferenças
          explicadas (aluguel, recibo pró-rata).
```

por:

```tsx
          {formatQuantity(check.matched)} de {formatQuantity(check.months)} meses batem com a
          quantidade sobre a qual a B3 pagou provento · {formatQuantity(check.explained.length)}{" "}
          diferenças explicadas (aluguel, recibo pró-rata).
```

E troque:

```tsx
                  {item.ticker} em {item.month}: a B3 pagou sobre {formatQuantity(item.official)}{" "}
                  cotas, e a importação chega a {formatQuantity(item.rebuilt)}.
```

por:

```tsx
                  {item.ticker} em {item.month}: a B3 pagou sobre {formatQuantity(item.official)},
                  e a importação chega a {formatQuantity(item.rebuilt)}.
```

- [ ] **Step 4: O aviso do assistente e o erro do servidor**

1. Em `b3-import-wizard.tsx`, troque `Responda as pendências (ou deixe o FII de fora) para liberar a importação.` por `Responda as pendências (ou deixe o ativo de fora) para liberar a importação.`
2. Em `src/features/transactions/server/b3-import.ts`, troque `A conferência pelos rendimentos tem divergências.` por `A conferência pelos proventos tem divergências.`

- [ ] **Step 5: Verificar e commitar**

```bash
npx prettier --write src/features/transactions/components/b3-import src/features/transactions/server/b3-import.ts
npm run typecheck && npm run lint && npm run format:check
grep -rn "deixe o FII\|pelos rendimentos\|nos rendimentos\|só os FIIs\|Situação por FII" src/features/transactions; test $? -eq 1 && echo "textos ok"
git add src/features/transactions
git commit -m "feat(b3): ask for the bonus cost and mark stocks in the update preview"
```

---

### Task 7: Ações nas contas da carteira

**Goal:** o snapshot e as telas recebem a classe de cada ticker:
- a estratégia, a Carteira Alvo, a cascata e o alerta "fora da Carteira Alvo" ignoram ações;
- a posição de ação tem `assetClass` e categoria `ACAO`, e a composição mostra "Ações";
- em Proventos, o Yahoo e o "não divulgado" só recebem FIIs.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Modify: `src/features/portfolio/domain/allocation.ts`
- Modify: `src/features/portfolio/domain/snapshot.test.ts`
- Modify: `src/features/portfolio/server/snapshot.ts`
- Modify: `src/features/portfolio/server/dividends-view.ts`

**Acceptance Criteria:**
- [ ] Os 3 testes novos passam:
  - a ação fica fora da Carteira Alvo e do alerta;
  - a posição vem com `ACAO`, e a fatia se chama "Ações";
  - o ativo-alvo de ação não entra na cascata.
- [ ] Os testes antigos do snapshot passam sem mudar as expectativas.
- [ ] `getPortfolioSnapshot` e `getDividendsView` leem as classes por `getAssetClasses`.
- [ ] `npm run typecheck`, `npm run lint` e `npm test` terminam sem erros.

**Verify:** `npx vitest run src/features/portfolio && npm run typecheck && npm run lint` → todos os testes passam, sem erros.

**Steps:**

- [ ] **Step 1: Os testes novos**

Em `src/features/portfolio/domain/snapshot.test.ts`:

1. Troque `import type { PriceInfo, TargetConfig } from "./types";` por:

```ts
import type { AssetClass } from "@/features/market-data";
import type { PriceInfo, TargetConfig } from "./types";
```

2. Em `portfolio()`, troque:

```ts
      ["QQQQ11", quote],
    ]),
  };
}
```

por:

```ts
      ["QQQQ11", quote],
    ]),
    classes: new Map(),
  };
}
```

3. No fim do arquivo, acrescente:

```ts
describe("buildSnapshot: ações", () => {
  const withStock = (stockTarget: TargetConfig | null): SnapshotInput => {
    const input = portfolio(500, 0);
    return {
      ...input,
      transactions: [...input.transactions, buy("PETR4", 10)],
      targets: stockTarget ? [...input.targets, stockTarget] : input.targets,
      prices: new Map([...input.prices, ["PETR4", quote]]),
      classes: new Map<string, AssetClass | null>([["PETR4", "ACAO"]]),
    };
  };

  it("a ação fica fora da Carteira Alvo e do alerta de ativo sem configuração", () => {
    const snapshot = buildSnapshot(withStock(null));
    expect(snapshot.strategy.rows.map((row) => row.ticker)).not.toContain("PETR4");
    expect(snapshot.alerts.map((alert) => alert.id)).not.toContain("sem-configuracao");
  });

  it("entra nas posições com a classe e na composição como 'Ações'", () => {
    const snapshot = buildSnapshot(withStock(null));
    expect(snapshot.positions.find((row) => row.ticker === "PETR4")).toMatchObject({
      assetClass: "ACAO",
      category: "ACAO",
      inStrategy: false,
      priority: null,
    });
    expect(snapshot.allocation.byCategory).toContainEqual(
      expect.objectContaining({ key: "ACAO", label: "Ações" }),
    );
  });

  it("nem um ativo-alvo de ação gravado antes entra na cascata", () => {
    const snapshot = buildSnapshot(withStock(target("PETR4", true, 5, 3)));
    expect(snapshot.cascadeInput.map((asset) => asset.ticker)).toEqual(["AAAA11", "BBBB11"]);
    expect(snapshot.positions.find((row) => row.ticker === "PETR4")?.inStrategy).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/portfolio/domain/snapshot.test.ts`
Expected: FAIL nos testes de ações, porque a PETR4 aparece na Carteira Alvo e na cascata, e falta `assetClass`.

- [ ] **Step 3: Os DTOs**

Em `src/features/portfolio/domain/types.ts`:

1. Acrescente no topo:

```ts
import type { AssetClass } from "@/features/market-data";
```

2. Troque:

```ts
export type PositionRow = {
  ticker: string;
  name: string | null;
```

por:

```ts
export type PositionRow = {
  ticker: string;
  /** FII ou ação (spec ações etapa 1, §4); null para o que o app não classifica. */
  assetClass: AssetClass | null;
  name: string | null;
```

3. Troque:

```ts
export type ClosedPositionRow = {
  ticker: string;
  realizedPnL: number;
```

por:

```ts
export type ClosedPositionRow = {
  ticker: string;
  assetClass: AssetClass | null;
  realizedPnL: number;
```

- [ ] **Step 4: O snapshot**

Em `src/features/portfolio/domain/snapshot.ts`:

1. Troque `import { isQuoteStale } from "@/features/market-data";` por `import { assetClassOf, isQuoteStale, type AssetClass } from "@/features/market-data";`.

2. Troque:

```ts
  prices: ReadonlyMap<string, PriceInfo>;
};
```

por:

```ts
  prices: ReadonlyMap<string, PriceInfo>;
  /** Classe de cada ticker pelo catálogo; o que faltar sai pelo código (spec ações, §4). */
  classes: ReadonlyMap<string, AssetClass | null>;
};
```

3. Troque:

```ts
  prices,
}: SnapshotInput): PortfolioSnapshot {
  const { positions } = replayLedger(transactions);
```

por:

```ts
  prices,
  classes,
}: SnapshotInput): PortfolioSnapshot {
  const { positions } = replayLedger(transactions);
  const classOf = (ticker: string): AssetClass | null =>
    classes.has(ticker) ? (classes.get(ticker) ?? null) : assetClassOf(ticker, null);
  // A Carteira Alvo e as Recomendações são só de FIIs: ação nunca entra na estratégia.
  const isStock = (ticker: string) => classOf(ticker) === "ACAO";
```

4. Troque:

```ts
  const members = targets.filter((target) => target.inStrategy);
```

por:

```ts
  const members = targets.filter((target) => target.inStrategy && !isStock(target.ticker));
```

5. Troque:

```ts
      const inStrategy = target?.inStrategy ?? false;
      const pnl = value - position.totalCost;
```

por:

```ts
      const stock = isStock(position.ticker);
      const inStrategy = !stock && (target?.inStrategy ?? false);
      const pnl = value - position.totalCost;
```

6. Troque:

```ts
        ticker: position.ticker,
        name: info?.name ?? null,
        logoUrl: info?.logoUrl ?? null,
        category: target?.category ?? null,
```

por:

```ts
        ticker: position.ticker,
        assetClass: classOf(position.ticker),
        name: info?.name ?? null,
        logoUrl: info?.logoUrl ?? null,
        // A ação não tem configuração na Carteira Alvo: a categoria vem da classe.
        category: stock ? "ACAO" : (target?.category ?? null),
```

7. Troque:

```ts
  // Carteira Alvo: tudo o que está em carteira ou configurado.
  const strategyTickers = [
    ...new Set([...open.map((p) => p.ticker), ...targets.map((t) => t.ticker)]),
  ];
```

por:

```ts
  // Carteira Alvo: tudo o que está em carteira ou configurado, menos as ações. As cotações
  // vencidas contam todos os ativos.
  const quoteTickers = [
    ...new Set([...open.map((p) => p.ticker), ...targets.map((t) => t.ticker)]),
  ];
  const strategyTickers = quoteTickers.filter((ticker) => !isStock(ticker));
```

8. Troque:

```ts
  const nowMonth = currentMonthKey(now);
  const quoteTickers = strategyTickers;
```

por:

```ts
  const nowMonth = currentMonthKey(now);
```

9. Troque:

```ts
      return {
        ticker: position.ticker,
        realizedPnL: position.realizedPnL,
```

por:

```ts
      return {
        ticker: position.ticker,
        assetClass: classOf(position.ticker),
        realizedPnL: position.realizedPnL,
```

10. Troque:

```ts
      .map(([ticker, amount]) => ({
        ticker,
        realizedPnL: 0,
```

por:

```ts
      .map(([ticker, amount]) => ({
        ticker,
        assetClass: classOf(ticker),
        realizedPnL: 0,
```

- [ ] **Step 5: A fatia "Ações"**

Em `src/features/portfolio/domain/allocation.ts`, troque:

```ts
      label: key === UNCATEGORIZED_KEY ? "Sem categoria" : CATEGORY_LABELS[key as Category],
```

por:

```ts
      // Na composição, a ação aparece no plural, como as outras fatias, que são grupos.
      label:
        key === UNCATEGORIZED_KEY
          ? "Sem categoria"
          : key === "ACAO"
            ? "Ações"
            : CATEGORY_LABELS[key as Category],
```

- [ ] **Step 6: Os carregadores**

1. Em `src/features/portfolio/server/snapshot.ts`, acrescente `getAssetClasses,` ao import de `@/features/market-data/server` e troque:

```ts
      const assets = await getAssetSnapshots(tickers);
      return buildSnapshot({
        now: new Date(),
        transactions,
        targets,
        dividends,
        prices: toPriceInfo(assets),
      });
```

por:

```ts
      const [assets, classes] = await Promise.all([
        getAssetSnapshots(tickers),
        getAssetClasses(tickers),
      ]);
      return buildSnapshot({
        now: new Date(),
        transactions,
        targets,
        dividends,
        prices: toPriceInfo(assets),
        classes,
      });
```

2. Em `src/features/portfolio/server/dividends-view.ts`, troque o import `import { getAssetSnapshots } from "@/features/market-data/server";` por `import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";`. Troque também:

```ts
    const assets = await getAssetSnapshots(tickers);
```

por:

```ts
    const [assets, classes] = await Promise.all([
      getAssetSnapshots(tickers),
      getAssetClasses(tickers),
    ]);
    // A estimativa do Yahoo e o "não divulgado" são só de FIIs: na ação, o pagamento vem meses
    // depois da data ex e o JCP do Yahoo é bruto (spec ações, §6.4).
    const isFiiLike = (ticker: string) => classes.get(ticker) !== "ACAO";
```

E troque:

```ts
    const announcements = new Map(
      [...assets].map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
    );
    const upcoming = upcomingDividends({ now, transactions, received, announcements, forecast });
    const undisclosed = undisclosedDividends({
      now,
      transactions,
      received,
      announcements,
      upcoming,
    });
```

por:

```ts
    const announcements = new Map(
      [...assets]
        .filter(([ticker]) => isFiiLike(ticker))
        .map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
    );
    const upcoming = upcomingDividends({ now, transactions, received, announcements, forecast });
    const undisclosed = undisclosedDividends({
      now,
      transactions,
      received: received.filter((item) => isFiiLike(item.ticker)),
      announcements,
      upcoming,
    });
```

- [ ] **Step 7: Rodar, verificar e commitar**

```bash
npx vitest run src/features/portfolio && npm run typecheck && npm run lint
npx prettier --write src/features/portfolio
git add src/features/portfolio
git commit -m "feat(portfolio): keep stocks out of the strategy and show them as a slice"
```

Expected: os 3 testes novos e os antigos passam, e o typecheck e o lint terminam sem erros.

---

### Task 8: IR das ações nas encerradas

**Goal:** o IR estimado segue a classe (spec §8):
- FII: 20% do lucro da posição;
- ação: 15% do lucro de cada mês em que as vendas de ações passaram de R$ 20 mil;
- o mês com até R$ 20.000,00 vendidos, inclusive, é isento.

A tela mostra "Isento" e as duas regras.

**Files:**
- Modify: `src/features/portfolio/domain/closed-positions.ts`
- Create: `src/features/portfolio/domain/closed-positions.test.ts`
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Modify: `src/features/portfolio/server/closed-positions-view.ts`
- Modify: `src/features/portfolio/components/closed/tax-table.tsx`
- Modify: `src/features/portfolio/components/closed/closed-parts.tsx`
- Modify: `src/features/portfolio/components/closed/closed-cards.tsx`

**Acceptance Criteria:**
- [ ] **FII:** continua 20% (100 × 10 → 100 × 12 dá IR 40).
- [ ] **Ação, o limite do mês:**
  - R$ 20.000,00 vendidos no mês é isento;
  - R$ 20.000,01, somando as ações do mês, paga 15%;
  - a venda de uma posição aberta e o leilão de fração contam para o limite.
- [ ] **Ação, sem compensação:** o prejuízo de um mês não abate o lucro de outro.
- [ ] **`taxExempt`:** é true só com lucro em meses isentos.
- [ ] **Fora do mapa de classes:** `NEOE3` sai como ação.
- [ ] **Tela:** a coluna do IR mostra "Isento", e os cards dizem "IR estimado" e "Lucro das vendas".
- [ ] `npm run typecheck`, `npm run lint` e `npm test` terminam sem erros.

**Verify:** `npx vitest run src/features/portfolio/domain/closed-positions.test.ts && npm run typecheck && npm run lint && npm test` → 8 testes novos passam, e nada falha.

**Steps:**

- [ ] **Step 1: Escrever o teste**

`src/features/portfolio/domain/closed-positions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AssetClass } from "@/features/market-data";
import { closedPositions, type ClosedLedgerEntry } from "./closed-positions";

let seq = 0;
function entry(
  ticker: string,
  type: "BUY" | "SELL",
  quantity: number,
  unitPrice: number,
  iso: string,
  kind: ClosedLedgerEntry["kind"] = "NEGOCIO",
): ClosedLedgerEntry {
  seq++;
  return {
    id: `e${seq}`,
    ticker,
    type,
    quantity,
    unitPrice,
    fees: 0,
    date: new Date(`${iso}T00:00:00Z`),
    createdAt: new Date(seq),
    kind,
  };
}

const classes = new Map<string, AssetClass | null>([
  ["AAAA11", "FII"],
  ["PETR4", "ACAO"],
  ["VALE3", "ACAO"],
]);
const rowOf = (entries: ClosedLedgerEntry[], ticker: string) =>
  closedPositions(entries, classes).find((row) => row.ticker === ticker);

describe("closedPositions: IR dos FIIs", () => {
  it("continua 20% do lucro, sem isenção", () => {
    const row = rowOf(
      [entry("AAAA11", "BUY", 100, 10, "2026-01-05"), entry("AAAA11", "SELL", 100, 12, "2026-02-10")],
      "AAAA11",
    );
    expect(row).toMatchObject({ assetClass: "FII", realizedPnL: 200, estimatedTax: 40, taxExempt: false });
  });
});

describe("closedPositions: IR das ações", () => {
  it("mês com R$ 20.000,00 vendidos é isento", () => {
    const row = rowOf(
      [entry("PETR4", "BUY", 1000, 15, "2026-01-05"), entry("PETR4", "SELL", 1000, 20, "2026-02-10")],
      "PETR4",
    );
    expect(row).toMatchObject({ assetClass: "ACAO", realizedPnL: 5000, estimatedTax: 0, taxExempt: true });
  });

  it("acima de R$ 20.000,00 no mês, somando as ações, paga 15% do lucro", () => {
    const rows = closedPositions(
      [
        entry("PETR4", "BUY", 1000, 15, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 19, "2026-02-10"),
        entry("VALE3", "BUY", 1, 900, "2026-01-05"),
        entry("VALE3", "SELL", 1, 1000.01, "2026-02-11"),
      ],
      classes,
    );
    expect(rows.find((row) => row.ticker === "PETR4")).toMatchObject({ estimatedTax: 600, taxExempt: false });
    expect(rows.find((row) => row.ticker === "VALE3")).toMatchObject({ estimatedTax: 15, taxExempt: false });
  });

  it("a venda de uma posição ainda aberta conta para o limite do mês", () => {
    const row = rowOf(
      [
        entry("VALE3", "BUY", 200, 50, "2026-01-05"),
        entry("VALE3", "SELL", 100, 60, "2026-03-10"),
        entry("PETR4", "BUY", 1000, 10, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 15, "2026-03-12"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 5000, estimatedTax: 750, taxExempt: false });
  });

  it("o prejuízo de um mês não compensa o lucro de outro", () => {
    const row = rowOf(
      [
        entry("PETR4", "BUY", 2000, 10, "2026-01-05"),
        entry("PETR4", "SELL", 1000, 25, "2026-02-10"),
        entry("PETR4", "SELL", 1000, 5, "2026-03-10"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 10000, estimatedTax: 2250, taxExempt: false });
  });

  it("o leilão de fração também conta para o limite", () => {
    const row = rowOf(
      [
        entry("PETR4", "BUY", 1, 10000, "2026-01-05"),
        entry("PETR4", "SELL", 1, 19999, "2026-04-10"),
        entry("VALE3", "BUY", 10.5, 4, "2026-01-05"),
        entry("VALE3", "SELL", 0.5, 4, "2026-04-15", "FRACAO"),
      ],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: 9999, estimatedTax: 1499.85, taxExempt: false });
  });

  it("só prejuízo: sem IR e sem a marca de isento", () => {
    const row = rowOf(
      [entry("PETR4", "BUY", 100, 20, "2026-01-05"), entry("PETR4", "SELL", 100, 15, "2026-02-10")],
      "PETR4",
    );
    expect(row).toMatchObject({ realizedPnL: -500, estimatedTax: 0, taxExempt: false });
  });

  it("fora do mapa de classes, a classe sai pelo código", () => {
    const [row] = closedPositions(
      [entry("NEOE3", "BUY", 100, 17.54, "2021-01-26"), entry("NEOE3", "SELL", 100, 18.25, "2021-05-26")],
      new Map(),
    );
    expect(row).toMatchObject({ ticker: "NEOE3", assetClass: "ACAO", estimatedTax: 0, taxExempt: true });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/portfolio/domain/closed-positions.test.ts`
Expected: FAIL. `closedPositions` não lê a classe, então as ações saem com IR de 20% e sem `assetClass` nem `taxExempt`.

- [ ] **Step 3: Os tipos**

Em `src/features/portfolio/domain/types.ts`, troque:

```ts
export type ClosedPosition = {
  ticker: string;
  /** Dia em que a posição zerou: a última venda ou, quando foi ela que zerou, a incorporação. */
```

por:

```ts
export type ClosedPosition = {
  ticker: string;
  /** FII ou ação: decide a regra do IR. */
  assetClass: AssetClass | null;
  /** Dia em que a posição zerou: a última venda ou, quando foi ela que zerou, a incorporação. */
```

E troque:

```ts
  /** 20% do lucro, sem isenção; zero no prejuízo. Por posição, sem compensar prejuízos. */
  estimatedTax: number;
```

por:

```ts
  /**
   * IR estimado, sem compensar prejuízos. FII: 20% do lucro da posição, sem isenção. Ação: 15% do
   * lucro de cada mês em que as vendas de ações passaram de R$ 20 mil. Zero no prejuízo.
   */
  estimatedTax: number;
  /** Ação com lucro só em meses isentos (vendas de ações até R$ 20 mil): a tela mostra "Isento". */
  taxExempt: boolean;
```

- [ ] **Step 4: A regra**

Substitua o conteúdo de `src/features/portfolio/domain/closed-positions.ts` por:

```ts
import { assetClassOf, type AssetClass } from "@/features/market-data";
import {
  replayLedger,
  type LedgerEntry,
  type PriceSource,
  type RealizedSale,
} from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import type { ClosedPosition, ClosedPositionsTotals } from "./types";

/** Alíquota do IR sobre o ganho de capital na venda de cotas de FII: 20%, sem isenção. */
export const FII_CAPITAL_GAINS_RATE = 0.2;

/** Alíquota do IR sobre o ganho na venda de ações no mercado à vista (operação comum): 15%. */
export const STOCK_CAPITAL_GAINS_RATE = 0.15;

/**
 * Até R$ 20 mil vendidos em ações no mês, inclusive, o ganho é isento (Lei 11.033/2004, art. 3º,
 * I). O limite é sobre o valor vendido, não sobre o lucro.
 */
export const STOCK_EXEMPTION_LIMIT = 20_000;

/** Abaixo de meio centavo o resultado é sobra de ponto flutuante: vale como zero. */
const HALF_CENT = 0.005;

/**
 * O que a conta precisa de cada lançamento: o do livro-razão, mais a origem do preço (para marcar
 * o preço estimado) e o FII do outro lado da incorporação.
 */
export type ClosedLedgerEntry = LedgerEntry & {
  priceSource?: PriceSource | null;
  relatedTicker?: string | null;
};

/**
 * IR estimado sobre o resultado das vendas de um FII: 20% do lucro, sem a isenção que as ações
 * têm. Prejuízo (ou zero) não paga. Arredondado ao centavo.
 */
export function estimateCapitalGainsTax(realizedPnL: number): number {
  if (realizedPnL < HALF_CENT) return 0;
  return Math.round(realizedPnL * FII_CAPITAL_GAINS_RATE * 100) / 100;
}

/**
 * Vendido em ações em cada mês (AAAA-MM): quantidade × preço de todas as vendas de ações, de
 * posições abertas ou encerradas, sem as taxas. A perna de saída da incorporação não conta.
 */
export function stockSalesByMonth(
  sales: readonly RealizedSale[],
  unitPriceOf: (entryId: string) => number,
  isStock: (ticker: string) => boolean,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    if (sale.kind === "INCORPORACAO" || !isStock(sale.ticker)) continue;
    const month = monthKeyOfTradeDate(sale.date);
    totals.set(month, (totals.get(month) ?? 0) + sale.quantity * unitPriceOf(sale.entryId));
  }
  return totals;
}

/**
 * IR estimado de uma ação: em cada mês com vendas dela, 15% do lucro do mês quando as vendas de
 * ações do mês passaram de R$ 20 mil; até o limite, o mês é isento. Prejuízo não paga e não
 * compensa outro mês. `exempt`: teve mês com lucro, e todos esses meses foram isentos.
 */
export function estimateStockTax(
  sold: readonly RealizedSale[],
  monthlySales: ReadonlyMap<string, number>,
): { tax: number; exempt: boolean } {
  const profitByMonth = new Map<string, number>();
  for (const sale of sold) {
    const month = monthKeyOfTradeDate(sale.date);
    profitByMonth.set(month, (profitByMonth.get(month) ?? 0) + sale.proceeds - sale.cost);
  }
  let tax = 0;
  let profitable = 0;
  let exempt = 0;
  for (const [month, profit] of profitByMonth) {
    if (profit < HALF_CENT) continue;
    profitable++;
    if ((monthlySales.get(month) ?? 0) <= STOCK_EXEMPTION_LIMIT) {
      exempt++;
      continue;
    }
    tax += Math.round(profit * STOCK_CAPITAL_GAINS_RATE * 100) / 100;
  }
  return { tax: Math.round(tax * 100) / 100, exempt: profitable > 0 && exempt === profitable };
}

/**
 * As posições zeradas hoje, da encerrada mais recente para a mais antiga. Cada uma soma as vendas
 * de verdade (negócios e leilões de fração) de todos os ciclos, pelo preço médio vigente em cada
 * venda (`replayLedger`). A perna de saída de uma incorporação não é venda: o custo segue para o
 * FII de destino, sem resultado nem IR. O IR é estimado por posição, sem compensar prejuízos, com
 * a regra da classe (spec ações etapa 1, §8). Sem classe no mapa, ela sai pelo código.
 */
export function closedPositions(
  transactions: readonly ClosedLedgerEntry[],
  classes: ReadonlyMap<string, AssetClass | null>,
): ClosedPosition[] {
  const { positions, sales } = replayLedger(transactions);
  const entryById = new Map(transactions.map((entry) => [entry.id, entry]));
  const estimated = estimatedTickers(transactions);
  const classOf = (ticker: string): AssetClass | null =>
    classes.has(ticker) ? (classes.get(ticker) ?? null) : assetClassOf(ticker, null);
  const monthlyStockSales = stockSalesByMonth(
    sales,
    (entryId) => entryById.get(entryId)?.unitPrice ?? 0,
    (ticker) => classOf(ticker) === "ACAO",
  );

  return positions
    .filter((position) => position.quantity === 0)
    .map((position) => {
      const exits = sales.filter((sale) => sale.ticker === position.ticker);
      const sold = exits.filter((sale) => sale.kind !== "INCORPORACAO");
      const costBasis = sold.reduce((sum, sale) => sum + sale.cost, 0);
      const proceeds = sold.reduce((sum, sale) => sum + sale.proceeds, 0);
      // Sem a sobra de ponto flutuante (o −0,00% de um resultado zerado).
      const realizedPnL = Math.abs(proceeds - costBasis) < HALF_CENT ? 0 : proceeds - costBasis;
      // A última saída é a que zerou a posição: compra depois dela deixaria cotas, e a compra do
      // mesmo dia vem antes da venda.
      const last = exits[exits.length - 1];
      const assetClass = classOf(position.ticker);
      const stockTax = assetClass === "ACAO" ? estimateStockTax(sold, monthlyStockSales) : null;
      return {
        ticker: position.ticker,
        assetClass,
        closedAt: last?.date ?? position.lastDate,
        sales: sold.length,
        costBasis,
        proceeds,
        realizedPnL,
        realizedPct: costBasis > 0 ? realizedPnL / costBasis : null,
        estimatedTax: stockTax ? stockTax.tax : estimateCapitalGainsTax(realizedPnL),
        taxExempt: stockTax?.exempt ?? false,
        incorporatedInto:
          last?.kind === "INCORPORACAO"
            ? (entryById.get(last.entryId)?.relatedTicker ?? null)
            : null,
        estimatedPrice: sold.length > 0 && estimated.has(position.ticker),
      };
    })
    .sort(
      (a, b) => b.closedAt.getTime() - a.closedAt.getTime() || a.ticker.localeCompare(b.ticker),
    );
}

/**
 * FIIs com algum preço de compra estimado (nem a B3 nem a planilha o tinham), direto ou herdado:
 * o destino de uma incorporação recebe o custo da origem, e com ele a estimativa. A marca é por
 * FII, não por ciclo, então pode sobrar num ciclo sem estimativa, mas nunca falta.
 */
function estimatedTickers(transactions: readonly ClosedLedgerEntry[]): Set<string> {
  const estimated = new Set(
    transactions
      .filter((entry) => entry.type === "BUY" && entry.priceSource === "ESTIMADO")
      .map((entry) => entry.ticker),
  );
  const incorporations = transactions.filter(
    (entry) => entry.type === "BUY" && entry.kind === "INCORPORACAO" && entry.relatedTicker,
  );
  // Repete até não mudar mais, para as cadeias (A → B → C).
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of incorporations) {
      if (estimated.has(entry.relatedTicker!) && !estimated.has(entry.ticker)) {
        estimated.add(entry.ticker);
        grew = true;
      }
    }
  }
  return estimated;
}

/** Somas das posições encerradas, para os cards da tela. */
export function summarizeClosedPositions(rows: readonly ClosedPosition[]): ClosedPositionsTotals {
  const sum = (items: readonly ClosedPosition[], pick: (row: ClosedPosition) => number) =>
    items.reduce((total, row) => total + pick(row), 0);
  const withProfit = rows.filter((row) => row.realizedPnL >= HALF_CENT);
  const withLoss = rows.filter((row) => row.realizedPnL <= -HALF_CENT);
  return {
    count: rows.length,
    costBasis: sum(rows, (row) => row.costBasis),
    proceeds: sum(rows, (row) => row.proceeds),
    realizedPnL: sum(rows, (row) => row.realizedPnL),
    estimatedTax: sum(rows, (row) => row.estimatedTax),
    profit: sum(withProfit, (row) => row.realizedPnL),
    loss: sum(withLoss, (row) => row.realizedPnL),
    withProfit: withProfit.length,
    withLoss: withLoss.length,
  };
}
```

- [ ] **Step 5: Quem chama passa as classes**

1. Em `src/features/portfolio/domain/snapshot.ts`, troque `...closedPositions(transactions).map((position) => {` por `...closedPositions(transactions, classes).map((position) => {`.

2. Em `src/features/portfolio/server/closed-positions-view.ts`, troque o import `import { getAssetSnapshots } from "@/features/market-data/server";` por `import { getAssetClasses, getAssetSnapshots } from "@/features/market-data/server";`. Troque também:

```ts
    const rows = closedPositions(await getMyTransactions());
```

por:

```ts
    const transactions = await getMyTransactions();
    const classes = await getAssetClasses(transactions.map((entry) => entry.ticker));
    const rows = closedPositions(transactions, classes);
```

No comentário da função, troque `o IR estimado de cada FII zerado` por `o IR estimado de cada ativo zerado`.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/features/portfolio`
Expected: PASS. São 8 testes novos do IR, e os do snapshot continuam passando.

- [ ] **Step 7: A tela do IR**

1. Em `closed/tax-table.tsx`, troque:

```tsx
                  {row.estimatedTax > 0 ? (
                    <Sensitive>{formatBRL(row.estimatedTax)}</Sensitive>
                  ) : (
                    "—"
                  )}
```

por:

```tsx
                  {row.estimatedTax > 0 ? (
                    <Sensitive>{formatBRL(row.estimatedTax)}</Sensitive>
                  ) : row.taxExempt ? (
                    <span className="text-muted-foreground">Isento</span>
                  ) : (
                    "—"
                  )}
```

2. Em `closed/closed-parts.tsx`, troque o import `import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";` por:

```tsx
import {
  FII_CAPITAL_GAINS_RATE,
  STOCK_CAPITAL_GAINS_RATE,
  STOCK_EXEMPTION_LIMIT,
} from "../../domain/closed-positions";
```

Troque:

```tsx
                  ) : (
                    "sem IR"
                  )}
```

por:

```tsx
                  ) : row.taxExempt ? (
                    "isento"
                  ) : (
                    "sem IR"
                  )}
```

E troque a nota do IR:

```tsx
          <Term>IR estimado:</Term> {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de cada FII,
          porque a venda de cotas de FII não tem isenção; prejuízo não paga. Na declaração, o IR é
          apurado mês a mês, somando as vendas de FII do mês e compensando os prejuízos anteriores.
          Esta estimativa não compensa.
```

por:

```tsx
          <Term>IR estimado:</Term> nos FIIs, {formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro
          de cada posição, porque a venda de cotas de FII não tem isenção. Nas ações,{" "}
          {formatPercent(STOCK_CAPITAL_GAINS_RATE, 0)} do lucro do mês em que as vendas de ações
          passaram de {formatBRL(STOCK_EXEMPTION_LIMIT)}; até esse valor, o mês é isento. Prejuízo
          não paga. Na declaração, o IR é apurado mês a mês, compensando os prejuízos anteriores.
          Esta estimativa não compensa.
```

3. Em `closed/closed-cards.tsx`:

| Ação | Texto atual | Novo texto |
| --- | --- | --- |
| Trocar | `import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";` | `import { formatBRL, formatQuantity } from "@/shared/lib/format";` |
| Apagar | `import { FII_CAPITAL_GAINS_RATE } from "../../domain/closed-positions";` | — |
| Trocar | ``const taxLabel = `IR estimado (${formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro)`;`` | `const taxLabel = "IR estimado";` |
| Trocar | `{formatPercent(FII_CAPITAL_GAINS_RATE, 0)} do lucro de cada FII` | `Sobre o lucro de cada posição` |
| Trocar com `replace_all` (2 ocorrências) | `Por posição, sem isenção e sem compensar os prejuízos.` | `Por posição, sem compensar os prejuízos. Nas ações, o mês com até R$ 20 mil vendidos é isento.` |
| Trocar | ``label={`Lucro tributável · ${positions(totals.withProfit)}`}`` | ``label={`Lucro das vendas · ${positions(totals.withProfit)}`}`` |
| Trocar | `label="Lucro tributável"` | `label="Lucro das vendas"` |
| Trocar | `<MetricNote>{positions(totals.withProfit)} com lucro: a base do IR.</MetricNote>` | `<MetricNote>{positions(totals.withProfit)} com lucro. Nas ações, o do mês isento não paga IR.</MetricNote>` |

- [ ] **Step 8: Verificar e commitar**

```bash
npx prettier --write src/features/portfolio
npm run typecheck && npm run lint && npm test
git add src/features/portfolio
git commit -m "feat(portfolio): estimate the stock tax with the monthly exemption"
```

---

### Task 9: Carteira Alvo só com FIIs

**Goal:** a busca da Carteira Alvo só sugere FIIs e Fiagros, e as actions que gravam um ativo-alvo recusam ação.

**Files:**
- Modify: `src/features/transactions/components/ticker-input.tsx`
- Modify: `src/features/strategy/components/table/add-asset-form.tsx`
- Modify: `src/features/strategy/actions.ts`

**Acceptance Criteria:**
- [ ] `TickerInput` tem a prop `fiiOnly`. Com ela, só sugere `subType` `fii` e `fi-agro`.
- [ ] Os dois `TickerInput` do `AddAssetForm` usam `fiiOnly`.
- [ ] `addTargetAssetAction` e `updateTargetAssetAction` lançam `ActionError` para ação.
- [ ] `npm run typecheck` e `npm run lint` terminam sem erros.

**Verify:** `npm run typecheck && npm run lint && grep -c "fiiOnly" src/features/strategy/components/table/add-asset-form.tsx` → sem erros, e o grep dá `2`.

**Steps:**

- [ ] **Step 1: A prop `fiiOnly`**

Em `ticker-input.tsx`, troque:

```tsx
export function TickerInput({
  value,
  onChange,
  id,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
}) {
```

por:

```tsx
export function TickerInput({
  value,
  onChange,
  id,
  invalid,
  fiiOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
  /** Só sugere FIIs e Fiagros: a Carteira Alvo não aceita ações. */
  fiiOnly?: boolean;
}) {
```

Troque:

```tsx
    staleTime: 5 * 60_000,
  });
```

por:

```tsx
    staleTime: 5 * 60_000,
  });
  const suggestions = fiiOnly
    ? data.filter((item) => item.subType === "fii" || item.subType === "fi-agro")
    : data;
```

E troque `{data.map((item) => (` por `{suggestions.map((item) => (`.

- [ ] **Step 2: A busca da Carteira Alvo**

Em `add-asset-form.tsx`, troque (com `replace_all`, 2 ocorrências) `<TickerInput value={ticker} onChange={setTicker} />` por `<TickerInput value={ticker} onChange={setTicker} fiiOnly />`.

- [ ] **Step 3: As actions recusam ação**

Em `src/features/strategy/actions.ts`:

1. Troque `import { getCatalogSubType } from "@/features/market-data/server";` por `import { getAssetClasses, getCatalogSubType } from "@/features/market-data/server";`.

2. Depois de `import { deleteTargetAsset, findTargetAsset, upsertTargetAsset } from "./server/target-asset-repo";`, acrescente:

```ts

/** A Carteira Alvo é só de FIIs: ação fica fora da estratégia e das recomendações. */
async function refuseStock(ticker: string) {
  if ((await getAssetClasses([ticker])).get(ticker) === "ACAO") {
    throw new ActionError("A Carteira Alvo é só de FIIs: ações ficam fora da estratégia.");
  }
}
```

3. Troque:

```ts
    const category = suggestCategory(await getCatalogSubType(parsedInput.ticker));
```

por:

```ts
    await refuseStock(parsedInput.ticker);
    const category = suggestCategory(await getCatalogSubType(parsedInput.ticker));
```

4. Troque:

```ts
    const { ticker, ...patch } = parsedInput;
```

por:

```ts
    const { ticker, ...patch } = parsedInput;
    await refuseStock(ticker);
```

- [ ] **Step 4: Verificar e commitar**

```bash
npx prettier --write src/features/transactions/components/ticker-input.tsx src/features/strategy
npm run typecheck && npm run lint
git add src/features/transactions/components/ticker-input.tsx src/features/strategy
git commit -m "feat(strategy): keep stocks out of the target portfolio"
```

---

### Task 10: Textos das listas que passam a mostrar ações

**Goal:** nas listas que passam a ter ações, o cabeçalho "FII" vira "Ativo" e "Cotas" vira "Qtd.". São as encerradas, os proventos e o reinvestimento.

**Files:**
- Modify: `src/features/portfolio/components/closed/closed-table.tsx`
- Modify: `src/features/portfolio/components/closed/tax-table.tsx`
- Modify: `src/features/portfolio/components/closed/closed-parts.tsx`
- Modify: `src/features/portfolio/components/closed/empty-closed.tsx`
- Modify: `src/features/portfolio/components/closed-positions.tsx`
- Modify: `src/features/portfolio/components/dividends/dividends-history.tsx`
- Modify: `src/features/portfolio/components/dividends/upcoming-list.tsx`
- Modify: `src/features/portfolio/components/reinvestment/purchases-table.tsx`

**Acceptance Criteria:**
- [ ] `grep -rn ">FII<\|\"FII\" : \"FIIs\"\|Por FII\|ver os FIIs" src/features/portfolio/components` não acha nada.
- [ ] `npm run typecheck`, `npm run lint` e `npm run format:check` terminam sem erros.

**Verify:** `grep -rn ">FII<\|\"FII\" : \"FIIs\"\|Por FII\|ver os FIIs" src/features/portfolio/components; test $? -eq 1 && npm run typecheck && npm run lint && npm run format:check` → o grep não acha nada, e nada falha.

**Steps:**

- [ ] **Step 1: Encerradas**

| Arquivo | Texto atual | Novo texto |
| --- | --- | --- |
| `closed/closed-table.tsx` | `<CardTitle>Por FII</CardTitle>` | `<CardTitle>Por ativo</CardTitle>` |
| `closed/closed-table.tsx` | `<TableHead className="pl-(--card-spacing)">FII</TableHead>` | `<TableHead className="pl-(--card-spacing)">Ativo</TableHead>` |
| `closed/tax-table.tsx` | `<CardTitle>Por FII</CardTitle>` | `<CardTitle>Por ativo</CardTitle>` |
| `closed/tax-table.tsx` | `<TableHead className="pl-(--card-spacing)">FII</TableHead>` | `<TableHead className="pl-(--card-spacing)">Ativo</TableHead>` |
| `closed-positions.tsx` | `<TableHead className="pl-0">FII</TableHead>` | `<TableHead className="pl-0">Ativo</TableHead>` |
| `closed/closed-parts.tsx` | `lote deste FII, e ele foi estimado.` | `lote deste ativo, e ele foi estimado.` |
| `closed/empty-closed.tsx` | `Quando você vender todas as cotas de um FII, ele aparece aqui com o resultado das vendas e` (a frase segue na linha de baixo) | `Quando você vender toda a posição de um ativo, ele aparece aqui com o resultado das vendas e` |

- [ ] **Step 2: Proventos e reinvestimento**

| Arquivo | Texto atual | Novo texto |
| --- | --- | --- |
| `dividends/dividends-history.tsx` | `Cor mais forte, mês maior. Clique num mês para ver os FIIs.` | `Cor mais forte, mês maior. Clique num mês para ver os ativos.` |
| `dividends/dividends-history.tsx` | `Cor mais forte, mês maior. Toque num mês para ver os FIIs.` | `Cor mais forte, mês maior. Toque num mês para ver os ativos.` |
| `dividends/dividends-history.tsx` (`replace_all`, 2) | `=== 1 ? "FII" : "FIIs"}` | `=== 1 ? "ativo" : "ativos"}` |
| `dividends/dividends-history.tsx` | `<TableHead className="pl-(--card-spacing)">FII</TableHead>` | `<TableHead className="pl-(--card-spacing)">Ativo</TableHead>` |
| `dividends/upcoming-list.tsx` | `<TableHead className="pl-(--card-spacing)">FII</TableHead>` | `<TableHead className="pl-(--card-spacing)">Ativo</TableHead>` |
| `dividends/upcoming-list.tsx` | `<TableHead className="hidden text-right @min-[640px]:table-cell">Cotas</TableHead>` | `<TableHead className="hidden text-right @min-[640px]:table-cell">Qtd.</TableHead>` |
| `dividends/upcoming-list.tsx` | o texto do cabeçalho `Por cota` | `Unitário` |
| `dividends/upcoming-list.tsx` | `) e dos anúncios do Yahoo depois dela.` | `) e, nos FIIs, dos anúncios do Yahoo depois dela.` |
| `reinvestment/purchases-table.tsx` | `<TableHead>FII</TableHead>` | `<TableHead>Ativo</TableHead>` |

- [ ] **Step 3: Verificar e commitar**

```bash
npx prettier --write src/features/portfolio/components
grep -rn ">FII<\|\"FII\" : \"FIIs\"\|Por FII\|ver os FIIs" src/features/portfolio/components; test $? -eq 1 && echo "textos ok"
npm run typecheck && npm run lint && npm run format:check
git add src/features/portfolio/components
git commit -m "feat(portfolio): call the rows assets now that stocks show up"
```

---

### Task 11: Conferência com os extratos reais (gate antes do merge)

**Goal:** antes do merge, rodar o plano com os extratos de 30/10/2026 contra os lançamentos e proventos atuais, só lendo o banco, e conferir os critérios de sucesso 1 a 9 da spec, mais o 10: os testes passam.

> **USER-ORDERED GATE — NON-SKIPPABLE.** This task was requested by the user in the current conversation. It MUST NOT be closed by walking around it, by declaring it "verified inline", or by substituting a cheaper check. Close only after every item in `acceptanceCriteria` has been re-validated independently, with output captured.

**Files:**
- Create (temporário, nunca commitado): `check-acoes.tmp.ts`, na raiz do repositório

**Acceptance Criteria:**
- [ ] **1. Posições:** BBAS3 200, BBSE3 100, EGIE3 139, PETR4 100 e VALE3 100; ITSA4, NEOE3, ODPV3 e WIZS3 com 0.
- [ ] **2. Pendências abertas:** exatamente `bon:EGIE3:2025-11-28`, `bon:ITSA4:2021-12-22` e `bon:ITSA4:2022-11-14`.
- [ ] **3. Proventos das ações:** JCP 2.865,70; Dividendo 1.243,22; Reembolso 5.511,47; Rendimento 11,16; Aluguel 308,18. Aluguel dos FIIs: 149,68.
- [ ] **4. FIIs:** nenhum lançamento novo ou trocado. Nos proventos, só entra aluguel, e nada sai.
- [ ] **5. Reenvio:** os mesmos arquivos de novo dão nada novo e nenhuma pendência aberta.
- [ ] **6. "A receber":** 4 itens de ações (PETR4 × 3 e EGIE3), que somam R$ 195,11, e a EGIE3 sem aviso.
- [ ] **7. Conferência:** nenhuma ação com divergência sem explicação. A única ação explicada é EGIE3 2026-05.
- [ ] **8. IR:** ITSA4, NEOE3, ODPV3 e WIZS3 sem IR, e o IR dos FIIs igual ao de hoje.
- [ ] **9. Cascata:** a entrada e as ordens para R$ 1.000 iguais às de hoje, e a Carteira Alvo sem ações.
- [ ] **10. Testes:** `npm test` passa.
- [ ] O script termina com `Todos os critérios passaram.` e é apagado. O `git status` não o mostra.

**Verify:** `KOINOS_EMAIL=<e-mail do dono> npx tsx --conditions=react-server --env-file=.env.local check-acoes.tmp.ts "$NEG" "$MOV" "$EV" && npm test` → `Todos os critérios passaram.` e os testes passando.

**Steps:**

- [ ] **Step 1: Escrever o script (raiz do repositório, temporário)**

`check-acoes.tmp.ts`:

```ts
// Conferência da etapa 1 das ações com os extratos reais (spec 2026-10-30-acoes-etapa-1, §1).
// Só lê o banco. Rodar da raiz do repositório e apagar em seguida (nunca commitar):
//   KOINOS_EMAIL=<e-mail> npx tsx --conditions=react-server --env-file=.env.local \
//     check-acoes.tmp.ts <negociacao> <movimentacao> <eventos>
import { isDeepStrictEqual } from "node:util";
import readXlsxFile from "read-excel-file/node";
import { findDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import { assetClassOf, type AssetClass } from "@/features/market-data";
import { readCatalogTypes } from "@/features/market-data/repo";
import { getAssetSnapshots } from "@/features/market-data/server/assets-read";
import { buildSnapshot, closedPositions } from "@/features/portfolio";
import type { PriceInfo } from "@/features/portfolio/domain/types";
import { sunoCascade } from "@/features/smart-buy";
import { listTargetAssets } from "@/features/strategy/repo";
import {
  planB3Import,
  readEventos,
  readMovimentacao,
  readNegociacao,
  replayLedger,
  type PendingItem,
  type SheetInput,
} from "@/features/transactions";
import { diffDividends, diffLedger, sameForecast } from "@/features/transactions/import/b3/changes";
import type { ExistingDividend, ExistingTransaction } from "@/features/transactions/import/b3/types";
import { listTransactions } from "@/features/transactions/repo";
import { listDividendRecords } from "@/features/transactions/server/dividend-repo";
import { mongoClient } from "@/shared/db/mongo";

const EPS = 1e-6;
let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  const suffix = detail === undefined ? "" : ` → ${JSON.stringify(detail)}`;
  console.log(`${ok ? "ok   " : "FALHA"} ${label}${suffix}`);
  if (!ok) failures++;
}
const isOpen = (item: PendingItem) =>
  item.type === "CONVERSAO" ? item.source === null : item.price === null;

async function main() {
  const [negPath, movPath, evPath] = process.argv.slice(2);
  const email = process.env.KOINOS_EMAIL;
  if (!negPath || !movPath || !evPath || !email) {
    throw new Error("Uso: KOINOS_EMAIL=<e-mail> tsx … check-acoes.tmp.ts <negociacao> <movimentacao> <eventos>");
  }
  const sheets = async (path: string) => (await readXlsxFile(path)) as unknown as SheetInput[];
  const negociacao = readNegociacao(await sheets(negPath));
  const movimentacao = readMovimentacao(await sheets(movPath));
  const eventos = readEventos(await sheets(evPath));

  const userId = await findUserIdByEmail(email);
  const portfolioId = userId ? await findDefaultPortfolioId(userId) : null;
  if (!portfolioId) throw new Error("Carteira não encontrada.");
  const [existing, storedDividends, assetTypes, targets] = await Promise.all([
    listTransactions(portfolioId),
    listDividendRecords(portfolioId),
    readCatalogTypes(),
    listTargetAssets(portfolioId),
  ]);
  const base = {
    negociacao,
    movimentacao,
    eventos,
    asOf: new Date(Date.UTC(2026, 9, 30)),
    planilha: null,
    existing,
    assetTypes,
  };

  // 2. Sem respostas, só as 3 bonificações ficam abertas.
  const open = planB3Import(base).pending.filter(isOpen);
  check(
    "2. pendências abertas = as 3 bonificações",
    isDeepStrictEqual(open.map((item) => item.id).sort(), [
      "bon:EGIE3:2025-11-28",
      "bon:ITSA4:2021-12-22",
      "bon:ITSA4:2022-11-14",
    ]),
    open.map((item) => item.id),
  );

  // O resto com as bonificações respondidas: 0 por ação (empresa sem custo atribuído).
  const plan = planB3Import({
    ...base,
    answers: { prices: Object.fromEntries(open.map((item) => [item.id, 0])) },
  });
  const entries = diffLedger(plan, existing);
  const dividends = diffDividends(plan.dividends, storedDividends);
  // A carteira depois de gravar, como o serviço grava: só a diferença.
  const removed = new Set(entries.removeIds);
  const applied: ExistingTransaction[] = [
    ...existing.filter((entry) => !removed.has(entry.id)),
    ...entries.insert.map((entry, index) => ({
      ...entry,
      id: `novo-${index}`,
      createdAt: new Date(Date.UTC(2026, 9, 30, 12, 0, index)),
      source: "B3" as const,
    })),
  ];
  const removedDividends = new Set(dividends.removeIds);
  const appliedDividends: ExistingDividend[] = [
    ...storedDividends.filter((item) => !removedDividends.has(item.id)),
    ...dividends.insert.map((item, index) => ({ ...item, id: `provento-${index}` })),
  ];
  const classes = new Map<string, AssetClass | null>();
  for (const ticker of new Set([
    ...applied.map((entry) => entry.ticker),
    ...appliedDividends.map((item) => item.ticker),
    ...targets.map((target) => target.ticker),
  ])) {
    classes.set(ticker, assetClassOf(ticker, assetTypes.get(ticker) ?? null));
  }
  const isStock = (ticker: string) => classes.get(ticker) === "ACAO";

  // 1. Posições.
  const positions = new Map(replayLedger(applied).positions.map((p) => [p.ticker, p.quantity]));
  for (const [ticker, quantity] of Object.entries({ BBAS3: 200, BBSE3: 100, EGIE3: 139, PETR4: 100, VALE3: 100 })) {
    check(`1. ${ticker} com ${quantity}`, Math.abs((positions.get(ticker) ?? -1) - quantity) < EPS, positions.get(ticker));
  }
  for (const ticker of ["ITSA4", "NEOE3", "ODPV3", "WIZS3"]) {
    check(`1. ${ticker} encerrada`, positions.get(ticker) === 0, positions.get(ticker));
  }

  // 3. Proventos das ações e aluguel.
  const total = (filter: (item: ExistingDividend) => boolean) =>
    Math.round(appliedDividends.filter(filter).reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  for (const [kind, amount] of Object.entries({ JCP: 2865.7, DIVIDENDO: 1243.22, REEMBOLSO: 5511.47, RENDIMENTO: 11.16, ALUGUEL: 308.18 })) {
    const got = total((item) => isStock(item.ticker) && item.kind === kind);
    check(`3. ações, ${kind} = ${amount}`, Math.abs(got - amount) < 0.005, got);
  }
  const fiiRent = total((item) => !isStock(item.ticker) && item.kind === "ALUGUEL");
  check("3. aluguel dos FIIs = 149,68", Math.abs(fiiRent - 149.68) < 0.005, fiiRent);

  // 4. FIIs: nenhum lançamento novo ou trocado; nos proventos, só o aluguel.
  const fiiInserts = entries.insert.filter((entry) => !isStock(entry.ticker));
  check("4. nenhum lançamento de FII novo ou trocado", fiiInserts.length === 0 && entries.removeIds.length === 0, { inserts: fiiInserts.length, removes: entries.removeIds.length });
  const fiiDividends = dividends.insert.filter((item) => !isStock(item.ticker));
  check("4. proventos de FII: só entra aluguel, nada sai", fiiDividends.every((item) => item.kind === "ALUGUEL") && dividends.removeIds.length === 0, { kinds: [...new Set(fiiDividends.map((item) => item.kind))], removes: dividends.removeIds.length });

  // 5. Reenviar os mesmos arquivos não muda nada (as respostas ficam nos lançamentos gravados).
  const again = planB3Import({ ...base, existing: applied });
  const againEntries = diffLedger(again, applied);
  const againDividends = diffDividends(again.dividends, appliedDividends);
  check("5. reenvio: nenhuma pendência aberta", again.pending.filter(isOpen).length === 0);
  check(
    "5. reenvio: nada novo",
    againEntries.insert.length + againEntries.removeIds.length + againDividends.insert.length + againDividends.removeIds.length === 0 &&
      sameForecast(plan.upcoming?.items ?? [], again.upcoming?.items ?? []),
  );

  // 6. "A receber".
  const items = plan.upcoming?.items ?? [];
  check("6. 4 itens de ações no a receber", isDeepStrictEqual(items.map((item) => item.ticker).sort(), ["EGIE3", "PETR4", "PETR4", "PETR4"]), items.map((item) => [item.ticker, item.kind]));
  check("6. a receber soma R$ 195,11", Math.abs(items.reduce((sum, item) => sum + item.amount, 0) - 195.11) < 0.005);
  check("6. EGIE3 sem aviso de quantidade", !plan.forecastMismatches.some((item) => item.ticker === "EGIE3"), plan.forecastMismatches);

  // 7. Conferência pelos proventos das ações.
  const stockUnexplained = plan.check.unexplained.filter((item) => isStock(item.ticker));
  const stockExplained = plan.check.explained.filter((item) => isStock(item.ticker));
  check("7. nenhuma ação com divergência sem explicação", stockUnexplained.length === 0, stockUnexplained);
  check("7. só EGIE3 2026-05 explicada pelo aluguel", isDeepStrictEqual(stockExplained.map((item) => `${item.ticker} ${item.month}`), ["EGIE3 2026-05"]), stockExplained);
  console.log(`      todos os ativos: ${plan.check.matched} de ${plan.check.months} meses batem · ${plan.check.explained.length} explicados · ${plan.check.unexplained.length} sem explicação`);

  // 8. IR.
  const taxBefore = closedPositions(existing, classes);
  const taxAfter = closedPositions(applied, classes);
  for (const ticker of ["ITSA4", "NEOE3", "ODPV3", "WIZS3"]) {
    const row = taxAfter.find((item) => item.ticker === ticker);
    check(
      `8. ${ticker} sem IR (isenta ou prejuízo)`,
      Boolean(row) && row!.estimatedTax === 0 && (row!.realizedPnL <= 0 || row!.taxExempt),
      row && { pnl: row.realizedPnL, tax: row.estimatedTax, exempt: row.taxExempt },
    );
  }
  const fiiTax = (rows: typeof taxAfter) => rows.filter((row) => !isStock(row.ticker)).map((row) => [row.ticker, row.estimatedTax]);
  check("8. IR dos FIIs igual ao de hoje", isDeepStrictEqual(fiiTax(taxBefore), fiiTax(taxAfter)));

  // 9. Carteira Alvo e Recomendações.
  const assets = await getAssetSnapshots([...classes.keys()]);
  const prices = new Map<string, PriceInfo>(
    [...assets].map(([ticker, asset]) => [
      ticker,
      {
        name: asset.name,
        logoUrl: asset.logoUrl,
        subType: asset.subType,
        price: asset.price,
        changePercent: asset.changePercent,
        quoteFetchedAt: asset.quoteFetchedAt,
        dy12m: asset.dy12m,
        lastDividend: asset.lastDividend,
        priceToBook: asset.priceToBook,
        dividends12m: asset.dividends12m,
        fii: asset.fii,
      },
    ]),
  );
  const now = new Date();
  const before = buildSnapshot({ now, transactions: existing, targets, dividends: storedDividends, prices, classes });
  const after = buildSnapshot({ now, transactions: applied, targets, dividends: appliedDividends, prices, classes });
  check("9. entrada da cascata igual", isDeepStrictEqual(before.cascadeInput, after.cascadeInput));
  check("9. mesmas ordens para R$ 1.000", isDeepStrictEqual(sunoCascade(1000, before.cascadeInput).orders, sunoCascade(1000, after.cascadeInput).orders));
  check("9. Carteira Alvo sem ações", after.strategy.rows.every((row) => !isStock(row.ticker)));

  console.log(failures === 0 ? "\nTodos os critérios passaram." : `\n${failures} critério(s) falharam.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoClient.close());
```

- [ ] **Step 2: Rodar**

```bash
KOINOS_EMAIL=<e-mail do dono> npx tsx --conditions=react-server --env-file=.env.local check-acoes.tmp.ts "$NEG" "$MOV" "$EV" | tee "$SCRATCH/gate.txt"
npm test
```

Expected:
- **Script:** cada linha começa com `ok`, e a última é `Todos os critérios passaram.` Uma `FALHA` reabre a tarefa que cuida daquele critério: corrija, commite e rode de novo.
- **Testes:** `npm test` passa.

- [ ] **Step 3: Apagar o script**

```bash
rm check-acoes.tmp.ts
git status --short
```

Expected: `git status --short` não lista `check-acoes.tmp.ts`.

---

### Task 12: Documentação e verificação completa

**Goal:** o `CLAUDE.md` e os specs antigos passam a descrever as ações, e a verificação completa passa no branch.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-18-importacao-b3-design.md`
- Modify: `docs/superpowers/specs/2026-10-23-posicoes-encerradas-design.md`
- Modify: `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md`

**Acceptance Criteria:**
- [ ] **`CLAUDE.md` descreve:**
  - a classe do ativo;
  - as regras de ações da atualização da B3;
  - os tipos de provento novos;
  - o IR das ações;
  - os testes novos;
  - a regra de produto das ações.
- [ ] Os dois specs antigos apontam para a spec das ações, e a spec das ações diz que foi implementada.
- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` passa.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo passa.

**Steps:**

- [ ] **Step 1: `CLAUDE.md`**

1. Troque:

```md
Koinos is a single-owner FII (Brazilian REIT) portfolio dashboard that replaced the owner's spreadsheet.
```

por:

```md
Koinos is a single-owner dashboard for a Brazilian portfolio of FIIs (REITs) and stocks that replaced the owner's spreadsheet. The Carteira Alvo and the aporte recommendations cover FIIs only.
```

2. Troque:

```md
**Tests:** unit tests cover only pure code around the aportes: the rules that pick them, their inputs and their explanation (the owner asked for them on 2026-10-24; before that there was no suite, by their decision).
```

por:

```md
**Tests:** unit tests cover only pure code: the aportes (the rules that pick them, their inputs and their explanation; the owner asked for them on 2026-10-24, and before that there was no suite, by their decision) and, since 2026-10-30, the stock rules (asset class, lending, dividend kinds and the stock tax).
```

3. Na lista "Covered", troque:

```md
  - usebolsai's parsing (`market-data/domain/fundamentals.test.ts`).
```

por:

```md
  - usebolsai's parsing (`market-data/domain/fundamentals.test.ts`);
  - the asset class (`market-data/domain/asset-class.test.ts`);
  - the B3 lending pairing and the shares that come back from lending (`transactions/import/b3/lending.test.ts`), and the dividend kinds and the check by dividends (`transactions/import/b3/dividends.test.ts`);
  - the estimated tax of closed positions: FIIs at 20%, stocks at 15% with the R$ 20,000 monthly exemption (`portfolio/domain/closed-positions.test.ts`).
```

4. Antes da linha `**Domain flow:**`, acrescente:

```md
**Asset class:** `assetClassOf` (`market-data/domain/asset-class.ts`, pure) says `FII` or `ACAO` from the brapi catalog: `stock` (stocks and units) is ACAO, and `fund` with `fii` or `fi-agro` is FII. Out of the catalog, `XXXX11` is a FII and 4 characters + 3 to 8 is a stock.

- Views get the classes from `getAssetClasses` (`market-data/server`, over the cached catalog) and pass a map into the pure code.
- Stocks never enter the strategy: the Carteira Alvo rows, the cascade input and the "fora da Carteira Alvo" alert skip them, and the target-asset actions refuse them (spec `2026-10-30-acoes-etapa-1-design.md`).

```

5. No item 1 do Domain flow, troque `a desdobro is a buy at price 0,` por `a desdobro is a buy at price 0, a bonificação is a buy at the cost the company assigns (answered in the preview, 0 allowed),`. Troque também `the Dashboard's monthly aportes skip the incorporation buy,` por `the Dashboard's monthly aportes skip the incorporation buy and the bonificação,`.

6. No item 4, depois de `   - the groupings by month (a year × month matrix: clicking a month lists its FIIs), year or FII.`, acrescente:

```md
   - stocks: their "a receber" comes only from the B3 snapshot. The Yahoo estimate and "não divulgado" are FII-only (`dividends-view.ts` filters their inputs).
```

7. No item 6, troque:

```md
   - the estimated tax is 20% of each position's profit (FII sales have no exemption) and zero on a loss. It's a per-position estimate, not the monthly apuração: it doesn't offset losses across positions or months and ignores the 0.005% IRRF;
```

por:

```md
   - the estimated tax is 20% of each FII position's profit (FII sales have no exemption) and zero on a loss. A stock pays 15% of its profit in each month whose stock sales (quantity × price of every stock sale, open positions included) exceed R$ 20,000; up to that, the month is exempt (`taxExempt` marks a profit made only in exempt months). It's a per-position estimate, not the monthly apuração: it doesn't offset losses across positions or months and ignores the 0.005% IRRF and day trade;
```

8. Na seção B3 update, troque:

```md
- The parsing and the plan are pure: `transactions/import/b3`, with `detectB3File`, the three readers (Negociação, Movimentação, Eventos) and `planB3Import`.
```

por:

```md
- The parsing and the plan are pure: `transactions/import/b3`, with `detectB3File`, the three readers (Negociação, Movimentação, Eventos) and `planB3Import`.
  - `codes.ts` holds the B3 code patterns.
  - `classify.ts` holds the classification: FIIs, Fiagros, stocks and units enter.
  - `lending.ts` holds the lending pairing.
  - `dividends.ts` holds the dividends, the "a receber" and the check by dividends.
```

9. Troque:

```md
  - The plan also extracts the Rendimento and Reembolso credits of FIIs from the Movimentação statement into the `dividends` collection (`transactions/server/dividend.model.ts`). Stocks' dividends, JCP and lending fees stay out.
  - Inside the Movimentação period they are replaced FII by FII.
```

por:

```md
  - The plan also extracts the dividend credits from the Movimentação statement into the `dividends` collection (`transactions/server/dividend.model.ts`):
    - Rendimento and Reembolso, of FIIs and stocks;
    - Dividendo;
    - Juros Sobre Capital Próprio (`JCP`, already net of the 15%);
    - the lending fee, from an "Empréstimo" row with a value (`ALUGUEL`), of FIIs and stocks.
  - Inside the Movimentação period they are replaced asset by asset.
```

10. Troque:

```md
  - The Eventos statement's FII "Rendimento" and "Reembolso - Rendimento" rows become the snapshot in `dividend_forecasts`
```

por:

```md
  - The Eventos statement's dividend rows (FII "Rendimento" and "Reembolso - Rendimento"; stock "DIVIDENDO", "JUROS SOBRE CAPITAL PRÓPRIO" and their "Reembolso - …" rows) become the snapshot in `dividend_forecasts`
```

11. Antes da linha `- **Subscription prices:**`, acrescente:

```md
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
```

12. Em Product rules, depois do item `- **No B3 calls:** …`, acrescente:

```md
- **Stocks (2026-10-30):** they enter positions, dividends, lending and the estimated tax, never the Carteira Alvo or the recommendations. Spec: `2026-10-30-acoes-etapa-1-design.md`. Stage 2 (the Geral/FIIs/Ações views) gets its own spec.
```

- [ ] **Step 2: Specs**

1. Em `docs/superpowers/specs/2026-10-18-importacao-b3-design.md`, depois da linha que começa com `- **Substituído em parte:**`, acrescente:

```md
- **Ações (2026-10-30):** ações e units passaram a entrar (§4), com os proventos, o aluguel e regras próprias: ver `2026-10-30-acoes-etapa-1-design.md`.
```

2. Em `docs/superpowers/specs/2026-10-23-posicoes-encerradas-design.md`, depois da linha que começa com `- **Atualização (2026-10-23):**`, acrescente:

```md
- **Ações (2026-10-30):** as ações entraram nas encerradas, com IR de 15% e a isenção de R$ 20 mil vendidos por mês: ver `2026-10-30-acoes-etapa-1-design.md` (§8).
```

3. Em `docs/superpowers/specs/2026-10-30-acoes-etapa-1-design.md`, troque `- **Status:** design aprovado na conversa; este documento aguarda revisão` por `- **Status:** aprovado e implementado (branch feat/acoes-etapa-1); conferido com os extratos de 30/10/2026 antes do merge`.

- [ ] **Step 3: Verificação completa e commit**

```bash
npx prettier --write CLAUDE.md docs/superpowers/specs
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
git add CLAUDE.md docs/superpowers/specs
git commit -m "docs: describe the stock support of stage 1"
```

Expected: todos os comandos passam.

---

### Task 13: Deploy (com o ok do dono)

**Goal:** com o ok do dono, publicar o branch em produção e orientá-lo a enviar os 3 extratos em `/atualizacao-b3`.

**Files:** nenhum.

**Acceptance Criteria:**
- [ ] O dono autorizou o push na `main` nesta conversa.
- [ ] A `main` avançou por fast-forward até o último commit do branch e foi enviada ao GitHub.
- [ ] O status do commit na Vercel ficou `success`.
- [ ] O dono recebeu o passo a passo: enviar os 3 extratos, responder as 3 bonificações e confirmar. Ele também sabe o que esperar da prévia:
  - as 9 ações;
  - os proventos das ações e o aluguel dos FIIs como novos;
  - nenhum lançamento de FII trocado.

**Verify:** `git log origin/main -1 --format=%H` igual a `git rev-parse feat/acoes-etapa-1`, e `gh api "repos/{owner}/{repo}/commits/$(git rev-parse HEAD)/status" --jq .state` → `success`.

**Steps:**

- [ ] **Step 1: Pedir o ok do dono**

Pergunte se pode publicar e lembre que o push na `main` vai para produção. Sem o ok, pare aqui.

- [ ] **Step 2: Publicar**

```bash
git switch main
git merge --ff-only feat/acoes-etapa-1
git push origin main
```

- [ ] **Step 3: Acompanhar o deploy**

```bash
gh api "repos/{owner}/{repo}/commits/$(git rev-parse HEAD)/status" --jq '.state, (.statuses[] | [.context, .state] | @tsv)'
```

Repita até a Vercel ficar `success`. Se der `failure`, leia o log do deploy e corrija num novo commit no branch.

- [ ] **Step 4: Orientar o dono**

Passe a ele o passo a passo dos Acceptance Criteria. Lembre que, sem custo atribuído informado, 0 é uma resposta válida, e que ele pode corrigir depois reenviando os extratos com o valor certo.
