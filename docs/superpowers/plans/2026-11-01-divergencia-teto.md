# Aviso de divergência do teto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar um triângulo de aviso, só informativo, nos FIIs da estratégia cujo teto do ranking difere em mais de 10% do teto calculado pela taxa real da NTN-B, na Carteira Alvo e nas ordens das Recomendações.

**Architecture:** Uma função pura em `strategy/domain/ceiling.ts` calcula o teto (proventos de 12 meses ÷ rendimento exigido) e devolve um `CeilingCheck` só quando há divergência. O snapshot recebe a taxa (mediana de 60 pregões, em fração) e põe o campo nas linhas dos FIIs da estratégia, sem tocar na cascata. Um componente `CeilingCheckIcon` desenha o triângulo nas duas telas. Spec: `docs/superpowers/specs/2026-11-01-divergencia-teto-design.md`.

**Tech Stack:** TypeScript, Vitest, React (Base UI `Tooltip`), Next 16.

---

## Antes de começar

- **Branch:** o trabalho continua no branch `feat/divergencia-teto` (a spec já está commitada nele). Não crie outro.
- **Atribuição dos commits:** todo commit termina com as duas linhas abaixo (nos comandos deste plano, dentro do heredoc):

  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
  ```

- **Banco:** o `MONGODB_URI` do `.env.local` é o de **produção**. Nenhuma tarefa precisa dele; nenhuma deve executar o serviço, o cron nem escrever no banco.
- **Convenções:** `domain/` é TypeScript puro; imports entre features só por `index.ts`/`ui.ts`; comentários e textos em português; commits em inglês.
- **Unidades:** a função de teto recebe e devolve **frações** (7,675% entra como `0.07675`). O valor da DAL vem em % (`getRealRate().median`) e é dividido por 100 uma única vez, em `portfolio/server/snapshot.ts`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/features/strategy/domain/ceiling.ts` (editar) | `CEILING_CHECK`, `CeilingCheck`, `ceilingCheck`, `ceilingCheckMessage` |
| `src/features/strategy/domain/ceiling.test.ts` (novo) | Testes da regra e da mensagem |
| `src/features/strategy/index.ts` (editar) | exports puros |
| `src/features/portfolio/domain/types.ts` (editar) | `StrategyRow.ceilingCheck` |
| `src/features/portfolio/domain/snapshot.ts` (editar) | entrada `ntnbRealRate` e o campo nas linhas |
| `src/features/portfolio/domain/snapshot.test.ts`, `alerts.test.ts` (editar) | testes do snapshot e fixtures |
| `src/features/portfolio/server/snapshot.ts` (editar) | lê a taxa e passa ao snapshot, com a falha isolada |
| `src/features/strategy/components/ceiling-check-icon.tsx` (novo), `ui.ts` (editar) | o triângulo |
| `src/features/strategy/components/table/read-only-cells.tsx` (editar) | Carteira Alvo |
| `src/features/smart-buy/components/aporte/orders.tsx` (editar), `src/app/(app)/recomendacoes/page.tsx` (editar) | Recomendações |
| `CLAUDE.md`, `.claude/skills/conselho-investidores/references/formulas.md`, a spec (editar) | documentação |

---

### Task 1: A regra pura do teto calculado, com testes

**Goal:** `ceilingCheck` e `ceilingCheckMessage`, cobertas por testes.

**Files:**
- Modify: `src/features/strategy/domain/ceiling.ts`
- Create: `src/features/strategy/domain/ceiling.test.ts`
- Modify: `src/features/strategy/index.ts`

**Acceptance Criteria:**
- [ ] Tijolo: teto calculado = renda ÷ (NTN-B + 1,0 p.p.). Papel: renda ÷ (NTN-B + 4,0% + 1,0 p.p.).
- [ ] Devolve `CeilingCheck` só quando |calculado ÷ teto do ranking − 1| passa de 10%; exatamente 10% (nos dois lados) não avisa.
- [ ] Devolve `null` sem teto, sem renda (nula, zero, negativa ou não finita) e sem taxa.
- [ ] `ceilingCheckMessage` cita o teto do ranking, o calculado, a divergência, a taxa e o spread (e o IPCA no papel).

**Verify:** `npx vitest run src/features/strategy/domain/ceiling.test.ts` → todos passam

**Steps:**

- [ ] **Step 1: Escrever os testes (falham: as funções não existem)**

