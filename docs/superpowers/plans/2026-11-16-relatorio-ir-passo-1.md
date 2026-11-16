# Relatório de IR, passo 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/imposto-de-renda` do passo 1 da spec `docs/superpowers/specs/2026-11-16-relatorio-ir-design.md`: CNPJ pela CVM, Bens e Direitos em 31/12, proventos por ficha, apuração mensal com saldo inicial (sem day trade e sem IRRF), auditoria por regras, textos do Gemini validados pelo código e exportação (copiar, JSON, impressão).

**Architecture:** Nova feature `src/features/tax-report` com `domain/` puro (tudo o que é número), `server/` (leitura dos dados, CVM, textos do Gemini) e `components/`. O relatório é um `FiscalYearReport` determinístico montado por `buildFiscalYearReport`. O Gemini só reescreve texto e só é aceito se os números forem os do modelo fixo. Reaproveita `replayLedger`, as constantes de `closed-positions.ts` e `stockSalesByMonth`.

**Tech Stack:** Next 16 (Server Components, Server Actions com next-safe-action), Mongoose, Vitest, `fflate` (única dependência nova, para ler os ZIPs da CVM), cadeia Gemini existente.

**Desvios da spec (a registrar na spec ao fechar a Task 12):**
- A sincronização do CNPJ roda numa rota própria `/api/cron/cnpj` (semanal, cron-job.org), não no cron diário: os ZIPs da CVM são grandes e o cron-job.org corta em 30 s.
- `PROVENTO_APOS_ENCERRAR` e `RETENCAO_DIVIDENDO_POSSIVEL` ficam: o primeiro adiado para o passo 2, o segundo entra já (regra simples).
- Tarefas nativas (`TaskCreate`) não foram criadas: a ferramenta de lista de tarefas está desativada nesta sessão. O plano `.md` é a fonte.

**Convenções do repo a respeitar (CLAUDE.md):** pt-BR em textos e comentários; commits em inglês, Conventional Commits; imports entre features só por `index.ts`/`server.ts`/`ui.ts`/`actions.ts`; `domain/` sem Next, React, banco nem I/O; testes ao lado do código, `import { describe, expect, it } from "vitest"`; `typecheck` roda `next typegen`; hook do ESLint já corre a cada edição.

---

## File Structure

```
src/features/tax-report/
  index.ts                     # API pública pura (tipos, buildFiscalYearReport, validadores)
  server.ts                    # DAL: getTaxReportView
  actions.ts                   # Server Actions: CNPJ manual, saldo de prejuízo, textos da IA
  ui.ts                        # componentes cliente
  schemas.ts                   # Zod das actions
  domain/
    types.ts                   # FiscalClass, AssetFiscalPosition, DividendFiscalItem, ApurationMonth, FiscalYearReport...
    format.ts                  # round2, formatMoney, formatPrice (pt-BR)
    cnpj.ts                    # isValidCnpj, formatCnpj, digitsOf
    receita-codes.ts           # códigos da Receita por ano-calendário
    year-end-positions.ts      # posições em 31/12 + discriminação em modelo fixo
    year-dividends.ts          # proventos do ano por ficha (JCP bruto/retido)
    monthly-apuration.ts       # apuração mensal sem day trade e sem IRRF
    audit.ts                   # achados por regras
    report.ts                  # buildFiscalYearReport
    cvm-cnpj.ts                # parsers do CSV da CVM e casamento ticker↔CNPJ
    narrative.ts               # prompt, esquema, validação da resposta do Gemini
    *.test.ts                  # ao lado de cada arquivo
  server/
    tax-report-view.ts         # getTaxReportView
    cvm-service.ts             # baixa e grava CNPJ (cron)
    tax-loss.model.ts, tax-loss-repo.ts
    narrative.model.ts, narrative-repo.ts, narrative-service.ts
  components/
    tax-report-panel.tsx, bens-table.tsx, proventos-tables.tsx, apuration-table.tsx,
    audit-list.tsx, cnpj-field.tsx, opening-loss-form.tsx, export-bar.tsx, copy-button.tsx
src/app/(app)/imposto-de-renda/page.tsx
src/app/api/cron/cnpj/route.ts
```

Modificados: `src/features/market-data/server/models.ts` (campos do ativo), `src/features/market-data/server.ts` e `assets-read.ts` (exportar identidade e a cadeia Gemini), `src/proxy.ts`, `src/shared/components/nav-items.ts`, `CLAUDE.md`, `docs/operations/cron-job-org.md`.

---

### Task 0: Esqueleto, formatação e CNPJ

**Goal:** Criar os tipos base, o formatador pt-BR e o validador de CNPJ, com testes.

**Files:**
- Create: `src/features/tax-report/domain/types.ts`, `format.ts`, `cnpj.ts`, `cnpj.test.ts`, `format.test.ts`

**Acceptance Criteria:**
- [ ] `isValidCnpj("33.000.167/0001-01")` e `isValidCnpj("00.000.000/0001-91")` são `true`; `"11.111.111/1111-11"` e um CNPJ com dígito alterado são `false`.
- [ ] `formatMoney(1234.5)` é `"1.234,50"`; `formatPrice(12.3456)` é `"12,3456"` e `formatPrice(12.3)` é `"12,30"`.

**Verify:** `npx vitest run src/features/tax-report/domain/cnpj.test.ts src/features/tax-report/domain/format.test.ts` → todos passam.

**Steps:**

- [ ] **Step 1: Escrever os testes**

`src/features/tax-report/domain/cnpj.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { digitsOf, formatCnpj, isValidCnpj } from "./cnpj";

describe("isValidCnpj", () => {
  it("aceita CNPJs reais, com ou sem máscara", () => {
    expect(isValidCnpj("33.000.167/0001-01")).toBe(true);
    expect(isValidCnpj("33000167000101")).toBe(true);
    expect(isValidCnpj("00.000.000/0001-91")).toBe(true);
  });
  it("recusa dígito errado, tamanho errado e repetidos", () => {
    expect(isValidCnpj("33.000.167/0001-02")).toBe(false);
    expect(isValidCnpj("33.000.167/0001")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
});

describe("formatCnpj e digitsOf", () => {
  it("põe a máscara em 14 dígitos e devolve o resto como veio", () => {
    expect(formatCnpj("33000167000101")).toBe("33.000.167/0001-01");
    expect(formatCnpj("123")).toBe("123");
    expect(digitsOf("33.000.167/0001-01")).toBe("33000167000101");
  });
});
```

`src/features/tax-report/domain/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatMoney, formatPrice, round2 } from "./format";

describe("format", () => {
  it("round2 arredonda ao centavo", () => {
    expect(round2(1.005 + 1e-9)).toBe(1.01);
    expect(round2(-0.004)).toBe(-0);
  });
  it("formatMoney usa milhar com ponto e 2 casas", () => {
    expect(formatMoney(1234.5)).toBe("1.234,50");
    expect(formatMoney(0)).toBe("0,00");
  });
  it("formatPrice mostra de 2 a 4 casas", () => {
    expect(formatPrice(12.3456)).toBe("12,3456");
    expect(formatPrice(12.3)).toBe("12,30");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/features/tax-report/domain/cnpj.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/features/tax-report/domain/cnpj.ts`:

```ts
/** Só os dígitos de um CNPJ digitado ou colado. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Confere os dois dígitos verificadores (módulo 11). Repetidos como 111…1 não valem. */
export function isValidCnpj(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = (size: number): number => {
    let sum = 0;
    let weight = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += Number(d[size - i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

/** `33000167000101` → `33.000.167/0001-01`; outro tamanho volta como veio. */
export function formatCnpj(value: string): string {
  const d = digitsOf(value);
  if (d.length !== 14) return value;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
```

`src/features/tax-report/domain/format.ts`:

```ts
const MONEY = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PRICE = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Arredonda ao centavo. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `1234.5` → `1.234,50`, sem o "R$" (os textos da Receita já trazem). */
export function formatMoney(value: number): string {
  return MONEY.format(round2(value));
}

/** Preço médio: de 2 a 4 casas. */
export function formatPrice(value: number): string {
  return PRICE.format(value);
}
```

`src/features/tax-report/domain/types.ts` (tipos usados por todas as tasks seguintes; manter exatamente estes nomes):

```ts
import type { AssetClass } from "@/features/market-data";

/** As duas classes que o app acompanha. */
export type FiscalClass = AssetClass;

export type CnpjSource = "CVM_FCA" | "CVM_ISIN" | "MANUAL";

/** O que se sabe do emissor de um ativo. */
export type AssetIdentity = {
  name: string | null;
  legalName: string | null;
  cnpj: string | null;
  cnpjSource: CnpjSource | null;
};

export type ReceitaCode = { group: string; code: string; label: string; needsCheck?: boolean };

export type PositionFlag = "PRECO_ESTIMADO" | "POSICAO_ANTERIOR";

/** Uma linha da ficha Bens e Direitos. */
export type AssetFiscalPosition = {
  ticker: string;
  assetClass: FiscalClass;
  name: string | null;
  cnpj: string | null;
  quantityPrevious: number;
  costPrevious: number;
  quantity: number;
  cost: number;
  averagePrice: number;
  receita: ReceitaCode;
  /** Texto de modelo fixo; null enquanto faltar o CNPJ ou se a posição zerou. */
  discrimination: string | null;
  closedInYear: boolean;
  flags: PositionFlag[];
};

export type DividendSheet = "ISENTO" | "EXCLUSIVA";

/** Um grupo de proventos por fonte pagadora e ficha. */
export type DividendFiscalItem = {
  /** CNPJ formatado ou, sem CNPJ, o ticker. */
  sourceKey: string;
  tickers: string[];
  cnpj: string | null;
  sheet: DividendSheet;
  receita: ReceitaCode;
  /** Líquido recebido. */
  net: number;
  /** Bruto (JCP); nas demais é igual ao líquido. */
  gross: number;
  /** Imposto retido na fonte (JCP); zero nas demais. */
  withheld: number;
};

export type FiscalFlagCode =
  | "CNPJ_AUSENTE"
  | "PRECO_ESTIMADO"
  | "POSICAO_ANTERIOR"
  | "SALDO_PREJUIZO_NAO_INFORMADO"
  | "PROVENTO_REEMBOLSO"
  | "ALUGUEL_NAO_CLASSIFICADO"
  | "RETENCAO_DIVIDENDO_POSSIVEL"
  | "JCP_FORA_DA_FAIXA"
  | "DAY_TRADE_NAO_APURADO"
  | "VENDA_ACIMA_ISENCAO";

export type FindingSeverity = "INFO" | "ATENCAO" | "CRITICO";

export type AuditFinding = {
  code: FiscalFlagCode;
  severity: FindingSeverity;
  ticker: string | null;
  /** AAAA-MM quando o achado é de um mês. */
  month: string | null;
  message: string;
};

/** Um mês de apuração de uma classe (swing trade). */
export type ApurationMonth = {
  month: string;
  assetClass: FiscalClass;
  /** Quantidade × preço de todas as vendas da classe (base da isenção das ações). */
  sold: number;
  /** Vendido líquido das taxas menos o custo: lucro ou prejuízo do mês. */
  result: number;
  exempt: boolean;
  lossCompensated: number;
  taxableBase: number;
  tax: number;
  lossBalanceAfter: number;
};

export type DarfMonth = { month: string; tax: number; due: number; carriedOut: number };

export type FiscalYearReport = {
  year: number;
  positions: AssetFiscalPosition[];
  exempt: DividendFiscalItem[];
  exclusive: DividendFiscalItem[];
  /** Reembolso e aluguel: fora das fichas até o dono conferir. */
  unclassified: { ticker: string; kind: string; month: string; amount: number }[];
  apuration: { months: ApurationMonth[]; darf: DarfMonth[]; openingLoss: Record<FiscalClass, number> };
  closingLoss: Record<FiscalClass, number>;
  findings: AuditFinding[];
};
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/features/tax-report/domain/cnpj.test.ts src/features/tax-report/domain/format.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/tax-report/domain
git commit -m "feat(tax-report): add fiscal types, pt-BR formatting and CNPJ validation"
```