Criar `src/features/strategy/domain/ceiling.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";
import { CEILING_CHECK, ceilingCheck, ceilingCheckMessage } from "./ceiling";

// NTN-B real de 7%: o tijolo exige 8% (7% + 1 p.p.) e o papel 12% (7% + 4% de IPCA + 1 p.p.).
const base = { ceiling: 100, income12m: 12, paper: false, ntnbRealRate: 0.07 } as const;

describe("ceilingCheck: a fórmula", () => {
  it("tijolo: renda ÷ (NTN-B + spread)", () => {
    // 12 ÷ 0,08 = 150, contra um teto de 100: +50%.
    const check = ceilingCheck(base);
    expect(check).not.toBeNull();
    expect(check?.calculated).toBeCloseTo(150, 6);
    expect(check?.divergence).toBeCloseTo(0.5, 6);
    expect(check?.requiredYield).toBeCloseTo(0.08, 10);
    expect(check?.ntnbRealRate).toBe(0.07);
    expect(check?.paper).toBe(false);
  });

  it("papel: soma o IPCA assumido ao rendimento exigido", () => {
    // 9,6 ÷ 0,12 = 80, contra um teto de 100: −20%.
    const check = ceilingCheck({ ...base, income12m: 9.6, paper: true });
    expect(check?.calculated).toBeCloseTo(80, 6);
    expect(check?.divergence).toBeCloseTo(-0.2, 6);
    expect(check?.requiredYield).toBeCloseTo(0.12, 10);
    expect(check?.paper).toBe(true);
  });

  it("os parâmetros são os aprovados pelo dono", () => {
    expect(CEILING_CHECK).toEqual({
      tijoloSpread: 0.01,
      paperSpread: 0.01,
      assumedInflation: 0.04,
      limit: 0.1,
    });
  });
});

describe("ceilingCheck: o limite de 10%", () => {
  // Tijolo, NTN-B 7%: calculado = renda ÷ 0,08. Com teto 100, renda 8,8 dá calculado 110.
  const at = (income12m: number) => ceilingCheck({ ...base, income12m });

  it("exatamente 10% não avisa, nos dois lados", () => {
    expect(at(8.8)).toBeNull(); // +10%
    expect(at(7.2)).toBeNull(); // −10%
  });

  it("acima de 10% avisa, nos dois lados", () => {
    expect(at(8.808)?.divergence).toBeCloseTo(0.101, 6); // +10,1%
    expect(at(7.192)?.divergence).toBeCloseTo(-0.101, 6); // −10,1%
  });

  it("abaixo de 10% não avisa", () => {
    expect(at(8.0)).toBeNull(); // calculado 100: 0%
    expect(at(8.72)).toBeNull(); // +9%
  });
});

describe("ceilingCheck: sem dado, sem aviso", () => {
  it.each([
    ["sem teto do ranking", { ceiling: null }],
    ["teto do ranking zero", { ceiling: 0 }],
    ["sem proventos de 12 meses", { income12m: null }],
    ["proventos zerados", { income12m: 0 }],
    ["proventos negativos", { income12m: -1 }],
    ["proventos não finitos", { income12m: Number.NaN }],
    ["sem taxa da NTN-B", { ntnbRealRate: null }],
    ["taxa não finita", { ntnbRealRate: Number.POSITIVE_INFINITY }],
  ])("%s", (_name, patch) => {
    expect(ceilingCheck({ ...base, ...patch })).toBeNull();
  });
});

describe("ceilingCheckMessage", () => {
  it("tijolo: cita o teto do ranking, o calculado, a divergência, a taxa e o spread", () => {
    const check = ceilingCheck(base)!;
    const message = ceilingCheckMessage(check, 100);
    expect(message).toContain(`Teto do ranking ${formatBRL(100)}`);
    expect(message).toContain(`calculado ${formatBRL(check.calculated)}`);
    expect(message).toContain(formatSignedPercent(check.divergence, 0));
    expect(message).toContain(`NTN-B ${formatPercent(0.07, 2)}`);
    expect(message).toContain("1,0 p.p.");
    expect(message).not.toContain("IPCA");
    expect(message).toContain("Confira o teto.");
  });

  it("papel: cita também o IPCA assumido", () => {
    const check = ceilingCheck({ ...base, income12m: 9.6, paper: true })!;
    const message = ceilingCheckMessage(check, 100);
    expect(message).toContain(`NTN-B ${formatPercent(0.07, 2)}`);
    expect(message).toContain(`IPCA ${formatPercent(0.04, 1)}`);
    expect(message).toContain("1,0 p.p.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/strategy/domain/ceiling.test.ts`
Expected: FAIL (`ceilingCheck is not a function` ou erro de import).

- [ ] **Step 3: Implementar**

Em `src/features/strategy/domain/ceiling.ts`, acrescentar no topo o import e, no fim do arquivo, o código novo (as duas funções que já existem ficam como estão):

```ts
import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";
```