---

### Task 1: Códigos da Receita e posições em 31/12

**Goal:** Tabela de códigos por ano e as linhas de Bens e Direitos (anterior e atual), com a discriminação em modelo fixo.

**Files:**
- Create: `src/features/tax-report/domain/receita-codes.ts`, `year-end-positions.ts`, `year-end-positions.test.ts`

**Acceptance Criteria:**
- [ ] Compra de 100 a R$ 10,00 com R$ 5,00 de taxa, em 2025, dá quantidade 100, custo 1.005,00 e preço médio 10,05 em 31/12/2025.
- [ ] Venda parcial, desdobro e posição zerada no ano seguem `replayLedger` (custo no preço médio).
- [ ] A coluna anterior é a foto de 31/12 do ano anterior; ativo comprado no ano tem anterior zero.
- [ ] Ativo zerado no ano aparece com `closedInYear: true` e sem discriminação.
- [ ] Sem CNPJ, `discrimination` é `null`. Com CNPJ, o texto é exatamente o modelo da spec §6, sem corretora.
- [ ] `PRECO_ESTIMADO` quando há compra `ESTIMADO` até a data; `POSICAO_ANTERIOR` quando há lançamento `POSICAO_ANTERIOR`.

**Verify:** `npx vitest run src/features/tax-report/domain/year-end-positions.test.ts` → passam.

**Steps:**

- [ ] **Step 1: Escrever os testes** (`year-end-positions.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/features/transactions";
import type { AssetIdentity } from "./types";
import { buildAssetPositions, discriminationOf } from "./year-end-positions";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
let seq = 0;
function entry(p: Partial<LedgerEntry> & Pick<LedgerEntry, "ticker" | "type" | "quantity" | "unitPrice" | "date">): LedgerEntry & { priceSource?: "ESTIMADO" | null } {
  seq += 1;
  return { id: `e${seq}`, fees: 0, createdAt: new Date(2020, 0, 1, 0, 0, seq), ...p };
}

const ident = (cnpj: string | null): AssetIdentity => ({
  name: "Empresa Teste S.A.",
  legalName: "EMPRESA TESTE S.A.",
  cnpj,
  cnpjSource: cnpj ? "MANUAL" : null,
});

const classes = new Map([["TEST3", "ACAO" as const], ["TSTF11", "FII" as const]]);

describe("buildAssetPositions", () => {
  it("custo inclui taxas e a coluna anterior é a foto do ano passado", () => {
    const entries = [
      entry({ ticker: "TEST3", type: "BUY", quantity: 100, unitPrice: 10, fees: 5, date: day("2024-03-01") }),
      entry({ ticker: "TEST3", type: "BUY", quantity: 100, unitPrice: 12, fees: 0, date: day("2025-03-01") }),
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map([["TEST3", ident("33.000.167/0001-01")]]),
    });
    expect(p.quantityPrevious).toBe(100);
    expect(p.costPrevious).toBeCloseTo(1005, 6);
    expect(p.quantity).toBe(200);
    expect(p.cost).toBeCloseTo(2205, 6);
    expect(p.averagePrice).toBeCloseTo(11.025, 6);
    expect(p.receita).toMatchObject({ group: "03", code: "01" });
  });

  it("venda parcial baixa o custo pelo preço médio", () => {
    const entries = [
      entry({ ticker: "TEST3", type: "BUY", quantity: 100, unitPrice: 10, date: day("2025-01-10") }),
      entry({ ticker: "TEST3", type: "SELL", quantity: 40, unitPrice: 15, date: day("2025-02-10") }),
    ];
    const [p] = buildAssetPositions({ year: 2025, entries, assetClasses: classes, identities: new Map() });
    expect(p.quantity).toBe(60);
    expect(p.cost).toBeCloseTo(600, 6);
    expect(p.quantityPrevious).toBe(0);
  });

  it("posição zerada no ano é 'encerrada no ano' e não tem discriminação", () => {
    const entries = [
      entry({ ticker: "TSTF11", type: "BUY", quantity: 10, unitPrice: 100, date: day("2024-05-01") }),
      entry({ ticker: "TSTF11", type: "SELL", quantity: 10, unitPrice: 110, date: day("2025-05-01") }),
    ];
    const [p] = buildAssetPositions({
      year: 2025,
      entries,
      assetClasses: classes,
      identities: new Map([["TSTF11", ident("33.000.167/0001-01")]]),
    });
    expect(p.closedInYear).toBe(true);
    expect(p.quantity).toBe(0);
    expect(p.discrimination).toBeNull();
    expect(p.receita).toMatchObject({ group: "07", code: "03" });
  });

  it("ignora o que não existia em nenhuma das duas datas", () => {
    const entries = [
      entry({ ticker: "TEST3", type: "BUY", quantity: 5, unitPrice: 10, date: day("2026-02-01") }),
    ];
    expect(buildAssetPositions({ year: 2025, entries, assetClasses: classes, identities: new Map() })).toEqual([]);
  });

  it("marca preço estimado e posição anterior", () => {
    const entries = [
      entry({ ticker: "TEST3", type: "BUY", quantity: 10, unitPrice: 10, date: day("2019-11-07"), kind: "POSICAO_ANTERIOR" }),
      { ...entry({ ticker: "TEST3", type: "BUY", quantity: 10, unitPrice: 10, date: day("2024-01-01") }), priceSource: "ESTIMADO" as const },
    ];
    const [p] = buildAssetPositions({ year: 2025, entries, assetClasses: classes, identities: new Map() });
    expect(p.flags).toEqual(["PRECO_ESTIMADO", "POSICAO_ANTERIOR"]);
  });
});

describe("discriminationOf", () => {
  it("monta o modelo da spec, sem corretora", () => {
    expect(
      discriminationOf({
        assetClass: "ACAO",
        quantity: 200,
        name: "Petróleo Brasileiro S.A.",
        ticker: "PETR4",
        cnpj: "33.000.167/0001-01",
        cost: 2205,
        averagePrice: 11.025,
      }),
    ).toBe(
      "200 AÇÕES DE PETRÓLEO BRASILEIRO S.A. (PETR4), CNPJ 33.000.167/0001-01. CUSTO TOTAL DE AQUISIÇÃO: R$ 2.205,00 (PREÇO MÉDIO DE R$ 11,025).",
    );
  });
  it("FII usa COTAS e sem CNPJ devolve null", () => {
    const base = { assetClass: "FII" as const, quantity: 3, name: "Fundo X", ticker: "XPTO11", cost: 300, averagePrice: 100 };
    expect(discriminationOf({ ...base, cnpj: "33.000.167/0001-01" })).toContain("3 COTAS DE FUNDO X (XPTO11)");
    expect(discriminationOf({ ...base, cnpj: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/features/tax-report/domain/year-end-positions.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`src/features/tax-report/domain/receita-codes.ts`:

```ts
import type { FiscalClass, ReceitaCode } from "./types";

export type ReceitaCodes = {
  bens: Record<FiscalClass, ReceitaCode>;
  dividendo: ReceitaCode;
  rendimentoFii: ReceitaCode;
  jcp: ReceitaCode;
};

/**
 * Códigos da DIRPF por ano-calendário (programa da Receita). `needsCheck` marca o que uma fonte
 * consultada em 2026-11-16 deu diferente (rendimento de FII: 26 ou 14): conferir no programa do
 * ano antes de declarar. Um ano novo entra como outra chave; os anteriores não mudam.
 */
const CODES: Record<number, ReceitaCodes> = {
  2025: {
    bens: {
      ACAO: { group: "03", code: "01", label: "Participações societárias: ações" },
      FII: { group: "07", code: "03", label: "Fundos: Fundo de Investimento Imobiliário (FII)" },
    },
    dividendo: { group: "Isentos", code: "09", label: "Lucros e dividendos recebidos" },
    rendimentoFii: { group: "Isentos", code: "26", label: "Outros (rendimentos de FII)", needsCheck: true },
    jcp: { group: "Exclusiva", code: "10", label: "Juros sobre capital próprio" },
  },
};

/** Os códigos do ano, ou os do último ano anterior que a tabela conhece. */
export function receitaCodesFor(year: number): ReceitaCodes {
  const known = Object.keys(CODES)
    .map(Number)
    .filter((y) => y <= year)
    .sort((a, b) => b - a)[0];
  return CODES[known ?? 2025];
}
```

`src/features/tax-report/domain/year-end-positions.ts`:

```ts
import { replayLedger, type LedgerEntry } from "@/features/transactions";
import type { PriceSource } from "@/features/transactions/domain/types";
import { formatCnpj } from "./cnpj";
import { formatMoney, formatPrice } from "./format";
import { receitaCodesFor } from "./receita-codes";
import type { AssetFiscalPosition, AssetIdentity, FiscalClass, PositionFlag } from "./types";

const EPSILON = 1e-9;

export type TaxLedgerEntry = LedgerEntry & { priceSource?: PriceSource | null };

const endOfYear = (year: number) => Date.UTC(year, 11, 31);

/** As posições em 31/12: o livro-razão até essa data, pelo preço médio da Receita (com taxas). */
function positionsAt(entries: readonly LedgerEntry[], year: number) {
  const cutoff = endOfYear(year);
  const { positions } = replayLedger(entries.filter((e) => e.date.getTime() <= cutoff));
  return new Map(positions.map((p) => [p.ticker, p]));
}

type DiscriminationInput = {
  assetClass: FiscalClass;
  quantity: number;
  name: string | null;
  ticker: string;
  cnpj: string | null;
  cost: number;
  averagePrice: number;
};

/** Texto de modelo fixo da ficha (spec §6). Sem CNPJ não há texto: é pendência, não texto errado. */
export function discriminationOf(input: DiscriminationInput): string | null {
  if (!input.cnpj) return null;
  const unit = input.assetClass === "FII" ? "COTAS" : "AÇÕES";
  const name = (input.name ?? input.ticker).toUpperCase();
  return (
    `${input.quantity} ${unit} DE ${name} (${input.ticker}), CNPJ ${formatCnpj(input.cnpj)}. ` +
    `CUSTO TOTAL DE AQUISIÇÃO: R$ ${formatMoney(input.cost)} (PREÇO MÉDIO DE R$ ${formatPrice(input.averagePrice)}).`
  );
}

export function buildAssetPositions(input: {
  year: number;
  entries: readonly TaxLedgerEntry[];
  assetClasses: ReadonlyMap<string, FiscalClass>;
  identities: ReadonlyMap<string, AssetIdentity>;
}): AssetFiscalPosition[] {
  const { year, entries, assetClasses, identities } = input;
  const previous = positionsAt(entries, year - 1);
  const current = positionsAt(entries, year);
  const codes = receitaCodesFor(year);
  const cutoff = endOfYear(year);
  const rows: AssetFiscalPosition[] = [];

  for (const ticker of new Set([...previous.keys(), ...current.keys()])) {
    const assetClass = assetClasses.get(ticker);
    if (!assetClass) continue;
    const prev = previous.get(ticker);
    const cur = current.get(ticker);
    const quantityPrevious = prev && prev.quantity > EPSILON ? prev.quantity : 0;
    const quantity = cur && cur.quantity > EPSILON ? cur.quantity : 0;
    if (quantityPrevious === 0 && quantity === 0) continue;

    const own = entries.filter((e) => e.ticker === ticker && e.date.getTime() <= cutoff);
    const flags: PositionFlag[] = [];
    if (own.some((e) => e.type === "BUY" && e.priceSource === "ESTIMADO")) flags.push("PRECO_ESTIMADO");
    if (own.some((e) => e.kind === "POSICAO_ANTERIOR")) flags.push("POSICAO_ANTERIOR");

    const identity = identities.get(ticker);
    const cost = quantity > 0 ? (cur?.totalCost ?? 0) : 0;
    const averagePrice = quantity > 0 ? cost / quantity : 0;
    rows.push({
      ticker,
      assetClass,
      name: identity?.legalName ?? identity?.name ?? null,
      cnpj: identity?.cnpj ?? null,
      quantityPrevious,
      costPrevious: quantityPrevious > 0 ? (prev?.totalCost ?? 0) : 0,
      quantity,
      cost,
      averagePrice,
      receita: codes.bens[assetClass],
      discrimination:
        quantity > 0
          ? discriminationOf({
              assetClass,
              quantity,
              name: identity?.legalName ?? identity?.name ?? null,
              ticker,
              cnpj: identity?.cnpj ?? null,
              cost,
              averagePrice,
            })
          : null,
      closedInYear: quantity === 0,
      flags,
    });
  }
  return rows.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/features/tax-report/domain/year-end-positions.test.ts` → PASS. Se `replayLedger` devolver `totalCost` sem o custo de uma posição zerada, os asserts de `quantity === 0` não dependem dele.

- [ ] **Step 5: Commit**

```bash
git add src/features/tax-report/domain
git commit -m "feat(tax-report): build year-end positions and the fixed discrimination text"
```

---

### Task 2: Proventos do ano por ficha

**Goal:** Agrupar os proventos pagos no ano por fonte pagadora e ficha, calcular bruto e retido do JCP e separar reembolso e aluguel.

**Files:**
- Create: `src/features/tax-report/domain/year-dividends.ts`, `year-dividends.test.ts`

**Acceptance Criteria:**
- [ ] JCP líquido 85,00 → bruto 100,00 e retido 15,00; líquido 0,85 → bruto 1,00 e retido 0,15.
- [ ] `DIVIDENDO` vai a Isentos 09; `RENDIMENTO` a Isentos 26 (`needsCheck`); `JCP` a Exclusiva 10.
- [ ] `REEMBOLSO` e `ALUGUEL` ficam em `unclassified`, fora das somas.
- [ ] Só pagamentos com `paidAt` no ano entram (UTC).
- [ ] Dois tickers com o mesmo CNPJ (PETR3 e PETR4) somam na mesma fonte; sem CNPJ, a chave é o ticker.
- [ ] JCP com `perShare` e `quantity` cujo líquido difere em mais de R$ 0,02 de 85% do bruto do extrato gera `jcpOffRange` para o ticker; sem esses campos, o bruto vem de líquido ÷ 0,85 e nunca marca.

**Verify:** `npx vitest run src/features/tax-report/domain/year-dividends.test.ts` → passam.

**Steps:**

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from "vitest";
import type { DividendEntry } from "@/features/transactions";
import { grossUpJcp, groupYearDividends } from "./year-dividends";

const pay = (iso: string, p: Partial<DividendEntry> & Pick<DividendEntry, "ticker" | "kind" | "amount">): DividendEntry => ({
  paidAt: new Date(`${iso}T00:00:00Z`),
  quantity: null,
  perShare: null,
  ...p,
});

describe("grossUpJcp", () => {
  it("sem bruto por cota, recompõe o bruto e o retido a partir do líquido de 85%", () => {
    expect(grossUpJcp(85)).toEqual({ gross: 100, withheld: 15, offRange: false });
    expect(grossUpJcp(0.85)).toEqual({ gross: 1, withheld: 0.15, offRange: false });
  });
  it("com bruto por cota e quantidade, o bruto é o do extrato e confere os 85%", () => {
    // 100 ações × R$ 1,00 bruto = 100,00; líquido 85,00
    expect(grossUpJcp(85, 1, 100)).toEqual({ gross: 100, withheld: 15, offRange: false });
  });
  it("marca o líquido que não bate com 85% do bruto do extrato", () => {
    expect(grossUpJcp(80, 1, 100)).toMatchObject({ gross: 100, withheld: 20, offRange: true });
  });
});

describe("groupYearDividends", () => {
  const cnpjOf = (t: string) => (t.startsWith("PETR") ? "33.000.167/0001-01" : t === "SEMCNPJ3" ? null : "00.000.000/0001-91");
  const classOf = (t: string) => (t.endsWith("11") ? ("FII" as const) : ("ACAO" as const));

  it("agrupa por fonte e ficha e ignora outros anos", () => {
    const r = groupYearDividends({
      year: 2025,
      dividends: [
        pay("2025-03-10", { ticker: "PETR3", kind: "DIVIDENDO", amount: 10 }),
        pay("2025-04-10", { ticker: "PETR4", kind: "DIVIDENDO", amount: 5.5 }),
        pay("2024-12-31", { ticker: "PETR4", kind: "DIVIDENDO", amount: 99 }),
        pay("2025-06-10", { ticker: "HGLG11", kind: "RENDIMENTO", amount: 7.25 }),
        pay("2025-05-10", { ticker: "PETR4", kind: "JCP", amount: 85 }),
        pay("2025-05-11", { ticker: "PETR4", kind: "REEMBOLSO", amount: 1 }),
        pay("2025-05-12", { ticker: "PETR4", kind: "ALUGUEL", amount: 2 }),
      ],
      cnpjOf,
      classOf,
    });
    expect(r.exempt).toHaveLength(2);
    const petr = r.exempt.find((i) => i.cnpj === "33.000.167/0001-01")!;
    expect(petr.net).toBeCloseTo(15.5, 6);
    expect(petr.tickers.sort()).toEqual(["PETR3", "PETR4"]);
    expect(petr.receita.code).toBe("09");
    const fii = r.exempt.find((i) => i.tickers[0] === "HGLG11")!;
    expect(fii.receita).toMatchObject({ code: "26", needsCheck: true });
    expect(r.exclusive).toHaveLength(1);
    expect(r.exclusive[0]).toMatchObject({ net: 85, gross: 100, withheld: 15 });
    expect(r.unclassified.map((u) => u.kind).sort()).toEqual(["ALUGUEL", "REEMBOLSO"]);
  });

  it("sem CNPJ a chave é o ticker", () => {
    const r = groupYearDividends({
      year: 2025,
      dividends: [pay("2025-03-10", { ticker: "SEMCNPJ3", kind: "DIVIDENDO", amount: 3 })],
      cnpjOf,
      classOf,
    });
    expect(r.exempt[0]).toMatchObject({ sourceKey: "SEMCNPJ3", cnpj: null });
  });

  it("devolve os tickers de JCP fora da faixa", () => {
    const r = groupYearDividends({
      year: 2025,
      // 100 ações × R$ 1,00 bruto = 100,00, mas o líquido guardado é 80,00 (devia ser 85,00)
      dividends: [pay("2025-03-10", { ticker: "PETR4", kind: "JCP", amount: 80, quantity: 100, perShare: 1 })],
      cnpjOf,
      classOf,
    });
    expect(r.jcpOffRange).toEqual(["PETR4"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (módulo não existe).

- [ ] **Step 3: Implementar** (`year-dividends.ts`)

```ts
import type { DividendEntry } from "@/features/transactions";
import { round2 } from "./format";
import { receitaCodesFor } from "./receita-codes";
import type { DividendFiscalItem, FiscalClass } from "./types";

/**
 * O JCP vem líquido dos 15% retidos na fonte. Com bruto por cota e quantidade (o extrato da B3 os
 * traz), o bruto é quantidade × bruto por cota e o líquido precisa ser 85% dele, com até R$ 0,02 de
 * diferença; fora disso o dado é suspeito (`offRange`). Sem eles, o bruto é líquido ÷ 0,85 e não há
 * como conferir (recompor o bruto do próprio líquido sempre fecha, então `offRange` é falso).
 */
export function grossUpJcp(
  net: number,
  perShare: number | null = null,
  quantity: number | null = null,
): { gross: number; withheld: number; offRange: boolean } {
  if (perShare !== null && quantity !== null && perShare > 0 && quantity > 0) {
    const gross = round2(perShare * quantity);
    return {
      gross,
      withheld: round2(gross - net),
      offRange: Math.abs(round2(gross * 0.85) - net) > 0.02,
    };
  }
  const gross = round2(net / 0.85);
  return { gross, withheld: round2(gross - net), offRange: false };
}

export type YearDividends = {
  exempt: DividendFiscalItem[];
  exclusive: DividendFiscalItem[];
  unclassified: { ticker: string; kind: string; month: string; amount: number }[];
  jcpOffRange: string[];
};

export function groupYearDividends(input: {
  year: number;
  dividends: readonly DividendEntry[];
  cnpjOf: (ticker: string) => string | null;
  classOf: (ticker: string) => FiscalClass | null;
}): YearDividends {
  const { year, dividends, cnpjOf, classOf } = input;
  const codes = receitaCodesFor(year);
  const groups = new Map<string, DividendFiscalItem>();
  const unclassified: YearDividends["unclassified"] = [];
  const jcpOffRange = new Set<string>();

  const add = (
    sourceKey: string,
    ticker: string,
    cnpj: string | null,
    kind: "DIVIDENDO" | "RENDIMENTO" | "JCP",
    net: number,
    perShare: number | null,
    quantity: number | null,
  ) => {
    const sheet = kind === "JCP" ? "EXCLUSIVA" : "ISENTO";
    const receita = kind === "JCP" ? codes.jcp : kind === "RENDIMENTO" ? codes.rendimentoFii : codes.dividendo;
    const key = `${sheet}|${receita.code}|${sourceKey}`;
    const item = groups.get(key) ?? { sourceKey, tickers: [], cnpj, sheet, receita, net: 0, gross: 0, withheld: 0 };
    if (!item.tickers.includes(ticker)) item.tickers.push(ticker);
    if (kind === "JCP") {
      const g = grossUpJcp(net, perShare, quantity);
      if (g.offRange) jcpOffRange.add(ticker);
      item.gross = round2(item.gross + g.gross);
      item.withheld = round2(item.withheld + g.withheld);
    } else {
      item.gross = round2(item.gross + net);
    }
    item.net = round2(item.net + net);
    groups.set(key, item);
  };

  for (const d of dividends) {
    if (d.paidAt.getUTCFullYear() !== year) continue;
    if (d.kind === "REEMBOLSO" || d.kind === "ALUGUEL") {
      unclassified.push({
        ticker: d.ticker,
        kind: d.kind,
        month: `${year}-${String(d.paidAt.getUTCMonth() + 1).padStart(2, "0")}`,
        amount: d.amount,
      });
      continue;
    }
    if (!classOf(d.ticker)) continue;
    const cnpj = cnpjOf(d.ticker);
    add(cnpj ?? d.ticker, d.ticker, cnpj, d.kind, d.amount, d.perShare, d.quantity);
  }

  const items = [...groups.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return {
    exempt: items.filter((i) => i.sheet === "ISENTO"),
    exclusive: items.filter((i) => i.sheet === "EXCLUSIVA"),
    unclassified,
    jcpOffRange: [...jcpOffRange].sort(),
  };
}
```

Nota (verificada em 2026-11-16 com um script): recompor o bruto só do líquido (`líquido ÷ 0,85`) sempre fecha ao centavo para qualquer líquido de 0,01 a 30,00, então a conferência só tem valor com o bruto por cota × quantidade do extrato. Por isso `grossUpJcp` aceita os dois e o `offRange` só dispara no caso do extrato.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/features/tax-report/domain/year-dividends.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/tax-report/domain
git commit -m "feat(tax-report): group year dividends by sheet and gross up the JCP"
```

---

### Task 3: Apuração mensal (sem day trade e sem IRRF)

**Goal:** Compensação de prejuízo por classe, isenção das ações até R$ 20 mil, imposto e DARF por mês.

**Files:**
- Create: `src/features/tax-report/domain/monthly-apuration.ts`, `monthly-apuration.test.ts`
- Reuse: `STOCK_EXEMPTION_LIMIT`, `FII_CAPITAL_GAINS_RATE`, `STOCK_CAPITAL_GAINS_RATE` de `src/features/portfolio/domain/closed-positions.ts` (exportar pelo `index.ts` de `portfolio` se ainda não estiverem, sem mudar valores).

**Acceptance Criteria:**
- [ ] FII com lucro 50 e sem prejuízo: imposto 10,00. Com saldo de prejuízo 20: compensa 20, base 30, imposto 6,00, saldo 0.
- [ ] Ação com vendas ≤ R$ 20.000 no mês e lucro: isenta, imposto 0 e não consome prejuízo; prejuízo em mês isento entra no saldo.
- [ ] Ação com vendas > R$ 20.000 e lucro: 15% da base depois da compensação.
- [ ] Prejuízo de FII nunca compensa lucro de ação e vice-versa.
- [ ] Perna de saída de incorporação não conta; venda de ticker sem classe é ignorada.
- [ ] DARF abaixo de R$ 10,00 acumula para o mês seguinte (`carriedOut`) e paga junto quando passar de 10.
- [ ] O saldo nunca fica negativo (500 casos com semente).

**Verify:** `npx vitest run src/features/tax-report/domain/monthly-apuration.test.ts` → passam.

**Steps:**

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from "vitest";
import type { RealizedSale } from "@/features/transactions";
import { apureMonthly } from "./monthly-apuration";

let id = 0;
const sale = (ticker: string, iso: string, quantity: number, unitPrice: number, cost: number, fees = 0): RealizedSale & { unitPrice: number } => {
  id += 1;
  return {
    entryId: `s${id}`,
    ticker,
    date: new Date(`${iso}T00:00:00Z`),
    kind: "NEGOCIO",
    quantity,
    proceeds: quantity * unitPrice - fees,
    cost,
    unitPrice,
  };
};

const run = (sales: ReturnType<typeof sale>[], openingLoss = { FII: 0, ACAO: 0 }) =>
  apureMonthly({
    sales,
    unitPriceOf: (entryId) => sales.find((s) => s.entryId === entryId)!.unitPrice,
    classOf: (t) => (t.endsWith("11") ? "FII" : t === "NADA0" ? null : "ACAO"),
    openingLoss,
    throughMonth: "2025-12",
  });

describe("apureMonthly", () => {
  it("FII: 20% do lucro, sem isenção", () => {
    const r = run([sale("AAAA11", "2025-03-10", 10, 15, 100)]);
    expect(r.months[0]).toMatchObject({ assetClass: "FII", result: 50, tax: 10, exempt: false });
  });

  it("FII: saldo de prejuízo reduz a base", () => {
    const r = run([sale("AAAA11", "2025-03-10", 10, 15, 100)], { FII: 20, ACAO: 0 });
    expect(r.months[0]).toMatchObject({ lossCompensated: 20, taxableBase: 30, tax: 6, lossBalanceAfter: 0 });
  });

  it("ação até R$ 20 mil vendidos: isenta e sem consumir prejuízo", () => {
    const r = run([sale("BBBB3", "2025-03-10", 100, 100, 5000)], { FII: 0, ACAO: 100 });
    expect(r.months[0]).toMatchObject({ exempt: true, tax: 0, lossCompensated: 0, lossBalanceAfter: 100 });
  });

  it("ação acima de R$ 20 mil: 15% depois de compensar", () => {
    const r = run([sale("BBBB3", "2025-03-10", 300, 100, 20000)], { FII: 0, ACAO: 1000 });
    // vendido 30.000, resultado 10.000, compensa 1.000, base 9.000, imposto 1.350
    expect(r.months[0]).toMatchObject({ exempt: false, lossCompensated: 1000, taxableBase: 9000, tax: 1350 });
  });

  it("prejuízo de uma classe não compensa a outra", () => {
    const r = run([
      sale("AAAA11", "2025-03-10", 10, 5, 100), // FII −50
      sale("BBBB3", "2025-03-11", 300, 100, 20000), // ação +10.000, vendido 30.000
    ]);
    const stock = r.months.find((m) => m.assetClass === "ACAO")!;
    expect(stock.lossCompensated).toBe(0);
    expect(stock.tax).toBe(1500);
    expect(r.closingLoss.FII).toBe(50);
  });

  it("ignora incorporação e ticker sem classe", () => {
    const inc = { ...sale("AAAA11", "2025-03-10", 10, 15, 100), kind: "INCORPORACAO" as const };
    const r = run([inc, sale("NADA0", "2025-03-10", 10, 15, 100)]);
    expect(r.months).toEqual([]);
  });

  it("DARF abaixo de R$ 10 acumula para o mês seguinte", () => {
    const r = run([
      sale("AAAA11", "2025-03-10", 1, 130, 100), // lucro 30 → imposto 6
      sale("AAAA11", "2025-04-10", 1, 140, 100), // lucro 40 → imposto 8
    ]);
    expect(r.darf).toEqual([
      { month: "2025-03", tax: 6, due: 0, carriedOut: 6 },
      { month: "2025-04", tax: 8, due: 14, carriedOut: 0 },
    ]);
  });

  it("o saldo de prejuízo nunca fica negativo (500 casos com semente)", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let n = 0; n < 500; n++) {
      const sales = Array.from({ length: 8 }, (_, i) =>
        sale(i % 2 ? "AAAA11" : "BBBB3", `2025-${String(1 + (i % 12)).padStart(2, "0")}-10`, 10, 10 + rnd() * 20, 100 + rnd() * 100),
      );
      const r = run(sales, { FII: rnd() * 500, ACAO: rnd() * 500 });
      for (const m of r.months) expect(m.lossBalanceAfter).toBeGreaterThanOrEqual(0);
      expect(r.closingLoss.FII).toBeGreaterThanOrEqual(0);
      expect(r.closingLoss.ACAO).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** (`monthly-apuration.ts`)

```ts
import type { RealizedSale } from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import {
  FII_CAPITAL_GAINS_RATE,
  STOCK_CAPITAL_GAINS_RATE,
  STOCK_EXEMPTION_LIMIT,
} from "@/features/portfolio";
import { round2 } from "./format";
import type { ApurationMonth, DarfMonth, FiscalClass } from "./types";

/** DARF abaixo disso não se paga: soma ao mês seguinte (Lei 10.522/2002, art. 67). */
export const DARF_MINIMUM = 10;

const RATES: Record<FiscalClass, number> = {
  FII: FII_CAPITAL_GAINS_RATE,
  ACAO: STOCK_CAPITAL_GAINS_RATE,
};

/**
 * Apuração mensal de swing trade, por classe. Passo 1 da spec do relatório de IR: sem day trade e
 * sem IRRF ("dedo-duro"). `openingLoss` é o saldo de prejuízo que entra no primeiro mês com venda
 * do livro-razão; a apuração corre desse mês até `throughMonth`, para o saldo chegar certo ao ano
 * declarado, e a tela filtra os meses do ano.
 */
export function apureMonthly(input: {
  sales: readonly RealizedSale[];
  unitPriceOf: (entryId: string) => number;
  classOf: (ticker: string) => FiscalClass | null;
  openingLoss: Record<FiscalClass, number>;
  throughMonth: string;
}): { months: ApurationMonth[]; darf: DarfMonth[]; closingLoss: Record<FiscalClass, number> } {
  const { sales, unitPriceOf, classOf, throughMonth } = input;
  const buckets = new Map<string, { sold: number; result: number }>();
  const monthSet = new Set<string>();

  for (const s of sales) {
    if (s.kind === "INCORPORACAO") continue;
    const assetClass = classOf(s.ticker);
    if (!assetClass) continue;
    const month = monthKeyOfTradeDate(s.date);
    if (month > throughMonth) continue;
    monthSet.add(month);
    const key = `${month}|${assetClass}`;
    const bucket = buckets.get(key) ?? { sold: 0, result: 0 };
    bucket.sold += s.quantity * unitPriceOf(s.entryId);
    bucket.result += s.proceeds - s.cost;
    buckets.set(key, bucket);
  }

  const loss: Record<FiscalClass, number> = { ...input.openingLoss };
  const months: ApurationMonth[] = [];
  const taxByMonth = new Map<string, number>();

  for (const month of [...monthSet].sort()) {
    for (const assetClass of ["FII", "ACAO"] as const) {
      const bucket = buckets.get(`${month}|${assetClass}`);
      if (!bucket) continue;
      const result = Math.abs(bucket.result) < 0.005 ? 0 : round2(bucket.result);
      const sold = round2(bucket.sold);
      const exempt = assetClass === "ACAO" && result > 0 && sold <= STOCK_EXEMPTION_LIMIT;
      let lossCompensated = 0;
      let taxableBase = 0;
      let tax = 0;

      if (result < 0) {
        loss[assetClass] = round2(loss[assetClass] - result);
      } else if (result > 0 && !exempt) {
        lossCompensated = round2(Math.min(loss[assetClass], result));
        taxableBase = round2(result - lossCompensated);
        tax = round2(taxableBase * RATES[assetClass]);
        loss[assetClass] = round2(loss[assetClass] - lossCompensated);
      }

      months.push({ month, assetClass, sold, result, exempt, lossCompensated, taxableBase, tax, lossBalanceAfter: loss[assetClass] });
      taxByMonth.set(month, round2((taxByMonth.get(month) ?? 0) + tax));
    }
  }

  const darf: DarfMonth[] = [];
  let carried = 0;
  for (const month of [...monthSet].sort()) {
    const tax = taxByMonth.get(month) ?? 0;
    const pending = round2(carried + tax);
    if (pending >= DARF_MINIMUM) {
      darf.push({ month, tax, due: pending, carriedOut: 0 });
      carried = 0;
    } else {
      darf.push({ month, tax, due: 0, carriedOut: pending });
      carried = pending;
    }
  }

  return { months, darf, closingLoss: loss };
}
```

Antes de rodar: confirmar que `src/features/portfolio/index.ts` exporta as três constantes; se não, adicioná-las ao `index.ts` (`export { FII_CAPITAL_GAINS_RATE, STOCK_CAPITAL_GAINS_RATE, STOCK_EXEMPTION_LIMIT } from "./domain/closed-positions";`) sem alterar `closed-positions.ts`. O teste de DARF espera `tax: 6` e `tax: 8`; o teste de classes cruzadas usa `unitPriceOf` por `entryId` e o `sale()` guarda `unitPrice` no objeto (campo extra ignorado por `RealizedSale`).

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/features/tax-report/domain/monthly-apuration.test.ts` → PASS. Rodar também `npx vitest run src/features/portfolio/domain/closed-positions.test.ts` → continua passando (nenhum número muda).

- [ ] **Step 5: Commit**

```bash
git add src/features/tax-report src/features/portfolio/index.ts
git commit -m "feat(tax-report): add the monthly capital gains apuration with loss carry-forward"
```

---

### Task 4: Auditoria por regras e montagem do relatório

**Goal:** Achados em código e `buildFiscalYearReport`, que junta posições, proventos, apuração e achados. Reconciliar com as telas existentes.

**Files:**
- Create: `src/features/tax-report/domain/audit.ts`, `audit.test.ts`, `report.ts`, `report.test.ts`, `index.ts`

**Acceptance Criteria:**
- [ ] `CNPJ_AUSENTE` (CRITICO) por ativo da ficha de Bens ou de proventos sem CNPJ.
- [ ] `PRECO_ESTIMADO`, `POSICAO_ANTERIOR` (INFO), `SALDO_PREJUIZO_NAO_INFORMADO` (INFO) quando `openingLossInformed` é falso.
- [ ] `PROVENTO_REEMBOLSO` e `ALUGUEL_NAO_CLASSIFICADO` (ATENCAO) por item de `unclassified`.
- [ ] `JCP_FORA_DA_FAIXA` por ticker de `jcpOffRange`.
- [ ] `RETENCAO_DIVIDENDO_POSSIVEL` só do ano 2026 em diante: dividendos de ação de uma mesma fonte acima de R$ 50.000 em um mês.
- [ ] `DAY_TRADE_NAO_APURADO`: venda no mesmo dia e ticker de uma compra de negócio.
- [ ] `VENDA_ACIMA_ISENCAO` (INFO): mês de ação não isento com imposto > 0.
- [ ] `buildFiscalYearReport` reconcilia: soma de `net` das fichas + `unclassified` = soma dos proventos do ano; e a apuração dos meses de um ano sem saldo inicial soma o mesmo resultado das vendas.

**Verify:** `npx vitest run src/features/tax-report` → todos passam.

**Steps:**

- [ ] **Step 1: Escrever `audit.test.ts` e `report.test.ts`.** Em `audit.test.ts`, chamar `auditReport` com entradas mínimas e verificar um achado por regra (código, severidade, ticker/mês). Em `report.test.ts`, montar um cenário de 2025 com uma compra, uma venda com lucro, um dividendo e um JCP, e conferir:

```ts
expect(round2(sum(report.exempt.map((i) => i.net)) + sum(report.exclusive.map((i) => i.net)) + sum(report.unclassified.map((u) => u.amount))))
  .toBe(round2(sum(dividends.filter((d) => d.paidAt.getUTCFullYear() === 2025).map((d) => d.amount))));
expect(sum(report.apuration.months.map((m) => m.result))).toBeCloseTo(sum(replayLedger(entries).sales.map((s) => s.proceeds - s.cost)), 6);
```

(`sum` é um helper local do teste; a reconciliação com `/proventos` é feita na Task 8, com dados reais.)

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `audit.ts`**

```ts
import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { formatMoney } from "./format";
import type { ApurationMonth, AssetFiscalPosition, AuditFinding, DividendFiscalItem, FiscalClass } from "./types";
import type { YearDividends } from "./year-dividends";

/** A retenção de 10% da Lei 15.270/2025 vale para pagamentos de 2026 em diante, acima disso no mês. */
export const DIVIDEND_RETENTION_FLOOR = 50_000;

const finding = (f: AuditFinding) => f;

export function auditReport(input: {
  year: number;
  positions: readonly AssetFiscalPosition[];
  dividends: YearDividends;
  rawDividends: readonly DividendEntry[];
  entries: readonly LedgerEntry[];
  months: readonly ApurationMonth[];
  openingLossInformed: boolean;
  classOf: (ticker: string) => FiscalClass | null;
  cnpjOf: (ticker: string) => string | null;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const noCnpj = new Set<string>();

  for (const p of input.positions) {
    if (!p.cnpj) noCnpj.add(p.ticker);
    for (const flag of p.flags) {
      out.push(
        finding({
          code: flag,
          severity: "INFO",
          ticker: p.ticker,
          month: null,
          message:
            flag === "PRECO_ESTIMADO"
              ? `${p.ticker}: o custo usa preço de compra estimado; confira a nota de corretagem.`
              : `${p.ticker}: parte da posição vem da posição anterior de 2019 e não tem data de compra.`,
        }),
      );
    }
  }
  for (const item of [...input.dividends.exempt, ...input.dividends.exclusive]) {
    if (!item.cnpj) for (const t of item.tickers) noCnpj.add(t);
  }
  for (const ticker of [...noCnpj].sort()) {
    out.push(finding({ code: "CNPJ_AUSENTE", severity: "CRITICO", ticker, month: null, message: `${ticker}: sem CNPJ do emissor. Informe o CNPJ para gerar o texto e agrupar os proventos.` }));
  }

  if (!input.openingLossInformed) {
    out.push(finding({ code: "SALDO_PREJUIZO_NAO_INFORMADO", severity: "INFO", ticker: null, month: null, message: "Saldo de prejuízo a compensar de anos anteriores não informado: a apuração assume zero." }));
  }

  for (const u of input.dividends.unclassified) {
    out.push(
      finding({
        code: u.kind === "REEMBOLSO" ? "PROVENTO_REEMBOLSO" : "ALUGUEL_NAO_CLASSIFICADO",
        severity: "ATENCAO",
        ticker: u.ticker,
        month: u.month,
        message:
          u.kind === "REEMBOLSO"
            ? `${u.ticker}: reembolso de R$ ${formatMoney(u.amount)} em ${u.month} ficou fora das fichas; confira de qual provento ele é.`
            : `${u.ticker}: aluguel de ativos de R$ ${formatMoney(u.amount)} em ${u.month} ficou fora das fichas; confira como declarar.`,
      }),
    );
  }

  for (const ticker of input.dividends.jcpOffRange) {
    out.push(finding({ code: "JCP_FORA_DA_FAIXA", severity: "ATENCAO", ticker, month: null, message: `${ticker}: o JCP líquido não corresponde a 85% de um valor bruto ao centavo; confira com o informe.` }));
  }

  if (input.year >= 2026) {
    const bySource = new Map<string, number>();
    for (const d of input.rawDividends) {
      if (d.paidAt.getUTCFullYear() !== input.year || d.kind !== "DIVIDENDO" || input.classOf(d.ticker) !== "ACAO") continue;
      const month = `${input.year}-${String(d.paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const key = `${input.cnpjOf(d.ticker) ?? d.ticker}|${month}`;
      bySource.set(key, (bySource.get(key) ?? 0) + d.amount);
    }
    for (const [key, total] of bySource) {
      if (total <= DIVIDEND_RETENTION_FLOOR) continue;
      const [source, month] = key.split("|");
      out.push(finding({ code: "RETENCAO_DIVIDENDO_POSSIVEL", severity: "ATENCAO", ticker: null, month, message: `${source}: R$ ${formatMoney(total)} em dividendos no mês passa de R$ 50.000; pode haver retenção de 10% (Lei 15.270/2025). Confira com o informe.` }));
    }
  }

  const buyDays = new Set(
    input.entries.filter((e) => e.type === "BUY" && (e.kind === undefined || e.kind === "NEGOCIO")).map((e) => `${e.ticker}|${e.date.getTime()}`),
  );
  const dayTrades = new Map<string, string>();
  for (const e of input.entries) {
    if (e.type !== "SELL" || (e.kind !== undefined && e.kind !== "NEGOCIO")) continue;
    if (e.date.getUTCFullYear() !== input.year || !buyDays.has(`${e.ticker}|${e.date.getTime()}`)) continue;
    dayTrades.set(`${e.ticker}|${e.date.getUTCMonth()}`, e.ticker);
  }
  for (const key of [...dayTrades.keys()].sort()) {
    const [ticker, m] = key.split("|");
    const month = `${input.year}-${String(Number(m) + 1).padStart(2, "0")}`;
    out.push(finding({ code: "DAY_TRADE_NAO_APURADO", severity: "ATENCAO", ticker, month, message: `${ticker}: houve compra e venda no mesmo dia em ${month}. Day trade ainda não é apurado aqui (20%, à parte do swing trade).` }));
  }

  for (const m of input.months) {
    if (m.assetClass === "ACAO" && !m.exempt && m.tax > 0) {
      out.push(finding({ code: "VENDA_ACIMA_ISENCAO", severity: "INFO", ticker: null, month: m.month, message: `${m.month}: vendas de ações de R$ ${formatMoney(m.sold)} passaram de R$ 20.000; imposto estimado de R$ ${formatMoney(m.tax)} (DARF 6015).` }));
    }
  }
  return out;
}

export type { DividendFiscalItem };
```

- [ ] **Step 4: Implementar `report.ts`**

```ts
import { replayLedger, type DividendEntry } from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import { auditReport } from "./audit";
import { apureMonthly } from "./monthly-apuration";
import type { AssetIdentity, FiscalClass, FiscalYearReport } from "./types";
import { buildAssetPositions, type TaxLedgerEntry } from "./year-end-positions";
import { groupYearDividends } from "./year-dividends";

export type ReportInput = {
  year: number;
  entries: readonly TaxLedgerEntry[];
  dividends: readonly DividendEntry[];
  assetClasses: ReadonlyMap<string, FiscalClass>;
  identities: ReadonlyMap<string, AssetIdentity>;
  /** Saldo de prejuízo informado pelo dono; ausente = zero e achado `SALDO_PREJUIZO_NAO_INFORMADO`. */
  openingLoss: Record<FiscalClass, number> | null;
};

export function buildFiscalYearReport(input: ReportInput): FiscalYearReport {
  const { year, entries, dividends, assetClasses, identities } = input;
  const classOf = (t: string) => assetClasses.get(t) ?? null;
  const cnpjOf = (t: string) => identities.get(t)?.cnpj ?? null;
  const openingLoss = input.openingLoss ?? { FII: 0, ACAO: 0 };

  const positions = buildAssetPositions({ year, entries, assetClasses, identities });
  const year_dividends = groupYearDividends({ year, dividends, cnpjOf, classOf });

  const { sales } = replayLedger(entries);
  const unitPrice = new Map(entries.map((e) => [e.id, e.unitPrice]));
  const throughMonth = `${year}-12`;
  const full = apureMonthly({ sales, unitPriceOf: (id) => unitPrice.get(id) ?? 0, classOf, openingLoss, throughMonth });
  const inYear = (month: string) => month.startsWith(`${year}-`);
  const months = full.months.filter((m) => inYear(m.month));
  const darf = full.darf.filter((d) => inYear(d.month));

  const findings = auditReport({
    year,
    positions,
    dividends: year_dividends,
    rawDividends: dividends,
    entries,
    months,
    openingLossInformed: input.openingLoss !== null,
    classOf,
    cnpjOf,
  });

  return {
    year,
    positions,
    exempt: year_dividends.exempt,
    exclusive: year_dividends.exclusive,
    unclassified: year_dividends.unclassified,
    apuration: { months, darf, openingLoss },
    closingLoss: full.closingLoss,
    findings,
  };
}

export { monthKeyOfTradeDate };
```

Remover o `export { monthKeyOfTradeDate }` e o import se não for usado (o lint acusa). `src/features/tax-report/index.ts`:

```ts
// API pública pura da feature tax-report.
export { buildFiscalYearReport, type ReportInput } from "./domain/report";
export { formatCnpj, isValidCnpj, digitsOf } from "./domain/cnpj";
export { formatMoney, formatPrice, round2 } from "./domain/format";
export type {
  ApurationMonth,
  AssetFiscalPosition,
  AssetIdentity,
  AuditFinding,
  DarfMonth,
  DividendFiscalItem,
  FiscalClass,
  FiscalYearReport,
} from "./domain/types";
```

- [ ] **Step 5: Rodar tudo** — `npx vitest run src/features/tax-report` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/tax-report
git commit -m "feat(tax-report): add the audit rules and the fiscal year report builder"
```

---

### Task 5: CNPJ pela CVM (parsers puros e casamento)

**Goal:** Ler o CSV de valores mobiliários (ações) e o informe geral (FII) e casar ticker com CNPJ sem ambiguidade.

**Files:**
- Create: `src/features/tax-report/domain/cvm-cnpj.ts`, `cvm-cnpj.test.ts`
- Modify: `package.json` (dependência `fflate`)

**Acceptance Criteria:**
- [ ] `parseCvmCsv` lê separador `;`, aspas e campos vazios.
- [ ] `stockCnpjByTicker` devolve ticker → CNPJ, descarta `N/A`, `NÃO HÁ`, `0000`, e deixa de fora o ticker que tem mais de um CNPJ.
- [ ] `fiiCandidatesByTicker(ticker, funds)` casa por `BR` + 4 letras + `CTF`, aceita só um único CNPJ e, com 0 ou 2+, devolve `null`.
- [ ] `decodeCvm` decodifica Latin-1 (acentos).

**Verify:** `npx vitest run src/features/tax-report/domain/cvm-cnpj.test.ts` → passam.

**Steps:**

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from "vitest";
import { decodeCvm, fiiCnpjForTicker, parseCvmCsv, stockCnpjByTicker } from "./cvm-cnpj";

describe("parseCvmCsv", () => {
  it("lê ; aspas e vazios", () => {
    const rows = parseCvmCsv('A;B;C\n1;"x;y";\n2;z;w');
    expect(rows).toEqual([
      { A: "1", B: "x;y", C: "" },
      { A: "2", B: "z", C: "w" },
    ]);
  });
});

describe("stockCnpjByTicker", () => {
  const rows = [
    { CNPJ_Companhia: "33.000.167/0001-01", Codigo_Negociacao: "PETR3, PETR4", Nome_Empresarial: "PETROBRAS" },
    { CNPJ_Companhia: "02.474.103/0001-19", Codigo_Negociacao: "EGIE3", Nome_Empresarial: "ENGIE" },
    { CNPJ_Companhia: "11.111.111/0001-11", Codigo_Negociacao: "N/A", Nome_Empresarial: "X" },
    { CNPJ_Companhia: "22.222.222/0001-22", Codigo_Negociacao: "DUPL3", Nome_Empresarial: "A" },
    { CNPJ_Companhia: "33.333.333/0001-33", Codigo_Negociacao: "DUPL3", Nome_Empresarial: "B" },
  ];
  it("casa por ticker, separa listas e descarta lixo e ambíguos", () => {
    const m = stockCnpjByTicker(rows);
    expect(m.get("PETR4")).toEqual({ cnpj: "33.000.167/0001-01", legalName: "PETROBRAS" });
    expect(m.get("PETR3")?.cnpj).toBe("33.000.167/0001-01");
    expect(m.get("EGIE3")?.cnpj).toBe("02.474.103/0001-19");
    expect(m.has("N/A")).toBe(false);
    expect(m.has("DUPL3")).toBe(false);
  });
});

describe("fiiCnpjForTicker", () => {
  const funds = [
    { cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" },
    { cnpj: "11.111.111/0001-11", name: "FUNDO HGLG", isin: "BRHGLGCTF004" },
    { cnpj: "22.222.222/0001-22", name: "FUNDO XPLG", isin: "BRXPLGCTF005" },
    { cnpj: "33.333.333/0001-33", name: "OUTRO A", isin: "BRABCDCTF001" },
    { cnpj: "44.444.444/0001-44", name: "OUTRO B", isin: "BRABCDCTF002" },
  ];
  it("casa pelo prefixo do ISIN quando só um CNPJ corresponde", () => {
    expect(fiiCnpjForTicker("HGLG11", funds)).toEqual({ cnpj: "11.111.111/0001-11", legalName: "FUNDO HGLG" });
  });
  it("devolve null sem correspondência ou com mais de um CNPJ", () => {
    expect(fiiCnpjForTicker("ZZZZ11", funds)).toBeNull();
    expect(fiiCnpjForTicker("ABCD11", funds)).toBeNull();
  });
});

describe("decodeCvm", () => {
  it("decodifica Latin-1", () => {
    expect(decodeCvm(new Uint8Array([0x4a, 0x4f, 0xc3 - 0x00, 0x4f]).slice(0, 2))).toBe("JO");
    expect(decodeCvm(new Uint8Array([0xe7, 0xe3]))).toBe("çã");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** (`cvm-cnpj.ts`)

```ts
/** Os arquivos da CVM vêm em Latin-1. */
export function decodeCvm(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

/** CSV da CVM: separador `;`, aspas duplas opcionais, primeira linha é o cabeçalho. */
export function parseCvmCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) lines.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== "")) lines.push(row);
  }
  const [header, ...body] = lines;
  if (!header) return [];
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])));
}

export type CnpjMatch = { cnpj: string; legalName: string };

const TICKER = /^[A-Z]{4}\d{1,2}$/;

/** Ticker → CNPJ e razão social das ações, pelo `valor_mobiliario` do FCA. Ambíguo fica de fora. */
export function stockCnpjByTicker(rows: readonly Record<string, string>[]): Map<string, CnpjMatch> {
  const found = new Map<string, Map<string, string>>();
  for (const r of rows) {
    for (const raw of (r.Codigo_Negociacao ?? "").split(",")) {
      const ticker = raw.trim().toUpperCase();
      if (!TICKER.test(ticker) || !r.CNPJ_Companhia) continue;
      const owners = found.get(ticker) ?? new Map<string, string>();
      owners.set(r.CNPJ_Companhia, r.Nome_Empresarial ?? "");
      found.set(ticker, owners);
    }
  }
  const result = new Map<string, CnpjMatch>();
  for (const [ticker, owners] of found) {
    if (owners.size !== 1) continue;
    const [[cnpj, legalName]] = [...owners];
    result.set(ticker, { cnpj, legalName });
  }
  return result;
}

export type CvmFund = { cnpj: string; name: string; isin: string };

/**
 * FII: o ISIN da cota é `BR` + 4 letras do ticker + `CTF` + 4 caracteres. Aceita só um CNPJ
 * distinto no prefixo; com zero ou mais de um, é pendência para o dono (spec §4).
 */
export function fiiCnpjForTicker(ticker: string, funds: readonly CvmFund[]): CnpjMatch | null {
  const prefix = `BR${ticker.slice(0, 4).toUpperCase()}CTF`;
  const owners = new Map<string, string>();
  for (const f of funds) if (f.isin.toUpperCase().startsWith(prefix)) owners.set(f.cnpj, f.name);
  if (owners.size !== 1) return null;
  const [[cnpj, legalName]] = [...owners];
  return { cnpj, legalName };
}
```

Corrigir o teste `decodeCvm`: a primeira linha com `0xc3 - 0x00` é ruído; manter só `expect(decodeCvm(new Uint8Array([0xe7, 0xe3]))).toBe("çã");`.

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Adicionar `fflate`**

Run: `npm view fflate version time.modified` e instalar uma versão com mais de 2 semanas: `npm install fflate@<versão>`.

- [ ] **Step 6: Commit**

```bash
git add src/features/tax-report/domain package.json package-lock.json
git commit -m "feat(tax-report): add the CVM CNPJ parsers and ticker matching"
```

---

### Task 6: Campos do ativo, serviço da CVM e rota do cron

**Goal:** Gravar `cnpj`, `legalName`, `cnpjSource`, `cnpjFetchedAt` no ativo, sincronizar da CVM e expor a rota `/api/cron/cnpj`.

**Files:**
- Modify: `src/features/market-data/server/models.ts` (schema e `AssetDoc`), `src/features/market-data/server/assets-read.ts` (leitura da identidade), `src/features/market-data/server.ts` (exportar)
- Create: `src/features/tax-report/server/cvm-service.ts`, `src/app/api/cron/cnpj/route.ts`
- Modify: `docs/operations/cron-job-org.md`

**Acceptance Criteria:**
- [ ] O ativo guarda os campos novos; `MANUAL` nunca é sobrescrito pela CVM (teste do filtro de atualização).
- [ ] O serviço lê os ZIPs do ano corrente e do anterior, valida o cabeçalho antes de gravar e usa `withLock("cnpj", 120_000)`.
- [ ] A rota responde só contagens (`updated`, `unmatched`) e passa por `cronJob("cnpj", …)`.
- [ ] Falha de rede ou cabeçalho inesperado lança erro sem gravar nada.

**Verify:** `npm run typecheck` → sem erros; chamada local a `/api/cron/cnpj` com Basic retorna `{updated, unmatched}` (usar banco de experimento, nunca o `koinos` de produção).

**Steps:**

- [ ] **Step 1: Schema.** Em `models.ts`, no `AssetDoc` e em `assetSchema`, acrescentar:

```ts
cnpj: { type: String, default: null },
legalName: { type: String, default: null },
cnpjSource: { type: String, enum: ["CVM_FCA", "CVM_ISIN", "MANUAL", null], default: null },
cnpjFetchedAt: { type: Date, default: null },
```

Reiniciar o dev server depois (modelos do Mongoose são reaproveitados, ver CLAUDE.md).

- [ ] **Step 2: Leitura.** Em `assets-read.ts`, exportar `readAssetIdentities(tickers: string[]): Promise<Map<string, AssetIdentity>>`, lendo `name`, `legalName`, `cnpj`, `cnpjSource` por `_id` (ticker). Exportar por `market-data/server.ts`. `AssetIdentity` é o tipo de `tax-report/domain/types.ts`; para respeitar as fronteiras, declarar o tipo de retorno estruturalmente em `market-data` (sem importar de `tax-report`).

- [ ] **Step 3: Serviço** (`cvm-service.ts`)

```ts
import "server-only";
import { unzipSync } from "fflate";
import { mongoose } from "...";  // usar o mesmo import de conexão de `models.ts`
import { withLock } from "@/shared/db/lock";
import { traced } from "@/shared/lib/tracing";
import {
  decodeCvm, fiiCnpjForTicker, parseCvmCsv, stockCnpjByTicker, type CvmFund,
} from "../domain/cvm-cnpj";

const BASE = "https://dados.cvm.gov.br/dados";
const UA = { "User-Agent": "Koinos/1.0" };
const STOCK_HEADER = ["CNPJ_Companhia", "Codigo_Negociacao", "Nome_Empresarial"];
const FUND_HEADER = ["CNPJ_Fundo_Classe", "Nome_Fundo_Classe", "Codigo_ISIN"];

async function fetchZipFile(url: string, entry: string): Promise<Record<string, string>[]> {
  const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`CVM ${url}: HTTP ${response.status}`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()), { filter: (f) => f.name === entry });
  const bytes = files[entry];
  if (!bytes) throw new Error(`CVM ${url}: arquivo ${entry} ausente`);
  return parseCvmCsv(decodeCvm(bytes));
}