```ts
/**
 * Parâmetros do aviso de divergência do teto (spec 2026-11-01-divergencia-teto-design.md). São
 * constantes do código, sem tela: mudar um valor é uma decisão do dono e uma alteração aqui.
 * Tudo em fração (0,01 = 1 p.p.).
 */
export const CEILING_CHECK = {
  /** Tijolo (e as demais classes): NTN-B real + este spread. O aluguel acompanha a inflação. */
  tijoloSpread: 0.01,
  /** Papel: NTN-B real + IPCA assumido + este spread. O DY do papel já traz a inflação. */
  paperSpread: 0.01,
  assumedInflation: 0.04,
  /** Há aviso quando |teto calculado ÷ teto do ranking − 1| passa disto. */
  limit: 0.1,
} as const;

/** O teto calculado de um FII cujo teto do ranking está fora do limite. Frações, exceto os preços. */
export type CeilingCheck = {
  /** Teto calculado, em R$ por cota. */
  calculated: number;
  /** calculado ÷ teto do ranking − 1, com 6 casas. Positivo: o teto do ranking está abaixo do calculado. */
  divergence: number;
  /** Rendimento exigido que dividiu a renda. */
  requiredYield: number;
  /** NTN-B real usada (a mediana de 60 pregões). */
  ntnbRealRate: number;
  /** Papel (soma o IPCA assumido) ou tijolo e demais classes. */
  paper: boolean;
};

export type CeilingCheckInput = {
  /** Teto do ranking. */
  ceiling: number | null;
  /** Proventos por cota dos 12 meses; null quando não há ou estão velhos. */
  income12m: number | null;
  paper: boolean;
  /** NTN-B real, em fração (7,675% = 0,07675); null sem dado ou com dado velho. */
  ntnbRealRate: number | null;
};

/**
 * Compara o teto do ranking com o teto calculado: proventos de 12 meses ÷ rendimento exigido. Devolve
 * o cálculo só quando a divergência passa do limite, nos dois lados; sem dado, null (sem aviso).
 */
export function ceilingCheck({
  ceiling,
  income12m,
  paper,
  ntnbRealRate,
}: CeilingCheckInput): CeilingCheck | null {
  if (ceiling === null || !Number.isFinite(ceiling) || ceiling <= 0) return null;
  if (income12m === null || !Number.isFinite(income12m) || income12m <= 0) return null;
  if (ntnbRealRate === null || !Number.isFinite(ntnbRealRate)) return null;
  const requiredYield =
    ntnbRealRate +
    (paper ? CEILING_CHECK.paperSpread + CEILING_CHECK.assumedInflation : CEILING_CHECK.tijoloSpread);
  if (!(requiredYield > 0)) return null;
  const calculated = income12m / requiredYield;
  // 6 casas: o ponto flutuante não pode empurrar um 10% exato para 10,000000000000002%.
  const divergence = Math.round((calculated / ceiling - 1) * 1_000_000) / 1_000_000;
  if (Math.abs(divergence) <= CEILING_CHECK.limit) return null;
  return { calculated, divergence, requiredYield, ntnbRealRate, paper };
}

/** "1,0 p.p." a partir de uma fração. */
const pointsOf = (fraction: number) => `${(fraction * 100).toFixed(1).replace(".", ",")} p.p.`;

/** O texto do aviso (tooltip e folha do celular). `ceiling` é o teto do ranking. */
export function ceilingCheckMessage(check: CeilingCheck, ceiling: number): string {
  const rate = `NTN-B ${formatPercent(check.ntnbRealRate, 2)}`;
  const premium = check.paper
    ? `${rate} + IPCA ${formatPercent(CEILING_CHECK.assumedInflation, 1)} + ${pointsOf(CEILING_CHECK.paperSpread)}`
    : `${rate} + ${pointsOf(CEILING_CHECK.tijoloSpread)}`;
  return (
    `Teto do ranking ${formatBRL(ceiling)}; calculado ${formatBRL(check.calculated)} ` +
    `(${formatSignedPercent(check.divergence, 0)}). ` +
    `Proventos de 12 meses ÷ (${premium}). Confira o teto.`
  );
}
```

Em `src/features/strategy/index.ts`, trocar a linha `export { isSuspiciousCeiling, marginToCeiling } from "./domain/ceiling";` por:

```ts
export {
  CEILING_CHECK,
  ceilingCheck,
  ceilingCheckMessage,
  isSuspiciousCeiling,
  marginToCeiling,
  type CeilingCheck,
  type CeilingCheckInput,
} from "./domain/ceiling";
```

- [ ] **Step 4: Formatar, rodar e ver passar**

```bash
npx prettier --write src/features/strategy/domain/ceiling.ts src/features/strategy/domain/ceiling.test.ts src/features/strategy/index.ts
npx vitest run src/features/strategy/domain/ceiling.test.ts
npm run lint 2>&1 | tail -2
npm run typecheck 2>&1 | tail -2
```

Expected: PASS; sem erros de lint nem de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/features/strategy/domain/ceiling.ts src/features/strategy/domain/ceiling.test.ts src/features/strategy/index.ts docs/superpowers/plans/2026-11-01-divergencia-teto.md docs/superpowers/plans/2026-11-01-divergencia-teto.md.tasks.json
git commit -q -F - <<'EOF'
feat(strategy): add the ranking ceiling divergence rule