function requireColumns(rows: Record<string, string>[], columns: string[], label: string) {
  if (rows.length === 0 || columns.some((c) => !(c in rows[0]))) {
    throw new Error(`CVM ${label}: cabeçalho inesperado`);
  }
}
```

Completar a função `syncCnpjs(tickers: { ticker: string; assetClass: "FII" | "ACAO" }[])`: baixa `fca_cia_aberta_valor_mobiliario_${year}.csv` do `fca_cia_aberta_${year}.zip` (ano corrente; se 404, o anterior) e `inf_mensal_fii_geral_${year}.csv` do `inf_mensal_fii_${year}.zip` (idem); valida colunas; monta o mapa de ações e a lista de `CvmFund`; para cada ticker, resolve (`stockCnpjByTicker` para `ACAO`, `fiiCnpjForTicker` para `FII`); grava com `bulkWrite` `updateOne({ _id: ticker, cnpjSource: { $ne: "MANUAL" } }, { $set: { cnpj, legalName, cnpjSource, cnpjFetchedAt: now } })` (filtro com `mongoose.trusted` se usar operador, como manda o CLAUDE.md sobre `sanitizeFilter`); devolve `{ updated, unmatched: string[] }`. Envolver em `withLock("cnpj", 120_000)` e `traced("cron.refresh-cnpj", …, (r) => ({ "koinos.cnpj.updated": r.updated, "koinos.cnpj.unmatched": r.unmatched.length }))`. Os tickers vêm de `listTradedTickersWithFirstDate()` (transactions) e das classes de `getAssetClasses` (market-data), só dos que o usuário tem ou teve.

- [ ] **Step 4: Rota** (`src/app/api/cron/cnpj/route.ts`)

```ts
import { syncCnpjs } from "@/features/tax-report/server";
import { cronJob } from "../job";

export const maxDuration = 60;

/** Sincroniza o CNPJ dos ativos pela CVM (semanal, cron-job.org). Responde só contagens. */
export const GET = cronJob("cnpj", async () => {
  const { updated, unmatched } = await syncCnpjs();
  return { updated, unmatched: unmatched.length };
});
```

`syncCnpjs` reúne os tickers do portfólio no próprio serviço (cron não tem sessão: usar `listTradedTickersWithFirstDate` do repositório com todos os portfólios, como as outras rotas de cron fazem com `listHeldQuantities`; seguir o mesmo padrão delas).

- [ ] **Step 5: Docs do cron.** Em `docs/operations/cron-job-org.md`, acrescentar o job: `GET /api/cron/cnpj`, semanal (`0 6 * * 0`), Basic `cron`, timeout esperado < 30 s; checar o tempo na primeira execução e, se passar, dividir ações e FIIs em duas chamadas.

- [ ] **Step 6: Verificar e commitar.** `npm run typecheck && npm run lint` → limpos.

```bash
git add src docs/operations/cron-job-org.md
git commit -m "feat(tax-report): sync issuer CNPJ from the CVM open data"
```

---

### Task 7: Saldo de prejuízo, CNPJ manual e DAL do relatório

**Goal:** Persistir o saldo inicial de prejuízo, permitir CNPJ manual e expor `getTaxReportView`.

**Files:**
- Create: `src/features/tax-report/server/tax-loss.model.ts`, `tax-loss-repo.ts`, `tax-report-view.ts`, `server.ts`, `actions.ts`, `schemas.ts`
- Modify: `src/features/market-data/server.ts` (função de gravar CNPJ manual)

**Acceptance Criteria:**
- [ ] `tax_loss_balances`: um documento por carteira com `fii` e `acao` (≥ 0, centavos), índice único por carteira.
- [ ] `saveOpeningLossAction` valida valores ≥ 0 e ≤ 1e9; `setAssetCnpjAction` valida dígito verificador (`isValidCnpj`) e grava `cnpjSource: "MANUAL"`.
- [ ] `getTaxReportView(year)` usa `getTenant()` (que chama `connection()`), lê ledger, proventos, classes e identidades, e devolve `FiscalYearReport` sem ids.
- [ ] Reconciliação com a tela de proventos: um teste de integração local (script fora do repo, `tsx --conditions=react-server`) compara `getTaxReportView(2025)` com `getDividendsView` do mesmo ano para cada tipo.

**Verify:** `npm run typecheck`; script de reconciliação imprime diferença 0,00 por tipo.

**Steps:**

- [ ] **Step 1: Modelo e repositório.** Seguir `independence/server/plan.model.ts`/`plan-repo.ts`: schema `{ portfolioId, fii, acao }` com `min: 0`, índice `{ portfolioId: 1 }` único, coleção `tax_loss_balances`; funções `findOpeningLoss(portfolioId): Promise<{FII:number;ACAO:number}|null>` e `saveOpeningLoss(portfolioId, { FII, ACAO })` (`findOneAndUpdate` com `upsert`, filtro por `portfolioId`).

- [ ] **Step 2: Schemas**

```ts
import { z } from "zod";