ceilingCheck compares the ranking ceiling with 12-month income divided by the
NTN-B real rate plus a spread (plus an assumed IPCA for paper funds) and
returns a result only when they differ by more than 10%, in either direction.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
EOF
```

---

### Task 2: O snapshot leva o aviso às linhas, com testes

**Goal:** `buildSnapshot` aceita a taxa e põe `ceilingCheck` nas linhas dos FIIs da estratégia, sem mudar a cascata.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Test: `src/features/portfolio/domain/snapshot.test.ts`
- Modify (fixtures): `src/features/portfolio/domain/alerts.test.ts`

**Acceptance Criteria:**
- [ ] `SnapshotInput.ntnbRealRate` (fração, opcional, padrão null) e `StrategyRow.ceilingCheck: CeilingCheck | null`.
- [ ] Só FIIs da estratégia, com cotação do teto, proventos de 12 meses buscados há até 10 dias e taxa, recebem o campo; papel usa a macro `Papel`, o resto usa a fórmula de tijolo ("Outros" inclusive).
- [ ] FII fora da estratégia, sem taxa ou com proventos velhos: `ceilingCheck` null.
- [ ] `cascadeInput` e as Prioridades são idênticos com e sem a taxa.

**Verify:** `npx vitest run src/features/portfolio` e `npm run typecheck` → passam

**Steps:**

- [ ] **Step 1: Escrever os testes (falham)**

Acrescentar ao fim de `src/features/portfolio/domain/snapshot.test.ts`:

```ts
describe("buildSnapshot: aviso de divergência do teto (spec divergencia-teto)", () => {
  const now = new Date(Date.UTC(2026, 10, 1));
  const fresh = new Date(Date.UTC(2026, 9, 30)); // 2 dias antes de `now`
  const stale = new Date(Date.UTC(2026, 9, 10)); // 22 dias antes: passa dos 10 dias

  const priced = (overrides: Partial<PriceInfo> = {}): PriceInfo => ({
    ...quote,
    price: 100,
    dividends12m: 8,
    dividendsFetchedAt: fresh,
    ...overrides,
  });
  const paperFii: PriceInfo["fii"] = {
    vacancyPct: null,
    segment: null,
    fundType: "Papel",
    paperPct: null,
    realEstatePct: null,
  };

  /**
   * AAAA11 e BBBB11 sem perfil (macro "Outros", tratada como tijolo), PPPP11 de papel e QQQQ11 fora
   * da estratégia. Com NTN-B 7%: tijolo exige 8% (renda 8 → calculado 100) e papel 12% (→ 66,67).
   */
  function withCeilings(
    ntnbRealRate: number | null | undefined,
    prices: Record<string, PriceInfo> = {},
  ): SnapshotInput {
    const ceilingOf = (ticker: string, inStrategy: boolean, ceilingPrice: number, rank: number) => ({
      ...target(ticker, inStrategy, inStrategy ? 25 : null, inStrategy ? rank : null),
      ceilingPrice,
    });
    return {
      now,
      transactions: [buy("AAAA11", 10), buy("BBBB11", 10), buy("PPPP11", 10), buy("QQQQ11", 10)],
      targets: [
        ceilingOf("AAAA11", true, 120, 1), // calculado 100 contra 120: −16,7%
        ceilingOf("BBBB11", true, 100, 2), // calculado 100 contra 100: 0%
        ceilingOf("PPPP11", true, 100, 3), // calculado 66,67 contra 100: −33,3%
        ceilingOf("QQQQ11", false, 120, 4), // fora da estratégia
      ],
      dividends: [],
      prices: new Map([
        ["AAAA11", prices.AAAA11 ?? priced()],
        ["BBBB11", prices.BBBB11 ?? priced()],
        ["PPPP11", prices.PPPP11 ?? priced({ fii: paperFii })],
        ["QQQQ11", prices.QQQQ11 ?? priced()],
      ]),
      classes: new Map(),
      ntnbRealRate,
    };
  }

  const checkOf = (snapshot: ReturnType<typeof buildSnapshot>, ticker: string) =>
    snapshot.strategy.rows.find((row) => row.ticker === ticker)?.ceilingCheck;

  it("avisa tijolo e papel pela fórmula de cada um, e não avisa quem está dentro do limite", () => {
    const snapshot = buildSnapshot(withCeilings(0.07));
    const tijolo = checkOf(snapshot, "AAAA11");
    expect(tijolo?.calculated).toBeCloseTo(100, 6);
    expect(tijolo?.divergence).toBeCloseTo(-1 / 6, 5);
    expect(tijolo?.paper).toBe(false);
    expect(checkOf(snapshot, "BBBB11")).toBeNull();
    const papel = checkOf(snapshot, "PPPP11");
    expect(papel?.calculated).toBeCloseTo(8 / 0.12, 6);
    expect(papel?.paper).toBe(true);
  });

  it("FII fora da estratégia não recebe o aviso", () => {
    expect(checkOf(buildSnapshot(withCeilings(0.07)), "QQQQ11")).toBeNull();
  });

  it.each([
    ["sem taxa (null)", null],
    ["sem taxa (ausente)", undefined],
  ])("%s: nenhuma linha recebe o aviso", (_name, rate) => {
    const snapshot = buildSnapshot(withCeilings(rate));
    expect(snapshot.strategy.rows.every((row) => row.ceilingCheck === null)).toBe(true);
  });

  it("proventos buscados há mais de 10 dias: sem aviso naquele FII", () => {
    const snapshot = buildSnapshot(
      withCeilings(0.07, { AAAA11: priced({ dividendsFetchedAt: stale }) }),
    );
    expect(checkOf(snapshot, "AAAA11")).toBeNull();
    expect(checkOf(snapshot, "PPPP11")).not.toBeNull();
  });

  it("proventos nunca buscados ou de 12 meses ausentes: sem aviso", () => {
    const snapshot = buildSnapshot(
      withCeilings(0.07, {
        AAAA11: priced({ dividendsFetchedAt: null }),
        PPPP11: priced({ dividends12m: null, fii: paperFii }),
      }),
    );
    expect(checkOf(snapshot, "AAAA11")).toBeNull();
    expect(checkOf(snapshot, "PPPP11")).toBeNull();
  });

  it("a cascata e as Prioridades são idênticas com e sem a taxa", () => {
    const withRate = buildSnapshot(withCeilings(0.07));
    const without = buildSnapshot(withCeilings(null));
    expect(withRate.cascadeInput).toEqual(without.cascadeInput);
    expect(withRate.strategy.rows.map((row) => [row.ticker, row.priority])).toEqual(
      without.strategy.rows.map((row) => [row.ticker, row.priority]),
    );
    expect(fiiCascade(1_000, withRate.cascadeInput).orders).toEqual(
      fiiCascade(1_000, without.cascadeInput).orders,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/portfolio/domain/snapshot.test.ts`
Expected: FAIL (`ntnbRealRate` não existe em `SnapshotInput`; o campo `ceilingCheck` não existe).

- [ ] **Step 3: O tipo da linha**

Em `src/features/portfolio/domain/types.ts`:

1. Na linha `import type { Bias, Category } from "@/features/strategy";`, trocar por `import type { Bias, Category, CeilingCheck } from "@/features/strategy";`.
2. No tipo `StrategyRow` (o que tem `held: boolean;`), logo depois de `suspiciousCeiling: boolean;`, acrescentar:

```ts
  /** O teto do ranking está a mais de 10% do calculado pela NTN-B (spec divergencia-teto). Só informativo. */
  ceilingCheck: CeilingCheck | null;
```

(o `PositionRow`, que também tem `suspiciousCeiling`, **não** muda.)

- [ ] **Step 4: O snapshot**

Em `src/features/portfolio/domain/snapshot.ts`:

1. No import de `@/features/strategy` (linhas 11 a 16), acrescentar `ceilingCheck,` e `type CeilingCheck,` à lista (em ordem alfabética, depois de `effectiveWeights` fica `ceilingCheck` antes dele; o Prettier reorganiza se precisar).
2. Em `SnapshotInput`, depois de `view?: ClassFilter;`, acrescentar:

```ts
  /**
   * NTN-B real em fração (mediana de 60 pregões; 7,675% = 0,07675), só informativa: alimenta o aviso
   * de divergência do teto (spec divergencia-teto). Null ou ausente: sem aviso. Não entra na cascata.
   */
  ntnbRealRate?: number | null;
```

3. Na assinatura de `buildSnapshot`, acrescentar `ntnbRealRate = null,` depois de `view = "TODOS",`.
4. Antes de `const toCascadeAsset = (`, acrescentar o helper do frescor (a mesma regra que já existe inline):

```ts
  // Os proventos só valem quando a busca é recente (spec koinos-3-1, §4.2).
  const isDividendsFresh = (info: PriceInfo | undefined) =>
    info?.dividendsFetchedAt != null &&
    now.getTime() - info.dividendsFetchedAt.getTime() <= DIVIDENDS_FRESH_DAYS * DAY_MS;
```

5. Dentro de `toCascadeAsset`, trocar o bloco

```ts
    const dividendsFresh =
      info?.dividendsFetchedAt != null &&
      now.getTime() - info.dividendsFetchedAt.getTime() <= DIVIDENDS_FRESH_DAYS * DAY_MS;
```

por `const dividendsFresh = isDividendsFresh(info);`.
6. Logo depois de `const cascadeInput = strategies.FII.members.map(...)` (o bloco de 3 linhas), acrescentar:

```ts
  // Aviso de divergência do teto: só FIIs da estratégia (têm a macro calculada), com proventos
  // recentes e a taxa da NTN-B. Papel soma o IPCA assumido; as demais classes, não. Só informativo.
  const cascadeByTicker = new Map(cascadeInput.map((asset) => [asset.ticker, asset]));
  const ceilingCheckOf = (ticker: string, ceiling: number | null): CeilingCheck | null => {
    const asset = cascadeByTicker.get(ticker);
    if (!asset) return null;
    return ceilingCheck({
      ceiling,
      income12m: isDividendsFresh(prices.get(ticker)) ? asset.dividends12m : null,
      paper: asset.macro === "Papel",
      ntnbRealRate,
    });
  };
```

7. Em `rowsOf`, depois de `suspiciousCeiling: isSuspiciousCeiling(target?.ceilingPrice ?? null, price),` (o do objeto da linha da Carteira Alvo, perto da linha 320), acrescentar:

```ts
          ceilingCheck: cls === "FII" && inStrategy ? ceilingCheckOf(ticker, target?.ceilingPrice ?? null) : null,
```

- [ ] **Step 5: Corrigir os fixtures que montam `StrategyRow` à mão**

Rodar `npm run typecheck`. O arquivo `src/features/portfolio/domain/alerts.test.ts` (e qualquer outro apontado) constrói linhas com `suspiciousCeiling`; acrescentar `ceilingCheck: null,` logo depois de cada `suspiciousCeiling: ...,` **de um `StrategyRow`** (não de um `PositionRow`). Repetir até o typecheck passar.

- [ ] **Step 6: Formatar, rodar e ver passar**

```bash
npx prettier --write src/features/portfolio
npx vitest run src/features/portfolio
npm run lint 2>&1 | tail -2
npm run typecheck 2>&1 | tail -2
npm test 2>&1 | rg "Tests |Test Files"
```

Expected: tudo passa.

- [ ] **Step 7: Commit**

```bash
git add src/features/portfolio
git commit -q -F - <<'EOF'
feat(portfolio): carry the ceiling divergence to the strategy rows

buildSnapshot takes the NTN-B real rate and sets ceilingCheck on the rows of
FIIs in the strategy. The cascade input and the priorities are unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
EOF
```

---

### Task 3: A DAL lê a taxa e passa ao snapshot

**Goal:** `getPortfolioSnapshot` alimenta o snapshot com a mediana de 60 pregões, e uma falha ao lê-la nunca derruba a página.

**Files:**
- Modify: `src/features/portfolio/server/snapshot.ts`

**Acceptance Criteria:**
- [ ] A taxa vem de `getRealRate` (`@/features/market-data/server`); `median ÷ 100` quando há resumo e ele não é velho; senão `null`.
- [ ] Uma exceção ao ler a taxa é registrada com `console.warn` e vira `null`.
- [ ] `npm run typecheck`, `lint` e `test` passam.

**Verify:** `npm run typecheck && npm run lint && npm test` → sem erros

**Steps:**

- [ ] **Step 1: Editar `src/features/portfolio/server/snapshot.ts`**

1. No import de `@/features/market-data/server`, acrescentar `getRealRate,` à lista (depois de `getMonthlyCloses,`).
2. Antes de `const snapshotFor = cache(`, acrescentar:

```ts
/**
 * A NTN-B real em fração (a mediana de 60 pregões), para o aviso de divergência do teto. Dado
 * velho ou ausente vira null, e uma falha na leitura também: o aviso é só informativo e não pode
 * derrubar a página.
 */
async function readNtnbRealRate(now: Date): Promise<number | null> {
  try {
    const summary = await getRealRate(now);
    return summary && !summary.stale ? summary.median / 100 : null;
  } catch (error) {
    console.warn("[taxa NTN-B]", error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

3. No corpo de `snapshotFor`, trocar o bloco final

```ts
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
```

por:

```ts
      const now = new Date();
      return buildSnapshot(
        scopeToClass(
          {
            now,
            transactions,
            targets,
            dividends,
            prices: toPriceInfo(assets),
            classes,
            ntnbRealRate: await readNtnbRealRate(now),
          },
          filter,
        ),
      );
```

(`scopeToClass` já repassa o resto da entrada com `...input`, então `ntnbRealRate` chega ao `buildSnapshot`.)

- [ ] **Step 2: Verificar**

```bash
npx prettier --write src/features/portfolio/server/snapshot.ts
npm run typecheck 2>&1 | tail -2
npm run lint 2>&1 | tail -2
npm test 2>&1 | rg "Tests |Test Files"
```

Expected: sem erros. Não execute a página nem o serviço (o `.env.local` aponta para produção).

- [ ] **Step 3: Commit**

```bash
git add src/features/portfolio/server/snapshot.ts
git commit -q -F - <<'EOF'
feat(portfolio): feed the NTN-B rate to the snapshot

getPortfolioSnapshot reads the 60-trading-day median from getRealRate. A stale
or missing rate, or a failed read, means no warning and never breaks the page.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
EOF
```

---

### Task 4: O triângulo na Carteira Alvo e nas Recomendações

**Goal:** O ícone de aviso, com a mensagem, nas duas telas.

**Files:**
- Create: `src/features/strategy/components/ceiling-check-icon.tsx`
- Modify: `src/features/strategy/ui.ts`
- Modify: `src/features/strategy/components/table/read-only-cells.tsx`
- Modify: `src/features/smart-buy/components/aporte/orders.tsx`
- Modify: `src/app/(app)/recomendacoes/page.tsx`

**Acceptance Criteria:**
- [ ] Carteira Alvo (tabela e lista do celular, que usam `MarginValue`): triângulo âmbar ao lado do "Teto suspeito", com tooltip, e `aria-label` "Teto diverge do calculado".
- [ ] Recomendações, tabela: triângulo com tooltip ao lado do ativo da ordem; celular: ícone sem tooltip na linha e o texto numa seção "Aviso" da folha da ordem.
- [ ] O aviso só aparece onde há `ceilingCheck`; a lista "Fora deste aporte" não muda.
- [ ] `typecheck`, `lint`, `test` e `build` passam.

**Verify:** `npm run typecheck && npm run lint && npm test && npm run build` → sem erros

**Steps:**

- [ ] **Step 1: O componente**

Criar `src/features/strategy/components/ceiling-check-icon.tsx`:

```tsx
"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ceilingCheckMessage, type CeilingCheck } from "../domain/ceiling";

const LABEL = "Teto diverge do calculado";

/**
 * Triângulo âmbar: o teto do ranking está a mais de 10% do calculado pela NTN-B (spec
 * divergencia-teto, §4). Com `tooltip={false}` vira só o ícone, para dentro de um botão (a linha
 * do celular), onde o texto sai numa folha.
 */
export function CeilingCheckIcon({
  check,
  ceiling,
  tooltip = true,
}: {
  check: CeilingCheck;
  /** O teto do ranking. */
  ceiling: number;
  tooltip?: boolean;
}) {
  const icon = <TriangleAlertIcon className="size-3.5 text-warn" aria-label={LABEL} />;
  if (!tooltip) return icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="relative inline-flex pointer-coarse:after:absolute pointer-coarse:after:-inset-3" />}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{ceilingCheckMessage(check, ceiling)}</TooltipContent>
    </Tooltip>
  );
}
```

Em `src/features/strategy/ui.ts`, acrescentar no fim:

```ts
export { CeilingCheckIcon } from "./components/ceiling-check-icon";
```

- [ ] **Step 2: Carteira Alvo**

Em `src/features/strategy/components/table/read-only-cells.tsx`:

1. Acrescentar o import `import { CeilingCheckIcon } from "../ceiling-check-icon";`.
2. Em `MarginValue`, logo depois do bloco `{row.suspiciousCeiling ? (...) : null}`, acrescentar:

```tsx
      {row.ceilingCheck && row.ceilingPrice !== null ? (
        <CeilingCheckIcon check={row.ceilingCheck} ceiling={row.ceilingPrice} />
      ) : null}
```

e atualizar o comentário da função para: `/** Margem até o teto, com os avisos de teto suspeito e de teto divergente do calculado (âmbar, com ícone e rótulo). */`.

- [ ] **Step 3: Recomendações: o tipo do meta e a página**

Em `src/features/smart-buy/components/aporte/orders.tsx`:

1. Acrescentar os imports:

```tsx
import { ceilingCheckMessage, type CeilingCheck } from "@/features/strategy";
import { CeilingCheckIcon } from "@/features/strategy/ui";
```

2. Trocar o tipo `AssetMeta` por:

```tsx
export type AssetMeta = {
  ticker: string;
  name: string | null;
  logoUrl: string | null;
  /** O teto do ranking está a mais de 10% do calculado pela NTN-B; só informativo (spec divergencia-teto). */
  ceilingWarning?: { check: CeilingCheck; ceiling: number };
};
```

3. Em `OrdersTable`, na célula do ativo, trocar `<AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />` (a primeira ocorrência, dentro do `div` com `justify-between`) por:

```tsx
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetLabel ticker={order.ticker} name={info?.name} logoUrl={info?.logoUrl} />
                    {info?.ceilingWarning ? (
                      <CeilingCheckIcon
                        check={info.ceilingWarning.check}
                        ceiling={info.ceilingWarning.ceiling}
                      />
                    ) : null}
                  </div>
```

4. Em `OrdersList`, dentro do `div` `flex min-w-0 items-center gap-2`, logo depois do `AssetLabel` (e antes do `ClassBadge`), acrescentar:

```tsx
                      {info?.ceilingWarning ? (
                        <CeilingCheckIcon
                          check={info.ceilingWarning.check}
                          ceiling={info.ceilingWarning.ceiling}
                          tooltip={false}
                        />
                      ) : null}
```

5. Em `OrderSheetFrame`, logo depois de `<InsetGroup title="Por quê">{children}</InsetGroup>`, acrescentar:

```tsx
        {info?.ceilingWarning ? (
          <InsetGroup title="Aviso">
            <ReasonRow>
              {ceilingCheckMessage(info.ceilingWarning.check, info.ceilingWarning.ceiling)}
            </ReasonRow>
          </InsetGroup>
        ) : null}
```

Em `src/app/(app)/recomendacoes/page.tsx`, trocar o laço que monta o `meta`:

```tsx
  const meta = new Map<string, AssetMeta>();
  for (const row of [...strategy.rows, ...stockMeta, ...positions]) {
    if (!meta.has(row.ticker)) {
      meta.set(row.ticker, { ticker: row.ticker, name: row.name, logoUrl: row.logoUrl });
    }
  }
```

por:

```tsx
  const meta = new Map<string, AssetMeta>();
  // As linhas da estratégia primeiro: só elas trazem o aviso de divergência do teto.
  for (const row of strategy.rows) {
    meta.set(row.ticker, {
      ticker: row.ticker,
      name: row.name,
      logoUrl: row.logoUrl,
      ...(row.ceilingCheck && row.ceilingPrice !== null
        ? { ceilingWarning: { check: row.ceilingCheck, ceiling: row.ceilingPrice } }
        : {}),
    });
  }
  for (const row of [...stockMeta, ...positions]) {
    if (!meta.has(row.ticker)) {
      meta.set(row.ticker, { ticker: row.ticker, name: row.name, logoUrl: row.logoUrl });
    }
  }
```

- [ ] **Step 4: Verificar**

```bash
npx prettier --write src/features/strategy src/features/smart-buy src/app
npm run typecheck 2>&1 | tail -2
npm run lint 2>&1 | tail -3
npm test 2>&1 | rg "Tests |Test Files"
```

Se o lint reclamar de import entre features (`smart-buy` importando `strategy`), os caminhos usados (`@/features/strategy` e `@/features/strategy/ui`) são os públicos; confira o `eslint.config.mjs` e diga o que viu em vez de contornar. Depois rode o build (leva minutos): `npm run build 2>&1 | tail -4` (com `timeout` de 600000 ms).

- [ ] **Step 5: Commit**

```bash
git add src/features/strategy src/features/smart-buy "src/app/(app)/recomendacoes/page.tsx"
git commit -q -F - <<'EOF'
feat(ui): show the ceiling divergence warning

An amber triangle with the explanation next to the margin on the Carteira Alvo
and next to the asset on the Recomendações orders (table tooltip; on phones, an
icon on the row and the text in the order sheet). Informational only.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
EOF
```

---

### Task 5: Documentação e verificação final

**Goal:** CLAUDE.md, o mapa de fórmulas e a spec refletem o que foi construído; todas as checagens passam.

**Files:**
- Modify: `CLAUDE.md`, `.claude/skills/conselho-investidores/references/formulas.md`, `docs/superpowers/specs/2026-11-01-divergencia-teto-design.md`

**Acceptance Criteria:**
- [ ] O CLAUDE.md descreve o aviso (regra, parâmetros, onde aparece, só informativo) e lista os testes novos.
- [ ] `formulas.md` registra o teto calculado na seção do teto e em "Parece erro, mas é projeto".
- [ ] A spec diz que o aviso chega às Recomendações pelo `AssetMeta`, e o estado dela é "implementada".
- [ ] `format:check`, `lint`, `typecheck`, `test` e `build` passam.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → sem erros

**Steps:**

- [ ] **Step 1: CLAUDE.md** (em inglês)

Na seção **Domain flow**, depois do item 8, acrescentar o item:

```md
9. **Ceiling divergence warning** (`strategy/domain/ceiling.ts`, spec `2026-11-01-divergencia-teto-design.md`): `ceilingCheck` compares the ranking ceiling with the 12-month income per share divided by the required yield, the NTN-B real rate (the 60-trading-day median from `getRealRate`) plus 1.0 p.p. for tijolo and the other classes, or plus an assumed IPCA of 4.0% and 1.0 p.p. for paper (the paper DY already carries inflation). It returns a `CeilingCheck` only when |calculated ÷ teto do ranking − 1| exceeds 10%, in either direction; without a ceiling, income, fresh dividends (fetched within 10 days), or a fresh rate there is no warning. The parameters are the constants `CEILING_CHECK`, with no setting screen. `buildSnapshot` takes `ntnbRealRate` (a fraction; the server converts the % once) and sets `StrategyRow.ceilingCheck` on the FIIs in the strategy only; the cascade, the Prioridade and the alerts don't use it. The Carteira Alvo shows an amber triangle next to the margin (`CeilingCheckIcon`), and the Recomendações orders show it next to the asset (a tooltip on desktop; on phones the icon on the row and the text in the order sheet, through `AssetMeta.ceilingWarning`). A failed rate read means no warning, never a broken page. Until the first daily cron stores rates in production, no triangle appears.
```

Na lista **Covered** dos testes, acrescentar:

```md
  - the ceiling divergence rule (`strategy/domain/ceiling.test.ts`: tijolo and paper formulas, the exact 10% limit on both sides, every no-data case, the message) and the snapshot carrying it to the strategy rows only (`portfolio/domain/snapshot.test.ts`: not outside the strategy, not without a rate, not with stale dividends, cascade and priorities unchanged);
```

- [ ] **Step 2: `formulas.md`**

Na seção 5, no bloco **Teto** (`ceiling.ts`), acrescentar o item:

```md
  - `ceilingCheck` (`CEILING_CHECK`): teto calculado = proventos de 12 meses ÷ (NTN-B real + spread); tijolo e demais classes + 1,0 p.p., papel + 4,0% de IPCA assumido + 1,0 p.p. Avisa (só informativo) quando difere do teto do ranking em mais de 10%, nos dois lados, e só para FIIs da estratégia com proventos de até 10 dias e taxa em dia.
```

Na seção 11 (**Parece erro, mas é projeto**), acrescentar:

```md
- **Teto calculado × teto do ranking:** o triângulo de divergência não muda ordem, Prioridade nem alerta, e o teto que decide a compra continua o do ranking. O teto calculado reproduz o do ranking na mediana (97%), mas varia com a taxa: o IPCA do papel é um número fixo (4,0%) e o tijolo compara provento nominal com taxa real de propósito (o aluguel acompanha a inflação).
```

- [ ] **Step 3: A spec**

Em `docs/superpowers/specs/2026-11-01-divergencia-teto-design.md`:

1. Trocar a linha de estado por: `Data: 2026-11-01. Estado: **implementada** (plano em `docs/superpowers/plans/2026-11-01-divergencia-teto.md`).` mantendo o resto do parágrafo de origem.
2. No §3, onde diz "A página de Recomendações monta `ceilingChecks: Record<ticker, CeilingCheck>` só com os FIIs avisados e passa ao `AporteCalculator`.", trocar por: "A página de Recomendações põe o aviso no `AssetMeta` de cada FII avisado (`ceilingWarning`: o `CeilingCheck` e o teto do ranking), que já chega às ordens pelo `AporteCalculator`."

- [ ] **Step 4: Formatar e verificar tudo**

```bash
npm run format >/dev/null 2>&1
npm run format:check 2>&1 | tail -1
npm run lint 2>&1 | tail -2
npm run typecheck 2>&1 | tail -2
npm test 2>&1 | rg "Tests |Test Files"
npm run build 2>&1 | tail -4
```

Expected: tudo passa. (O build leva minutos; use `timeout` de 600000 ms.)

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md .claude/skills/conselho-investidores/references/formulas.md docs/superpowers/specs/2026-11-01-divergencia-teto-design.md
git commit -q -F - <<'EOF'
docs: describe the ceiling divergence warning

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DkPj4nhRVPjuPBnYXwnmtN
EOF
```

- [ ] **Step 6: Conferência visual (depois do deploy)**

Não dá para ver o triângulo em desenvolvimento: sem taxa gravada no banco, nenhuma linha recebe o aviso. Depois do primeiro cron diário em produção (22:00 UTC, dias úteis), abrir `/carteira-alvo` e `/recomendacoes` e conferir os FIIs esperados (com a taxa de 30/10: PVBI11, TRXF11, FATN11, XPML11 e VGIP11). Isso fica para o dono.