export const openingLossSchema = z.object({
  fii: z.number().min(0).max(1e9),
  acao: z.number().min(0).max(1e9),
});

export const assetCnpjSchema = z.object({
  ticker: z.string().regex(/^[A-Z]{4}\d{1,2}$/),
  cnpj: z.string().refine((v) => isValidCnpj(v), "CNPJ inválido"),
});
```

(`isValidCnpj` importado de `./domain/cnpj`.)

- [ ] **Step 3: Actions** (padrão de `independence/actions.ts`): `saveOpeningLossAction` e `setAssetCnpjAction`, ambas com `.metadata({ actionName })`, `authActionClient`, `refresh()` depois de gravar; a segunda grava `{ cnpj: formatCnpj(...), cnpjSource: "MANUAL", cnpjFetchedAt: new Date() }` no ativo (função nova em `market-data/server`, `setAssetCnpj(ticker, cnpj)`), e só aceita tickers que o usuário tem ou teve (`listTradedTickersWithFirstDate`), lançando `ActionError("Ativo não encontrado na sua carteira")` caso contrário.

- [ ] **Step 4: DAL** (`tax-report-view.ts`), no padrão de `independence-view.ts`:

```ts
export const getTaxReportView = cache(
  traced(
    "view.tax-report",
    async (year: number): Promise<TaxReportView> => {
      const tenant = await getTenant();
      const [entries, dividends, openingLoss] = await Promise.all([
        getMyTransactions(),            // com priceSource: ver nota abaixo
        getMyDividends(),
        findOpeningLoss(tenant.portfolioId),
      ]);
      const tickers = [...new Set(entries.map((e) => e.ticker))];
      const [classes, identities] = await Promise.all([getAssetClasses(tickers), readAssetIdentities(tickers)]);
      const report = buildFiscalYearReport({ year, entries, dividends, assetClasses: classes, identities, openingLoss });
      return { report, years: yearsWithEntries(entries), identities: [...] };
    },
    (view) => ({ "koinos.tax.positions": view.report.positions.length, "koinos.tax.findings": view.report.findings.length }),
  ),
);
```

Nota: `getMyTransactions()` precisa devolver `priceSource` para a `PRECO_ESTIMADO`. Ler `transactions-dal.ts` e `TransactionRecord`; se `priceSource` já estiver no registro, mapear para `TaxLedgerEntry`; se não, acrescentá-lo ao DTO do DAL (campo de leitura, sem mudar quem já consome). `TaxReportView` e `yearsWithEntries` (anos de `date.getUTCFullYear()` dos lançamentos e de `paidAt`, em ordem decrescente) ficam em `tax-report/domain/types.ts` e `report.ts`.

- [ ] **Step 5: Reconciliação (script fora do repo).** Escrever em `C:\Users\HTN-PC\AppData\Local\Temp\claude\f506c6fe9f5098de\7eb51f96-a55c-43f4-8edd-cffa9a13a3bd\scratchpad\reconcile-ir.mts` um script que, com um banco de experimento, chama `getTaxReportView(2025)` e `getDividendsView` e imprime a diferença por tipo. Executar com `npx tsx --conditions=react-server --env-file=.env.local <script>` (repetir a regra: `MONGODB_URI` de `.env.local` aponta para a produção; usar nome de banco separado, só leitura).

- [ ] **Step 6: Verificar e commitar.** `npm run typecheck && npm test`.

```bash
git add src/features/tax-report src/features/market-data/server.ts
git commit -m "feat(tax-report): add the loss balance, manual CNPJ and the report view"
```

---

### Task 8: Página, menu e abas

**Goal:** A rota `/imposto-de-renda` com as cinco abas, em português, com `?ano=`.

**Files:**
- Create: `src/app/(app)/imposto-de-renda/page.tsx`, `src/features/tax-report/components/tax-report-panel.tsx`, `bens-table.tsx`, `proventos-tables.tsx`, `apuration-table.tsx`, `audit-list.tsx`, `cnpj-field.tsx`, `opening-loss-form.tsx`, `src/features/tax-report/ui.ts`
- Modify: `src/proxy.ts` (matcher), `src/shared/components/nav-items.ts` (item, grupo `registros`, ícone `FileTextIcon` ou o equivalente que o arquivo já importa), `src/shared/components/nav-items.test.ts` (o teste dos grupos)

**Acceptance Criteria:**
- [ ] `/imposto-de-renda` e `/imposto-de-renda?ano=2025` renderizam o cabeçalho estático e as seções dentro de `<Suspense>`; sem sessão, o proxy redireciona como as demais.
- [ ] A página mostra as cinco abas: Resumo e auditoria, Bens e Direitos, Rendimentos isentos, Tributação exclusiva, Vendas e apuração.
- [ ] Valores monetários, quantidades e CNPJ dentro de `Sensitive`; o aviso fixo da spec §7 aparece no rodapé.
- [ ] Ativo sem CNPJ mostra o campo para digitar (validação de dígito) e a origem (`CVM`, `MANUAL`) dos demais; `PRECO_ESTIMADO`/`POSICAO_ANTERIOR` aparecem como selos.
- [ ] O formulário de saldo inicial de prejuízo (FII e ações) está na aba Vendas e apuração.
- [ ] No celular, as tabelas viram listas (`InsetGroup`/`InsetValueRow`); sem rolagem lateral entre 360 e 1440 px; contraste AA.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test`; abrir a página com o chrome-devtools MCP em desktop e 390 px.

**Steps:**

- [ ] **Step 1: Proxy e menu.** Em `proxy.ts`, acrescentar `"/imposto-de-renda/:path*"` ao `matcher`. Em `nav-items.ts`, acrescentar ao grupo `registros`:

```ts
{
  href: "/imposto-de-renda",
  group: "registros",
  label: "Imposto de Renda",
  icon: FileTextIcon,
  tile: "[--tile:var(--tile-orange)]",
},
```

(`FileTextIcon` e o token de tile devem existir; usar os que `nav-items.ts` já importa, trocando por um existente se necessário, e ajustar `nav-items.test.ts` para o novo item.)

- [ ] **Step 2: Página** (`page.tsx`), no padrão de `independencia/page.tsx`: `metadata = { title: "Imposto de Renda" }`, `PageHeader` com título e descrição, `<Suspense fallback={<CardSkeleton height="h-96" />}>` e um componente assíncrono que lê `searchParams` (Promise, Next 16: `const { ano } = await searchParams`), valida o ano (inteiro entre 2019 e o ano corrente) e chama `getTaxReportView(year)`. Padrão do ano: o anterior até 30/04 e o corrente depois (`new Date()` só dentro do componente assíncrono, nunca no shell estático).

- [ ] **Step 3: Componentes.** Cada componente recebe só DTOs do relatório:
  - `TaxReportPanel` (cliente): `SegmentedControl` das cinco abas, estado em `nuqs` (`?aba=`), seletor de ano (`NativeSelect`, `?ano=` com `shallow: false`).
  - `AuditList`: achados por severidade (`CRITICO` em vermelho `text-loss`, `ATENCAO` em amarelo, `INFO` neutro), com o botão "Gerar textos com IA" (Task 10) e "Copiar tudo".
  - `BensTable`: colunas Ativo, Grupo/Código, 31/12 anterior, 31/12 atual, Discriminação, copiar. `CnpjField` aparece na linha do ativo sem CNPJ e como edição ("Corrigir") nas demais.
  - `ProventosTables`: dois blocos (Isentos; Exclusiva com bruto, retido e líquido) e a lista `unclassified` sob o título "Fora das fichas (confira)".
  - `ApurationTable`: mês × classe com vendido, resultado, isento, prejuízo compensado, base, imposto, saldo; abaixo, a tabela de DARF (vencimento: último dia útil do mês seguinte, calculado em `domain/` com teste) e o `OpeningLossForm`.
  - `CopyButton`: `navigator.clipboard.writeText` com estado "Copiado" por 2 s, `try/catch` (sem permissão, mostra o texto selecionável).

- [ ] **Step 4: Rodar** `npm run format && npm run lint && npm run typecheck && npm test`, abrir a página com o MCP do chrome-devtools nos dois tamanhos e corrigir o que o hook de lint e o contraste acusarem.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(tax-report): add the /imposto-de-renda page with the five tabs"
```

---

### Task 9: Textos do Gemini com validação numérica

**Goal:** Reescrita opcional da discriminação por ativo e uma narrativa por **tipo de achado** (sem números), aceitas só depois da validação do código, geradas fora da página.

> **Mudança de desenho (2026-11-16, após a validação com dados reais; spec §6):** 2025 tem 125 achados, 80 quase idênticos, então narrar um por achado não cabe numa chamada. O schema passa a ser `positions[{ ticker, text }]` (reescrita da discriminação, com validação numérica contra o modelo fixo) e `codeNarratives[{ code, text }]` (uma por `FiscalFlagCode`, explicando o que o achado significa e o que conferir, **sem nenhum número**: o texto não pode conter dígito; `acceptRewrite` para esse caso é "sem número algum"). A mensagem de cada achado (ticker, mês, valor) continua vinda do código. O texto da IA que aparece na tela passa por `moneySegments` e `Sensitive`, e o teste de vazamento do modo privado é refeito depois. O botão "Gerar textos com IA" envia dados da carteira ao Gemini e grava em produção: **só o dono o aciona**, nunca a automação de navegador.

**Files:**
- Create: `src/features/tax-report/domain/narrative.ts`, `narrative.test.ts`, `server/narrative.model.ts`, `narrative-repo.ts`, `narrative-service.ts`
- Modify: `src/features/market-data/server.ts` (exportar `generateWithChain`, `geminiModelsWithQuota` e `GEMINI_BUDGET_MS` por um ponto de entrada), `src/features/tax-report/actions.ts`, `components/audit-list.tsx` (botão)

**Acceptance Criteria:**
- [ ] `numbersIn(text)` extrai os tokens numéricos (`\d[\d.,]*`); `acceptRewrite(candidate, reference)` só aceita se todos os números de `reference` estão em `candidate` e `candidate` não tem número fora de `reference`.
- [ ] Recusa: número extra, CNPJ trocado, quantidade diferente, texto vazio, texto maior que 600 caracteres, sem acentos quando a referência tem acentos (como `parseWeekReading` faz).
- [ ] O prompt leva só ticker, classe, quantidade, custo, preço médio, CNPJ e razão social **das posições** e, para os achados, **só os códigos** distintos presentes (sem tickers nem valores). Nunca id de carteira, e-mail ou patrimônio total (teste do conteúdo do prompt).
- [ ] Uma narrativa por código de achado, sem dígito algum: `acceptCodeNarrative(text)` recusa texto com número, vazio, com mais de 300 caracteres ou sem acentos (uma regra por teste).
- [ ] `generateTaxNarrativesAction({ year })` só chama o Gemini quando a chave dos dados mudou; guarda em `tax_narratives` (carteira + ano + chave) e, sem `GEMINI_API_KEY` ou com falha, grava nada e a tela segue com os modelos fixos.
- [ ] Contadores: span `tax.narratives`, atributos `koinos.tax.accepted` e `koinos.tax.rejected`; o log traz o código da recusa, nunca o texto.

**Verify:** `npx vitest run src/features/tax-report/domain/narrative.test.ts` → passam; `npm run typecheck`.

**Steps:**

- [ ] **Step 1: Testes** (`narrative.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { acceptRewrite, buildNarrativePrompt, numbersIn } from "./narrative";

const ref =
  "200 AÇÕES DE PETRÓLEO BRASILEIRO S.A. (PETR4), CNPJ 33.000.167/0001-01. CUSTO TOTAL DE AQUISIÇÃO: R$ 2.205,00 (PREÇO MÉDIO DE R$ 11,025).";

describe("acceptRewrite", () => {
  it("aceita a mesma informação com outra redação", () => {
    const text =
      "Possuo 200 ações da Petróleo Brasileiro S.A. (PETR4), CNPJ 33.000.167/0001-01, com custo total de aquisição de R$ 2.205,00 e preço médio de R$ 11,025.";
    expect(acceptRewrite(text, ref)).toEqual({ ok: true });
  });
  it("recusa número extra, faltando ou trocado", () => {
    expect(acceptRewrite(ref + " Em 2025.", ref)).toMatchObject({ ok: false, rule: "numero-extra" });
    expect(acceptRewrite(ref.replace("2.205,00", "2.206,00"), ref)).toMatchObject({ ok: false });
    expect(acceptRewrite("200 ações de PETR4.", ref)).toMatchObject({ ok: false, rule: "numero-faltando" });
  });
  it("recusa vazio, longo demais e sem acentos", () => {
    expect(acceptRewrite("", ref)).toMatchObject({ ok: false, rule: "vazio" });
    expect(acceptRewrite(ref + " x".repeat(400), ref)).toMatchObject({ ok: false, rule: "longo" });
    expect(acceptRewrite(ref.replace("AÇÕES", "ACOES").replace("PETRÓLEO", "PETROLEO"), ref)).toMatchObject({ ok: false, rule: "sem-acento" });
  });
});

describe("buildNarrativePrompt", () => {
  it("leva só dados do ativo e dos achados", () => {
    const prompt = buildNarrativePrompt({
      year: 2025,
      positions: [{ ticker: "PETR4", reference: ref }],
      findings: [{ code: "CNPJ_AUSENTE", ticker: "XPTO11", reference: "XPTO11: sem CNPJ do emissor." }],
    });
    expect(prompt).toContain("PETR4");
    expect(prompt).toContain("<dados>");
    expect(prompt).not.toMatch(/portfolioId|@|patrim/i);
  });
});
```

- [ ] **Step 2: Implementar `narrative.ts`.** `numbersIn` com `/\d[\d.,]*/g` e normalização de pontuação final (`"11,025."` → `"11,025"`); `acceptRewrite(candidate, reference): { ok: true } | { ok: false; rule: "vazio" | "longo" | "numero-faltando" | "numero-extra" | "sem-acento" }` (regra de acento: se `reference` tem algum `[À-ú]` e `candidate` não tem nenhum, recusa); `buildNarrativePrompt` monta um texto em pt-BR com instruções ("Reescreva cada texto de referência em linguagem clara, mantendo todos os números exatamente como estão e sem acrescentar nenhum número"), dados dentro de `<dados>` e `responseJsonSchema` exportado (`narrativeSchema`: `{ positions: [{ ticker, text }], findings: [{ code, ticker, text }] }`, em `additionalProperties: false`), e `parseNarratives(json, references)` que valida com Zod e devolve só os textos aceitos, com as recusas contadas por regra. Severidade e código nunca saem do modelo.

- [ ] **Step 3: Servidor.** `narrative.model.ts`/`narrative-repo.ts` (`tax_narratives`: `portfolioId`, `year`, `key`, `positions`, `findings`, `model`, `generatedAt`; índice único `{ portfolioId, year }`). `narrative-service.ts`: `generateTaxNarratives(portfolioId, report)` calcula `key = sha256(JSON.stringify({ positions: referências, findings: referências }))`, sai cedo se igual à guardada, chama `generateWithChain(env.GEMINI_API_KEY, await geminiModelsWithQuota(now), prompt, { temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: narrativeSchema, timeoutMs: 20_000 }, now, "tax-report", Date.now() + 25_000)`, valida com `parseNarratives` e grava. Dentro de `withSpan("tax.narratives", …)`.

- [ ] **Step 4: Action e tela.** `generateTaxNarrativesAction` (`authActionClient`, input `{ year }`, `.metadata({ actionName: "generateTaxNarratives" })`, `refresh()` ao fim, `ActionError` com mensagem curta quando o Gemini está desligado). `getTaxReportView` passa a mesclar os textos aceitos: se há texto guardado e a chave atual bate, usa `narrative` no lugar de `discrimination`/`message`, mantendo o modelo fixo sempre disponível. A faixa "Os textos automáticos estão indisponíveis agora" aparece quando a última tentativa falhou.

- [ ] **Step 5: Rodar** `npx vitest run src/features/tax-report && npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(tax-report): add Gemini rewrites validated against the fixed text"
```

---

### Task 10: Exportação (copiar tudo, JSON e impressão)

**Goal:** Barra de exportação com cópia geral, JSON e impressão, completa mesmo no modo privado.

**Files:**
- Create: `src/features/tax-report/components/export-bar.tsx`, `src/features/tax-report/domain/export.ts`, `export.test.ts`, CSS de impressão em `src/app/globals.css` (bloco `@media print` focado em `[data-print-area]`)

**Acceptance Criteria:**
- [ ] `reportToJson(report)` devolve o `FiscalYearReport` serializado, sem ids internos, com `generatedAt` e o aviso fixo; `reportToCopyText(report)` junta as discriminações, os totais por ficha e a apuração em texto simples.
- [ ] O botão JSON baixa `koinos-ir-AAAA.json`; "Imprimir" abre o diálogo do navegador com só a área do relatório (menu e barras escondidos).
- [ ] Ao exportar, aparece o aviso "o arquivo contém seus valores", e o conteúdo sai completo mesmo com o modo privado ligado.
- [ ] O aviso fixo ("Estimativa do Koinos. Não é orientação fiscal…") está no JSON, no texto copiado e na impressão.

**Verify:** `npx vitest run src/features/tax-report/domain/export.test.ts`; imprimir em PDF pelo Chrome e conferir a área.

**Steps:**

- [ ] **Step 1: Testes de `export.ts`** (`reportToJson` contém o aviso e não contém `portfolioId`; `reportToCopyText` lista cada discriminação em uma linha e os totais batem com `round2`).
- [ ] **Step 2: Implementar `export.ts`** (funções puras sobre `FiscalYearReport`, aviso em constante `TAX_DISCLAIMER`).
- [ ] **Step 3: `ExportBar`** (cliente): botões "Copiar tudo", "Baixar JSON" (`Blob` + `URL.createObjectURL`) e "Imprimir" (`window.print()`); `Sensitive` não envolve o conteúdo exportado, apenas a exibição na tela.
- [ ] **Step 4: CSS de impressão** em `globals.css`: `@media print { body * { visibility: hidden } [data-print-area], [data-print-area] * { visibility: visible } [data-print-area] { position: absolute; inset: 0 } }`, com quebra de página entre as fichas.
- [ ] **Step 5: Rodar** `npm run format && npm run lint && npm run typecheck && npm test`.
- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(tax-report): add copy, JSON and print export"
```

---

### Task 11: Documentação e fechamento

**Goal:** Registrar a feature no CLAUDE.md, ajustar a spec e passar a verificação completa.

**Files:**
- Modify: `CLAUDE.md` (Commands/Tests, Architecture e Market data: a página, o cron `cnpj`, a exceção do Gemini já registrada), `docs/superpowers/specs/2026-11-16-relatorio-ir-design.md` (status e os desvios), `docs/observability/new-relic.md` (os spans novos: `view.tax-report`, `tax.narratives`, `cron.cnpj`, atributos `koinos.tax.*`, `koinos.cnpj.*`)

**Acceptance Criteria:**
- [ ] O CLAUDE.md descreve `/imposto-de-renda`, os arquivos de teste novos e a rota `/api/cron/cnpj`.
- [ ] A spec tem o status "passo 1 implementado em AAAA-MM-DD" e os desvios do plano (rota própria do cron, `PROVENTO_APOS_ENCERRAR` adiado).
- [ ] `npm run format:check`, `lint`, `typecheck`, `test` e `build` passam (o `build` precisa das variáveis de `.github/workflows/ci.yml`).

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → sem erros.

**Steps:**

- [ ] **Step 1:** Atualizar os três documentos.
- [ ] **Step 2:** Rodar a verificação completa e corrigir o que falhar.
- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs(tax-report): document the tax report step 1"
```

---

## Self-Review (feito ao escrever)

- **Cobertura da spec (passo 1):** §4 CNPJ → Tasks 5–7; §5.1 posições → Task 1; §5.2 proventos → Task 2; §5.3 retenção → Task 4 (aviso); §5.4 apuração sem day trade/IRRF → Task 3; §5.5 auditoria → Task 4; §6 Gemini → Task 9; §7 interface e exportação → Tasks 8 e 10; §8 testes → dentro de cada task; §9 pendências 3 a 5 seguem como avisos, sem bloquear.
- **Adiado para o passo 2:** day trade, IRRF, `PROVENTO_APOS_ENCERRAR` e o código de FIAGRO (a conferir).
- **Consistência de tipos:** `FiscalClass`, `AssetIdentity`, `AssetFiscalPosition`, `DividendFiscalItem`, `ApurationMonth`, `DarfMonth`, `AuditFinding`, `FiscalYearReport` e `TaxLedgerEntry` são definidos na Task 0/1 e usados com os mesmos nomes nas demais; `YearDividends` (Task 2) é o argumento `dividends` de `auditReport` (Task 4).
- **Pontos de atenção na execução:** (a) o exemplo de `offRange` da Task 2 (nota na própria task); (b) `getMyTransactions` precisa expor `priceSource` (Task 7); (c) tempo de execução da rota de CNPJ no cron-job.org (Task 6); (d) exportar `generateWithChain` de `market-data` (Task 9).
