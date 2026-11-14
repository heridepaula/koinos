# "Por quê" único na tabela de ordens: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juntar o "Por quê" das ordens de `/recomendacoes` num lugar só. A linha da tabela mostra a decisão do método em palavras e o veredito da tese. Ao expandir a linha, aparecem a "Leitura da IA" (tese, pontos a favor e de atenção, indicadores) e o "Cálculo do Koinos" (a conta em frases, sem tensores crus, e o efeito da ordem). Saem o popover ✨ e a dica nativa.

**Spec:** `docs/superpowers/specs/2026-11-14-por-que-na-tabela-design.md`. O desenho a implementar é o **§7** (revisado depois do conselho e do leitor leigo); o §2 vale onde o §7 não muda nada.

**Fora do escopo:**
- o prompt da tese (veredito "a favor primeiro", o método em palavras);
- a tese em "Fora deste aporte";
- o `AporteCard` de `/ativos/[ticker]`, que continua com `CouncilLenses`.

**Architecture:**
- O texto é puro e testado em `smart-buy/components/aporte/explain.ts` (`plainReason`, `calcSteps`, `calcSummary` e as versões das ações) e em `market-data/domain/asset-thesis.ts` (`groupLenses`).
- A tela fica num componente novo, `aporte/order-why.tsx` (célula, leitura da IA, cálculo), usado pela linha expandida da tabela e pela folha do celular.
- `radar-block.tsx` é apagado.

**Tech Stack:** Next 16 (App Router), React 19, Tailwind 4 (container queries em px), Base UI, Vitest.

**Regras do projeto que importam aqui:**
- Imports dentro da feature são relativos.
- `smart-buy` importa de `market-data` só por `@/features/market-data` (`index.ts`, puro) e `@/features/market-data/ui` (`ui.ts`, client).
- `cn` vem de `@/shared/lib/utils`.
- `formatBRL` usa espaço não separável: nos testes, compare com `plain(text)` (troca U+00A0 por espaço), como `explain.test.ts` já faz.
- Verificação: `npm run format:check && npm run lint && npm run typecheck && npm test`. Um arquivo: `npx vitest run <arquivo>`.
- Commits em inglês, Conventional Commits, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `src/features/smart-buy/components/aporte/explain.ts` | + `plainReason`, `plainStockReason`, `calcSteps`, `calcSummary`, `stockCalcSteps`, `stockCalcSummary`, tipos `CalcStep`/`CalcEffect`; − `shortReason`, `explain`, `shortStockReason`, `explainStock` (Task 4) |
| `src/features/smart-buy/components/aporte/explain.test.ts` | testes das funções novas; saem os das removidas |
| `src/shared/lib/glossary.ts` (+ `.test.ts`) | verbetes `meta-carteira`, `teto-metodo`, `lista-metodo` |
| `src/features/market-data/domain/asset-thesis.ts` (+ `.test.ts`) | `groupLenses` |
| `src/features/market-data/components/thesis-points.tsx` | "A favor" / "Atenção" (novo) |
| `src/features/market-data/ui.ts` | exporta `ThesisPoints` |
| `src/features/smart-buy/components/aporte/impact.tsx` | `ImpactList` (desktop); `ImpactGroup` com a renda primeiro |
| `src/features/smart-buy/components/aporte/order-why.tsx` | `WhyCell`, `AiReading`, `KoinosCalc`, `OrderDetail`, `CalcSheetGroup`, `AiSheetGroup`, `thesisTerms` (novo) |
| `src/features/smart-buy/components/aporte/orders.tsx` | linha expansível, nome cortado, lista e folha novas |
| `src/features/smart-buy/components/aporte/radar-block.tsx` | apagado |
| `CLAUDE.md`, spec | docs |

---

### Task 1: O texto do "Por quê" em palavras (puro)

**Goal:** Funções puras que dão a linha 1 da célula (`plainReason`, `plainStockReason`) e o "Cálculo do Koinos" em frases (`calcSteps`, `calcSummary`, `stockCalcSteps`, `stockCalcSummary`). Não muda nada na tela.

**Files:**
- Modify: `src/features/smart-buy/components/aporte/explain.ts`
- Test: `src/features/smart-buy/components/aporte/explain.test.ts`

**Acceptance Criteria:**
- [ ] `plainReason` do RECR11 de 2026-11-14 dá "6º na lista do método · faltam 5% para a meta · rendimento caiu". Só sobra dá "Sobra do aporte · já na meta". Falta quase nada dá "… · quase na meta".
- [ ] `calcSteps` lista só os tensores que mexeram (|t − 1| ≥ 0,005), com `effect` "mais"/"menos" e `exact` "×1,23". Na meta, só as duas primeiras linhas.
- [ ] `calcSummary` liga o que faltava ao pedido e à compra, diz o que aumentou e o que diminuiu, a trava ("O limite de 25% do aporte por FII cortou o pedido.", "O saldo do aporte acabou antes do pedido.") e as cotas da sobra.
- [ ] Ações: `plainStockReason`, `stockCalcSteps` e `stockCalcSummary` com lote e sobra.
- [ ] Os testes antigos continuam passando (as funções antigas só saem na Task 4).

**Verify:** `npx vitest run src/features/smart-buy/components/aporte/explain.test.ts` → PASS.

**Steps:**

- [ ] **Step 1: Testes que falham.** Em `explain.test.ts`, acrescente aos imports `calcSteps, calcSummary, plainReason, plainStockReason, stockCalcSteps, stockCalcSummary` e, depois do `describe("explain", …)`:

```ts
// O RECR11 do `lab recomendar --valor 10000` de 2026-11-14.
const recr = () =>
  order({
    ticker: "RECR11",
    rank: 6,
    quantity: 26,
    price: 68.7,
    total: 1_786.2,
    fillBefore: 0.947,
    gapBefore: 1_421.08,
    need: 1_850.97,
    priceToBook: 0.77,
    dividendRatio: 0.86,
    marginToCeiling: 0.24,
    macro: "Papel",
    tensors: { valuation: 1.23, dividends: 0.86, safety: 1.24, vacancy: 1 },
  });
const plainText = (text: string) => text.replace(/ /g, " ");

describe("plainReason", () => {
  it("a decisão do método em palavras, sem siglas", () => {
    expect(plainReason(recr())).toBe(
      "6º na lista do método · faltam 5% para a meta · rendimento caiu",
    );
    expect(
      plainReason(order({ priceToBook: 0.84, tensors: { ...neutral, valuation: 1.16 } })),
    ).toBe("3º na lista do método · faltam 20% para a meta · desconto no preço");
    expect(plainReason(order({ tensors: { ...neutral, safety: 1.2 } }))).toBe(
      "3º na lista do método · faltam 20% para a meta · bem abaixo do teto",
    );
  });
  it("sobra, quase na meta e trava", () => {
    expect(plainReason(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))).toBe(
      "Sobra do aporte · já na meta",
    );
    expect(plainReason(order({ fillBefore: 0.998 }))).toBe(
      "3º na lista do método · quase na meta",
    );
    expect(plainReason(order({ limitedBy: "setor", sector: "Shoppings" }))).toBe(
      "3º na lista do método · faltam 20% para a meta · limite do setor",
    );
  });
});

describe("calcSteps", () => {
  it("cada tensor que mexeu, com o efeito e o multiplicador exato", () => {
    const steps = calcSteps(recr());
    expect(steps.map((s) => s.label)).toEqual([
      "Posição na lista do método",
      "Faltava para a meta",
      "Preço sobre o patrimônio",
      "Margem até o teto",
      "Último rendimento",
    ]);
    expect(steps.map((s) => s.effect)).toEqual([null, null, "mais", "mais", "menos"]);
    expect(steps.map((s) => s.exact)).toEqual([null, null, "×1,23", "×1,24", "×0,86"]);
    expect(steps.map((s) => plainText(s.value))).toEqual([
      "6º",
      "R$ 1.421,08 (5%)",
      "P/VP 0,77",
      "24%",
      "14% abaixo da média de 12 meses",
    ]);
  });
  it("vacância só no tijolo; na meta, só a posição e a distância", () => {
    const brick = calcSteps(
      order({ vacancy: 0.12, tensors: { ...neutral, vacancy: 0.88 }, macro: "Tijolo" }),
    );
    expect(brick.at(-1)).toMatchObject({ label: "Vacância", effect: "menos", exact: "×0,88" });
    expect(
      calcSteps(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 })).map(
        (s) => s.value,
      ),
    ).toEqual(["3º", "já na meta"]);
  });
});

describe("calcSummary", () => {
  it("liga o que faltava ao pedido e à compra", () => {
    expect(plainText(calcSummary(recr()))).toBe(
      "Faltavam R$ 1.421,08 para a meta. O método pediu R$ 1.850,97 (mais pelo desconto no preço e pela margem até o teto, menos pelo rendimento menor) e comprou R$ 1.786,20 (26 cotas).",
    );
  });
  it("a trava, o saldo e a sobra", () => {
    expect(plainText(calcSummary(order({ limitedBy: "ativo" })))).toBe(
      "Faltavam R$ 2.000,00 para a meta. O método pediu R$ 2.000,00 e comprou R$ 1.000,00 (10 cotas). O limite de 25% do aporte por FII cortou o pedido.",
    );
    expect(calcSummary(order({ limitedBy: "saldo" }))).toContain(
      "O saldo do aporte acabou antes do pedido.",
    );
    expect(calcSummary(order({ quantity: 12, fromLeftover: 2 }))).toContain(
      "2 cota(s) vieram da sobra.",
    );
    expect(
      plainText(calcSummary(order({ fromLeftover: 10, gapBefore: -50, fillBefore: 1.01 }))),
    ).toBe("Já estava na meta: comprou R$ 1.000,00 (10 cotas) com a sobra do aporte.");
  });
});
```

  E, dentro do `describe("ações", …)` (usa a `stock` de lá):

```ts
  it("as versões em palavras", () => {
    expect(plain(plainStockReason(stock))).toBe(
      "Margem de segurança de 37% · faltavam R$ 1.200,00 para a meta",
    );
    expect(stockCalcSteps(stock).map((s) => plain(s.value))).toEqual([
      "37% (teto R$ 70,00)",
      "R$ 1.200,00",
    ]);
    expect(plain(stockCalcSummary(stock))).toBe(
      "Faltavam R$ 1.200,00 para a meta de 20,0%. Comprou R$ 510,00 (10 ações).",
    );
    const lots = { ...stock, quantity: 300, fromLeftover: 200, lot: 100, total: 15_300 };
    expect(plain(stockCalcSummary(lots))).toBe(
      "Faltavam R$ 1.200,00 para a meta de 20,0%. Comprou R$ 15.300,00 (300 ações, em lotes de 100). 2 lote(s) vieram da sobra.",
    );
    expect(plain(plainStockReason(lots))).toContain("2 lote(s) pela sobra");
  });
```

- [ ] **Step 2:** `npx vitest run src/features/smart-buy/components/aporte/explain.test.ts`. Esperado: FAIL ("plainReason is not exported" ou equivalente).

- [ ] **Step 3: Implementação.** Em `explain.ts`, depois de `shortReason`:

```ts
/** "faltam 5% para a meta", "quase na meta" ou "já na meta". */
function distanceWords(order: CascadeOrder): string {
  const shortfall = 1 - order.fillBefore;
  if (order.gapBefore <= 0) return "já na meta";
  if (shortfall < 0.005) return "quase na meta";
  return `faltam ${formatPercent(shortfall, 0)} para a meta`;
}

/**
 * A linha 1 do "Por quê" (spec por-que-na-tabela §7): a decisão do método em palavras, sem siglas
 * nem tensores. O sinal que mais pesou na mesma ordem de `shortReason`.
 */
export function plainReason(order: CascadeOrder): string {
  if (onlyLeftover(order)) return `Sobra do aporte · ${distanceWords(order)}`;
  const { tensors } = order;
  const parts = [`${order.rank}º na lista do método`, distanceWords(order)];
  if (order.limitedBy === "setor" || order.limitedBy === "macro") {
    parts.push(
      order.limitedBy === "setor" ? "limite do setor" : `limite de ${order.macro.toLowerCase()}`,
    );
  } else if (tensors.dividends < 0.95) {
    parts.push("rendimento caiu");
  } else if (tensors.vacancy < 0.9) {
    parts.push(`vacância de ${formatPercent(order.vacancy ?? 0, 0)}`);
  } else if (order.priceToBook !== null && tensors.valuation >= 1.05) {
    parts.push("desconto no preço");
  } else if (tensors.safety >= 1.1) {
    parts.push("bem abaixo do teto");
  }
  return parts.join(" · ");
}

export type CalcEffect = "mais" | "menos";

/** Uma linha do "Cálculo do Koinos": o rótulo, o valor, o efeito no pedido e o multiplicador. */
export type CalcStep = {
  label: string;
  value: string;
  effect: CalcEffect | null;
  /** "×1,23", para o dono (no `title`); null quando o tensor é neutro. */
  exact: string | null;
};

const moved = (tensor: number) => Math.abs(tensor - 1) >= 0.005;
const effectOf = (tensor: number): CalcEffect | null =>
  moved(tensor) ? (tensor > 1 ? "mais" : "menos") : null;
const exactOf = (tensor: number) => (moved(tensor) ? `×${formatQuantity(tensor)}` : null);

/** O cálculo de uma ordem de FII em linhas: posição, distância e cada tensor que mexeu no pedido. */
export function calcSteps(order: CascadeOrder): CalcStep[] {
  const steps: CalcStep[] = [
    { label: "Posição na lista do método", value: `${order.rank}º`, effect: null, exact: null },
    {
      label: "Faltava para a meta",
      value:
        order.gapBefore > 0
          ? `${formatBRL(order.gapBefore)} (${formatPercent(1 - order.fillBefore, 0)})`
          : "já na meta",
      effect: null,
      exact: null,
    },
  ];
  if (order.gapBefore <= 0) return steps;
  const { tensors } = order;
  const step = (label: string, value: string, tensor: number) =>
    steps.push({ label, value, effect: effectOf(tensor), exact: exactOf(tensor) });
  if (order.priceToBook !== null && moved(tensors.valuation)) {
    step("Preço sobre o patrimônio", `P/VP ${formatQuantity(order.priceToBook)}`, tensors.valuation);
  }
  if (moved(tensors.safety)) {
    step("Margem até o teto", formatPercent(order.marginToCeiling, 0), tensors.safety);
  }
  if (order.dividendRatio !== null && tensors.dividends < 1 && moved(tensors.dividends)) {
    step(
      "Último rendimento",
      `${formatPercent(1 - order.dividendRatio, 0)} abaixo da média de 12 meses`,
      tensors.dividends,
    );
  }
  if (order.macro === "Tijolo" && order.vacancy !== null && moved(tensors.vacancy)) {
    step("Vacância", formatPercent(order.vacancy, 0), tensors.vacancy);
  }
  return steps;
}

/** "a, b e c". */
const listPt = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;

/** A trava como frase; null sem trava. */
function limitSentence(order: CascadeOrder): string | null {
  if (order.limitedBy === "saldo") return "O saldo do aporte acabou antes do pedido.";
  const limit = limitText(order);
  return limit ? `O ${limit} cortou o pedido.` : null;
}

/**
 * A frase que liga a meta ao pedido e à compra (o leitor leigo não entendia "faltava R$ X, pediu
 * R$ Y"): o que aumentou, o que diminuiu, a trava e a sobra.
 */
export function calcSummary(order: CascadeOrder): string {
  const bought = `${formatBRL(order.total)} (${formatQuantity(order.quantity)} ${unitOf("FII", order.quantity)})`;
  if (order.gapBefore <= 0) return `Já estava na meta: comprou ${bought} com a sobra do aporte.`;
  const { tensors } = order;
  const up: string[] = [];
  const down: string[] = [];
  if (order.priceToBook !== null && moved(tensors.valuation)) {
    (tensors.valuation > 1 ? up : down).push(
      tensors.valuation > 1 ? "pelo desconto no preço" : "pelo preço acima do patrimônio",
    );
  }
  if (moved(tensors.safety)) up.push("pela margem até o teto");
  if (order.dividendRatio !== null && tensors.dividends < 0.995) down.push("pelo rendimento menor");
  if (order.macro === "Tijolo" && order.vacancy !== null && tensors.vacancy < 0.995) {
    down.push("pela vacância");
  }
  const adjust = [up.length ? `mais ${listPt(up)}` : null, down.length ? `menos ${listPt(down)}` : null]
    .filter(Boolean)
    .join(", ");
  const sentences = [
    `Faltavam ${formatBRL(order.gapBefore)} para a meta.`,
    `O método pediu ${formatBRL(order.need)}${adjust ? ` (${adjust})` : ""} e comprou ${bought}.`,
    limitSentence(order),
    order.fromLeftover > 0 && order.fromLeftover < order.quantity
      ? `${order.fromLeftover} cota(s) vieram da sobra.`
      : null,
  ];
  return sentences.filter(Boolean).join(" ");
}

/** A linha 1 das ações: a margem de segurança e o que faltava, com a sobra em lotes. */
export function plainStockReason(order: StockBuyOrder): string {
  const missing =
    order.deficitBefore <= 0
      ? "já estava na meta"
      : `faltavam ${formatBRL(order.deficitBefore)} para a meta`;
  return `Margem de segurança de ${formatPercent(order.marginOfSafety, 0)} · ${missing}${leftoverText(order)}`;
}

/** O cálculo de uma ordem de ação em linhas: a margem de segurança e o que faltava. */
export function stockCalcSteps(order: StockBuyOrder): CalcStep[] {
  const ceiling = order.price * (1 + order.marginOfSafety);
  return [
    {
      label: "Margem de segurança",
      value: `${formatPercent(order.marginOfSafety, 0)} (teto ${formatBRL(ceiling)})`,
      effect: null,
      exact: null,
    },
    {
      label: "Faltava para a meta",
      value: order.deficitBefore > 0 ? formatBRL(order.deficitBefore) : "já na meta",
      effect: null,
      exact: null,
    },
  ];
}

/** A frase do cálculo das ações: o que faltava, a compra (em lotes) e os lotes da sobra. */
export function stockCalcSummary(order: StockBuyOrder): string {
  const start =
    order.deficitBefore > 0
      ? `Faltavam ${formatBRL(order.deficitBefore)} para a meta de ${formatPercent(order.targetWeight, 1)}.`
      : "Já estava na meta.";
  const lots = order.lot > 1 ? `, em lotes de ${order.lot}` : "";
  const leftover =
    order.fromLeftover > 0 ? ` ${order.fromLeftover / order.lot} lote(s) vieram da sobra.` : "";
  return `${start} Comprou ${formatBRL(order.total)} (${formatQuantity(order.quantity)} ${unitOf("ACAO", order.quantity)}${lots}).${leftover}`;
}
```

  (`limitText`, `onlyLeftover`, `leftoverText` e `unitOf` já existem no arquivo. `leftoverText` está declarado depois de `shortReason`: mova as funções novas para depois dele, ou `leftoverText` para cima, para não usar antes de declarar.)

- [ ] **Step 4:** `npx vitest run src/features/smart-buy/components/aporte/explain.test.ts`. Esperado: PASS. Se um valor sair diferente só pelo arredondamento (ex.: "5%"), ajuste o **fixture**, nunca a regra.

- [ ] **Step 5: Commit.**

```bash
git add src/features/smart-buy/components/aporte/explain.ts src/features/smart-buy/components/aporte/explain.test.ts
git commit -m "feat(smart-buy): plain-language order reason and calculation steps"
```

---

### Task 2: Verbetes do glossário para meta, teto e lista do método

**Goal:** "meta", "teto" e "lista do método" (alias "ranking") ganham tooltip pelo `GlossaryText`, como os termos da tese.

**Files:**
- Modify: `src/shared/lib/glossary.ts`
- Test: `src/shared/lib/glossary.test.ts`

**Acceptance Criteria:**
- [ ] `glossaryIdsIn("Faltava para a meta", "FII")` contém `meta-carteira`; "Margem até o teto" → `teto-metodo`; "Posição na lista do método" e "6º do ranking" → `lista-metodo`.
- [ ] "metade" não casa com "meta" (palavra inteira).
- [ ] Os três são `common: true`, então não contam no limite de termos do Radar.
- [ ] `npm test` passa: `radar.test.ts`, `week-summary.test.ts` e `asset-thesis.test.ts` sem mudança.

**Verify:** `npx vitest run src/shared/lib/glossary.test.ts && npm test` → PASS.

**Steps:**

- [ ] **Step 1: Teste.** Em `glossary.test.ts`:

```ts
describe("termos do método", () => {
  it("meta, teto e lista do método, como palavra inteira", () => {
    expect(glossaryIdsIn("Faltava para a meta", "FII")).toContain("meta-carteira");
    expect(glossaryIdsIn("Margem até o teto", "ACAO")).toContain("teto-metodo");
    expect(glossaryIdsIn("Posição na lista do método", "FII")).toContain("lista-metodo");
    expect(glossaryIdsIn("6º do ranking", "FII")).toContain("lista-metodo");
    expect(glossaryIdsIn("Pagou metade do normal", "FII")).not.toContain("meta-carteira");
  });
  it("comuns: não contam no limite do Radar", () => {
    for (const id of ["meta-carteira", "teto-metodo", "lista-metodo"]) {
      expect(glossaryEntry(id)?.common).toBe(true);
    }
  });
});
```

  (acrescente `glossaryEntry` e `glossaryIdsIn` ao import, se faltarem.)

- [ ] **Step 2:** `npx vitest run src/shared/lib/glossary.test.ts`. Esperado: FAIL.

- [ ] **Step 3:** Em `GLOSSARY`, depois de `realizacao`:

```ts
  {
    id: "meta-carteira",
    term: "meta",
    aliases: ["% meta"],
    scope: "geral",
    common: true,
    definition:
      "Quanto este ativo deveria pesar na sua carteira, pela % sugerida que você definiu na Carteira Alvo. Abaixo da meta, o método compra mais dele.",
  },
  {
    id: "teto-metodo",
    term: "teto",
    aliases: ["preço teto"],
    scope: "geral",
    common: true,
    definition:
      "O preço máximo que o método aceita pagar, cadastrado na sua Carteira Alvo. No teto ou acima dele, o ativo não recebe aporte.",
  },
  {
    id: "lista-metodo",
    term: "lista do método",
    aliases: ["ranking"],
    scope: "geral",
    common: true,
    definition:
      "A ordem de preferência dos ativos na sua Carteira Alvo (o rank). O método atende primeiro os mais bem colocados.",
  },
```

- [ ] **Step 4:** `npx vitest run src/shared/lib/glossary.test.ts && npm test`. Esperado: PASS.
  - Se um teste do Radar ou da semana quebrar porque "meta", "teto" ou "ranking" agora são termos, leia o teste antes de mexer.
  - Termo comum não deve mudar `checkJargon` nem `promptTerms`.
  - Se mudar, a correção é filtrar `common` onde o teste aponta, não apagar o verbete.

- [ ] **Step 5: Commit.**

```bash
git add src/shared/lib/glossary.ts src/shared/lib/glossary.test.ts
git commit -m "feat(shared): glossary entries for target weight, ceiling and the method's list"
```

---

### Task 3: "A favor" e "Atenção" no lugar das lentes (tese)

**Goal:** `groupLenses` (puro) e `ThesisPoints` (client), que mostram as lentes da tese agrupadas pelo tom do código, com o nome da lente como etiqueta.

**Files:**
- Modify: `src/features/market-data/domain/asset-thesis.ts`
- Test: `src/features/market-data/domain/asset-thesis.test.ts`
- Create: `src/features/market-data/components/thesis-points.tsx`
- Modify: `src/features/market-data/ui.ts`, `src/features/market-data/index.ts` (exporta `groupLenses`)

**Acceptance Criteria:**
- [ ] `groupLenses`: `favoravel` vai para `favor`; `desfavoravel` e `misto` vão para `attention`; `neutro` sai; a ordem de entrada se mantém.
- [ ] `ThesisPoints` não renderiza nada sem pontos e mostra "A favor" e "Atenção" com a etiqueta da lente e o texto com `GlossaryText`.
- [ ] `npm run lint && npm run typecheck` passam.

**Verify:** `npx vitest run src/features/market-data/domain/asset-thesis.test.ts && npm run lint && npm run typecheck` → PASS.

**Steps:**

- [ ] **Step 1: Teste** (em `asset-thesis.test.ts`, com `groupLenses` no import):

```ts
describe("groupLenses", () => {
  it("a favor, atenção (desfavorável e misto) e neutro fora, na ordem", () => {
    const lens = (id: string, tone: "favoravel" | "desfavoravel" | "misto" | "neutro") => ({
      id,
      tone,
    });
    const { favor, attention } = groupLenses([
      lens("renda", "desfavoravel"),
      lens("imoveis", "favoravel"),
      lens("risco", "neutro"),
      lens("metodo", "misto"),
    ]);
    expect(favor.map((l) => l.id)).toEqual(["imoveis"]);
    expect(attention.map((l) => l.id)).toEqual(["renda", "metodo"]);
  });
});
```

- [ ] **Step 2:** rode e veja falhar.

- [ ] **Step 3:** Em `asset-thesis.ts`, perto de `thesisView`:

```ts
/**
 * As lentes da tese em "A favor" e "Atenção", pelo tom do código (spec por-que-na-tabela §7): o
 * leitor leigo leu "Risco: Favorável" como contradição. Neutro não entra.
 */
export function groupLenses<T extends { tone: NewsTone }>(lenses: readonly T[]) {
  return {
    favor: lenses.filter((lens) => lens.tone === "favoravel"),
    attention: lenses.filter((lens) => lens.tone === "desfavoravel" || lens.tone === "misto"),
  };
}
```

  Exporte em `market-data/index.ts`, na linha que já exporta de `./domain/asset-thesis`: `groupLenses`.

- [ ] **Step 4:** Crie `thesis-points.tsx`:

```tsx
import type { AssetClass } from "../domain/asset-class";
import { groupLenses } from "../domain/asset-thesis";
import { GlossaryText } from "@/shared/components/glossary-text";
import { cn } from "@/shared/lib/utils";
import type { CouncilLens } from "./council-lenses";

function PointList({
  title,
  points,
  tone,
  assetClass,
}: {
  title: string;
  points: readonly CouncilLens[];
  tone: "gain" | "loss";
  assetClass: AssetClass | null;
}) {
  if (points.length === 0) return null;
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-footnote font-semibold">
        <span
          aria-hidden="true"
          className={cn("size-2 rounded-full", tone === "gain" ? "bg-gain" : "bg-loss")}
        />
        {title}
      </p>
      <ul className="grid gap-2">
        {points.map((point) => (
          <li key={point.id} className="grid gap-0.5">
            <span className="text-caption text-muted-foreground">{point.label}</span>
            <p className="text-subheadline text-pretty">
              <GlossaryText text={point.text} assetClass={assetClass} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** As lentes da tese como "A favor" e "Atenção" (pelo tom do código), com o nome da lente pequeno. */
export function ThesisPoints({
  lenses,
  assetClass,
}: {
  lenses: readonly CouncilLens[];
  assetClass: AssetClass | null;
}) {
  const { favor, attention } = groupLenses(lenses);
  if (favor.length === 0 && attention.length === 0) return null;
  return (
    <div className="grid gap-3">
      <PointList title="A favor" points={favor} tone="gain" assetClass={assetClass} />
      <PointList title="Atenção" points={attention} tone="loss" assetClass={assetClass} />
    </div>
  );
}
```

  Em `market-data/ui.ts`: `export { ThesisPoints } from "./components/thesis-points";`

- [ ] **Step 5:** `npx vitest run src/features/market-data/domain/asset-thesis.test.ts && npm run lint && npm run typecheck`. Commit:

```bash
git add src/features/market-data
git commit -m "feat(market-data): group thesis lenses into points for and against"
```

---

### Task 4: Componentes do "Por quê" (`order-why.tsx`) e `ImpactList`

**Goal:** Os blocos da linha expandida e da folha, prontos para a Task 5: `WhyCell`, `AiReading`, `KoinosCalc`, `OrderDetail`, `AiSheetGroup`, `CalcSheetGroup`, `thesisTerms`. `ImpactList` para o desktop e `ImpactGroup` com a renda primeiro.

**Files:**
- Create: `src/features/smart-buy/components/aporte/order-why.tsx`
- Modify: `src/features/smart-buy/components/aporte/impact.tsx`

**Acceptance Criteria:**
- [ ] `WhyCell` não tem nenhum elemento interativo (fica dentro do botão da linha).
- [ ] `AiReading` mostra o título "Leitura da IA" (✦), o veredito em Headline, as frases em Subheadline, `ThesisPoints`, os chips (explicação no `title` e em `sr-only`) e a nota com a data. Sem tese: chips (se houver) e "A leitura da IA deste ativo ainda não foi gerada."
- [ ] `KoinosCalc` mostra o título "Cálculo do Koinos" (calculadora), a frase de `calcSummary`/`stockCalcSummary`, as linhas de `calcSteps` com o rótulo em `GlossaryText`, o efeito "↑ compra mais" / "↓ compra menos" e o `exact` no `title`, depois "Depois desta ordem" (`ImpactList`: renda, peso com meta, preço médio, YOC, L/P) e o aviso do teto.
- [ ] `ImpactGroup` (folha) com "Renda/mês a mais" na primeira linha.
- [ ] `npm run lint && npm run typecheck` passam (os componentes ainda não estão em uso; o lint não reclama de export sem uso).

**Verify:** `npm run lint && npm run typecheck` → sem erros.

**Steps:**

- [ ] **Step 1: `impact.tsx`.** Mova o `InsetValueRow` de "Renda/mês a mais" para a primeira linha de `ImpactGroup`. Acrescente:

```tsx
/** "Depois desta ordem" no desktop (linha expandida): renda primeiro, o peso com a meta, e os do PM. */
export function ImpactList({
  impact,
  weightBefore,
  weightAfter,
  targetWeight,
}: {
  impact: OrderImpact | undefined;
  weightBefore: number;
  weightAfter: number;
  targetWeight: number;
}) {
  const percent = (value: number) => formatPercent(value, 1);
  const rows: { label: string; value: ReactNode }[] = [];
  if (impact) {
    rows.push({
      label: "Renda/mês a mais",
      value:
        impact.monthlyIncome === null ? (
          "sem dado"
        ) : (
          <span className="text-gain">
            +<Sensitive>{formatBRL(impact.monthlyIncome)}</Sensitive>
          </span>
        ),
    });
  }
  rows.push({
    label: "Peso na carteira",
    value: (
      <>
        {percent(weightBefore)} ➔ {percent(weightAfter)}
        <span className="text-muted-foreground"> (meta {percent(targetWeight)})</span>
      </>
    ),
  });
  if (impact) {
    rows.push({
      label: "Preço médio",
      value: (
        <Transition
          before={impact.averagePriceBefore}
          after={impact.averagePriceAfter}
          format={formatBRL}
          better="down"
          sensitive
        />
      ),
    });
    if (impact.yieldOnCostAfter !== null) {
      rows.push({
        label: "Yield on cost",
        value: (
          <Transition
            before={impact.yieldOnCostBefore}
            after={impact.yieldOnCostAfter}
            format={percent}
            better="up"
          />
        ),
      });
    }
  }
  return (
    <div className="grid gap-2">
      <p className="text-footnote font-semibold">Depois desta ordem</p>
      <dl className="grid gap-1.5 text-subheadline">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {impact ? (
        <p className="text-footnote text-muted-foreground">
          {impact.averagePriceBefore === null ? "Posição nova." : RESULT_NOTE}
        </p>
      ) : null}
    </div>
  );
}
```

  (acrescente `import type { ReactNode } from "react";`.)

- [ ] **Step 2: `order-why.tsx`:**

```tsx
"use client";

import { CalculatorIcon, SparklesIcon } from "lucide-react";
import type { RadarChip, RadarView, ThesisView } from "@/features/market-data";
import { ThesisPoints } from "@/features/market-data/ui";
import { CeilingCheckBody } from "@/features/strategy/ui";
import { GlossaryText } from "@/shared/components/glossary-text";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { formatPercent, formatTradeDate } from "@/shared/lib/format";
import { glossaryEntry, glossaryIdsIn } from "@/shared/lib/glossary";
import type { MergedOrder } from "../../domain/merge-orders";
import type { OrderImpact } from "../../domain/aporte-impact";
import {
  calcSteps,
  calcSummary,
  plainReason,
  plainStockReason,
  stockCalcSteps,
  stockCalcSummary,
  type CalcStep,
} from "./explain";
import { ImpactList } from "./impact";
import type { AssetMeta } from "./orders";

const NO_THESIS = "A leitura da IA deste ativo ainda não foi gerada.";

const thesisNote = (date: Date) =>
  `Gerada por IA (Gemini) em ${formatTradeDate(date)} a partir dos sinais do método da sua Carteira Alvo e dos indicadores públicos. Pode conter erros e não é recomendação. Fonte: Fundamentus.`;

/** A linha 1 do "Por quê": a decisão do método em palavras. */
export const whyOf = (row: MergedOrder) =>
  row.kind === "FII" ? plainReason(row.order) : plainStockReason(row.order);

const stepsOf = (row: MergedOrder): CalcStep[] =>
  row.kind === "FII" ? calcSteps(row.order) : stockCalcSteps(row.order);
const summaryOf = (row: MergedOrder) =>
  row.kind === "FII" ? calcSummary(row.order) : stockCalcSummary(row.order);

const EFFECT_TEXT = { mais: "↑ compra mais", menos: "↓ compra menos" } as const;

/** Os termos do glossário da tese inteira, para "Termos deste texto" na folha. */
export function thesisTerms(radar: RadarView | undefined) {
  if (!radar?.thesis) return [];
  const text = [radar.thesis.verdict, ...radar.thesis.sentences].join(" ");
  return glossaryIdsIn(text, radar.kind).flatMap((id) => glossaryEntry(id) ?? []);
}

/** A célula fechada (dentro do botão da linha: nada interativo aqui). */
export function WhyCell({ row, thesis }: { row: MergedOrder; thesis: ThesisView | null }) {
  return (
    <span className="grid gap-0.5 text-left">
      <span className="text-footnote font-medium">{whyOf(row)}</span>
      {thesis ? (
        <span className="line-clamp-2 text-footnote text-muted-foreground">{thesis.verdict}</span>
      ) : null}
    </span>
  );
}

function Chip({ chip }: { chip: RadarChip }) {
  return (
    <span
      title={chip.help}
      className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-foreground/6 px-2 text-footnote tabular-nums"
    >
      <span className="text-muted-foreground">{chip.label}</span>
      <span className="font-medium">{chip.value}</span>
      <span className="sr-only">{`. ${chip.help}`}</span>
    </span>
  );
}

/** O corpo da leitura da IA: veredito, frases, pontos, indicadores e nota. */
function AiReadingBody({ radar }: { radar: RadarView }) {
  const { thesis } = radar;
  return (
    <div className="grid gap-3">
      {thesis ? (
        <>
          <p className="text-headline text-pretty">
            <GlossaryText text={thesis.verdict} assetClass={radar.kind} />
          </p>
          {thesis.sentences.map((sentence) => (
            <p key={sentence} className="text-subheadline text-pretty">
              <GlossaryText text={sentence} assetClass={radar.kind} />
            </p>
          ))}
          <ThesisPoints lenses={thesis.lenses} assetClass={radar.kind} />
        </>
      ) : (
        <p className="text-subheadline text-muted-foreground">{NO_THESIS}</p>
      )}
      {radar.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {radar.chips.map((chip) => (
            <Chip key={chip.label} chip={chip} />
          ))}
        </div>
      ) : null}
      {thesis ? (
        <p className="text-footnote text-pretty text-muted-foreground">
          {thesisNote(thesis.generatedAt)}
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof SparklesIcon; children: string }) {
  return (
    <p className="flex items-center gap-1.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Desktop: a coluna "Leitura da IA". */
export function AiReading({ radar }: { radar: RadarView }) {
  return (
    <section className="grid content-start gap-3" aria-label="Leitura da IA">
      <SectionTitle icon={SparklesIcon}>Leitura da IA</SectionTitle>
      <AiReadingBody radar={radar} />
    </section>
  );
}

/** Uma linha do cálculo: rótulo com glossário, valor e o efeito; o multiplicador no `title`. */
function StepRow({ step, kind }: { step: CalcStep; kind: MergedOrder["kind"] }) {
  return (
    <div className="flex justify-between gap-4" title={step.exact ?? undefined}>
      <dt className="text-muted-foreground">
        <GlossaryText text={step.label} assetClass={kind} methodTerms />
      </dt>
      <dd className="text-right tabular-nums">
        {step.value}
        {step.effect ? (
          <span className="block text-footnote text-muted-foreground">
            {EFFECT_TEXT[step.effect]}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** Desktop: a coluna "Cálculo do Koinos". */
export function KoinosCalc({
  row,
  info,
  impact,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  impact: OrderImpact | undefined;
}) {
  const { order } = row;
  return (
    <section className="grid content-start gap-4" aria-label="Cálculo do Koinos">
      <SectionTitle icon={CalculatorIcon}>Cálculo do Koinos</SectionTitle>
      <p className="text-subheadline text-pretty">{summaryOf(row)}</p>
      <dl className="grid gap-2 text-subheadline">
        {stepsOf(row).map((step) => (
          <StepRow key={step.label} step={step} kind={row.kind} />
        ))}
      </dl>
      <ImpactList
        impact={impact}
        weightBefore={order.weightBefore}
        weightAfter={order.weightAfter}
        targetWeight={order.targetWeight}
      />
      {info?.ceilingWarning ? (
        <div className="text-footnote">
          <CeilingCheckBody
            check={info.ceilingWarning.check}
            ceiling={info.ceilingWarning.ceiling}
            price={order.price}
          />
        </div>
      ) : null}
    </section>
  );
}

/** A linha expandida (desktop): a leitura da IA e o cálculo lado a lado a partir de 1.000 px. */
export function OrderDetail({
  row,
  info,
  impact,
}: {
  row: MergedOrder;
  info: AssetMeta | undefined;
  impact: OrderImpact | undefined;
}) {
  return (
    <div className="grid gap-6 py-2 motion-safe:animate-in motion-safe:fade-in-0 @min-[1000px]:grid-cols-[3fr_2fr]">
      {info?.radar ? (
        <AiReading radar={info.radar} />
      ) : (
        <p className="text-subheadline text-muted-foreground @min-[1000px]:col-span-2">
          {NO_THESIS}
        </p>
      )}
      <KoinosCalc row={row} info={info} impact={impact} />
    </div>
  );
}

/** Folha: "Por que este ativo". */
export function AiSheetGroup({ radar }: { radar: RadarView }) {
  return (
    <InsetGroup title="Por que este ativo">
      <div className="px-4 py-3">
        <AiReadingBody radar={radar} />
      </div>
    </InsetGroup>
  );
}

/** Folha: "Por que esta quantidade" (o cálculo e o peso antes, depois e meta). */
export function CalcSheetGroup({ row }: { row: MergedOrder }) {
  const { order } = row;
  return (
    <InsetGroup title="Por que esta quantidade">
      <p className="px-4 py-3 text-subheadline text-pretty">{summaryOf(row)}</p>
      {stepsOf(row).map((step) => (
        <InsetValueRow
          key={step.label}
          label={<GlossaryText text={step.label} assetClass={row.kind} methodTerms />}
          value={
            <span className="text-right">
              {step.value}
              {step.effect ? (
                <span className="block text-footnote">{EFFECT_TEXT[step.effect]}</span>
              ) : null}
            </span>
          }
        />
      ))}
      <InsetValueRow label="Peso antes" value={formatPercent(order.weightBefore, 1)} />
      <InsetValueRow label="Peso depois" value={formatPercent(order.weightAfter, 1)} />
      <InsetValueRow
        label={<GlossaryText text="Peso da meta" assetClass={row.kind} methodTerms />}
        value={formatPercent(order.targetWeight, 1)}
      />
    </InsetGroup>
  );
}
```

  Notas:
  - `AssetMeta` vem de `./orders`, e `orders.tsx` vai importar de `./order-why`. O ciclo é só de tipo (`import type`), o que o TypeScript aceita. Se o lint reclamar (`import/no-cycle`), mova `AssetMeta` para `order-why.tsx` e reexporte em `orders.tsx`: `export type { AssetMeta } from "./order-why";` (o `aporte-calculator.tsx` importa `AssetMeta` de `./aporte/orders`).
  - Se `formatTradeDate` não aceitar `Date`, confira a assinatura em `shared/lib/format.ts:69`; ela já é usada assim no `aporte-card.tsx`.

- [ ] **Step 3:** `npm run lint && npm run typecheck`. Commit:

```bash
git add src/features/smart-buy/components/aporte/order-why.tsx src/features/smart-buy/components/aporte/impact.tsx
git commit -m "feat(smart-buy): AI reading and Koinos calculation blocks for the order detail"
```

---

### Task 5: A tabela com a linha expansível

**Goal:** Em `OrdersTable`: o nome cortado numa linha, a coluna "Por quê" com `WhyCell` e o chevron num botão que abre a linha de detalhe (`OrderDetail`), sem ✨ e sem `title`.

**Files:**
- Modify: `src/features/smart-buy/components/aporte/orders.tsx` (só `OrdersTable` e os helpers que ele usa)

**Acceptance Criteria:**
- [ ] O botão do "Por quê" tem `aria-expanded`, `aria-controls` apontando para a linha de detalhe e o texto `sr-only` "Detalhes de {ticker}". Com toque, tem pelo menos 44 px (`pointer-coarse:min-h-11`).
- [ ] Clicar em qualquer lugar da linha (fora de link ou botão) também abre e fecha; o link do ticker continua indo para `/ativos/{ticker}`.
- [ ] O chevron gira 180° (`transition-transform`, `ease-snappy`, `motion-reduce:transition-none`).
- [ ] Linha de detalhe: `colSpan={7}`, `OrderDetail` dentro, sem hover; várias podem ficar abertas ao mesmo tempo.
- [ ] O nome do fundo ocupa uma linha só (`max-w-64` + `truncate`) e o nome inteiro fica no `title`.
- [ ] `rg -n "RadarPopover|fullOf|title=\{fullOf" src` não acha nada.

**Verify:** `npm run lint && npm run typecheck` → sem erros.

**Steps:**

- [ ] **Step 1:** Em `orders.tsx`:
  - imports: `ChevronDownIcon` (lucide), `Fragment, useState` (react), `cn` (`@/shared/lib/utils`), `OrderDetail, WhyCell` de `./order-why`;
  - remova `RadarPopover` do import de `./radar-block`, `fullOf`, `capitalize` (se ficar sem uso) e `impactText` (se ficar sem uso).

- [ ] **Step 2:** Troque o corpo de `OrdersTable` por:

```tsx
export function OrdersTable({ rows, meta, showClass, impacts }: OrdersProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
          <TableHead className="text-right">{quantityHeader(rows)}</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">% antes → depois</TableHead>
          <TableHead className="text-right">% meta</TableHead>
          <TableHead className="pr-(--card-spacing)">Por quê</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { order } = row;
          const key = rowKey(row);
          const info = meta.get(order.ticker);
          const impact = impacts.get(key);
          const isOpen = open.has(key);
          const detailId = `ordem-${row.kind}-${order.ticker}`;
          return (
            <Fragment key={key}>
              <TableRow
                data-state={isOpen ? "open" : undefined}
                className="cursor-pointer"
                onClick={(event) => {
                  // O link do ticker e os botões (aviso do teto) fazem o seu próprio trabalho.
                  if ((event.target as HTMLElement).closest("a, button")) return;
                  toggle(key);
                }}
              >
                <TableCell className="pl-(--card-spacing)">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex max-w-64 min-w-0 items-center gap-2" title={info?.name ?? undefined}>
                      <AssetLabel
                        ticker={order.ticker}
                        name={info?.name}
                        logoUrl={info?.logoUrl}
                        href={`/ativos/${order.ticker}`}
                      />
                      {info?.ceilingWarning ? (
                        <CeilingCheckIcon
                          check={info.ceilingWarning.check}
                          ceiling={info.ceilingWarning.ceiling}
                          price={order.price}
                        />
                      ) : null}
                    </div>
                    {showClass ? <ClassBadge kind={row.kind} /> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(order.price)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  <div className="grid justify-items-end">
                    <Sensitive>{formatBRL(order.total)}</Sensitive>
                    <IncomeBadge impact={impact} className="font-normal" />
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(order.targetWeight, 1)}
                </TableCell>
                <TableCell className="min-w-64 pr-(--card-spacing) whitespace-normal">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    onClick={() => toggle(key)}
                    className="flex w-full items-start justify-between gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                  >
                    <span className="sr-only">{`Detalhes de ${order.ticker}: `}</span>
                    <WhyCell row={row} thesis={info?.radar?.thesis ?? null} />
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-snappy motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </TableCell>
              </TableRow>
              {isOpen ? (
                <TableRow id={detailId} className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-(--card-spacing) pb-5 whitespace-normal">
                    <OrderDetail row={row} info={info} impact={impact} />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

  - **`aria-controls`:** com a linha fechada, o `id` não existe no DOM. Isso é aceitável e é o padrão de disclosure. Se o lint de a11y reclamar, mantenha o `TableRow` sempre renderizado com `hidden={!isOpen}`.
  - **Comentário da tabela:** atualize o JSDoc de `OrdersTable` para: "a linha 1 do porquê é a decisão do método em palavras e a 2 o veredito da tese; o botão abre a linha de detalhe com a leitura da IA e o cálculo."
  - **Container:** o `OrderDetail` usa `@min-[1000px]`. O card das ordens já é `@container` (`aporte-calculator.tsx`).

- [ ] **Step 3:** `npm run lint && npm run typecheck`. Commit:

```bash
git add src/features/smart-buy/components/aporte/orders.tsx
git commit -m "feat(smart-buy): expandable order rows with the AI reading and the calculation"
```

---

### Task 6: Lista e folha do celular; sai o `radar-block`

**Goal:** Na célula da lista, a decisão em palavras e o veredito; a folha em nova ordem ("Comprar", "Por que este ativo", "Por que esta quantidade", "Depois desta ordem", "Aviso", "Termos deste texto"). Apagar `radar-block.tsx` e as funções antigas de `explain.ts`.

**Files:**
- Modify: `src/features/smart-buy/components/aporte/orders.tsx` (`OrdersList`, `RowSheet`, `OrderSheetFrame`; saem `OrderSheet`, `StockOrderSheet`, `ReasonRow`)
- Delete: `src/features/smart-buy/components/aporte/radar-block.tsx`
- Modify: `src/features/smart-buy/components/aporte/explain.ts` e `explain.test.ts` (saem `shortReason`, `explain`, `shortStockReason`, `explainStock`, o `times` sem uso e os testes delas)

**Acceptance Criteria:**
- [ ] Célula da lista:
  - linha 2: "26 cotas × R$ 68,70" à esquerda e "5,7% → 6,0% · +R$ 19,85/mês estim." à direita;
  - linha 3: `whyOf(row)` em Caption;
  - linha 4: o veredito (Caption cinza, `line-clamp-2`), só com tese.
- [ ] A folha não tem mais os grupos "Peso na carteira de FIIs/ações" nem "Por quê": eles estão em "Por que esta quantidade".
- [ ] "Termos deste texto" vem de `thesisTerms(info?.radar)`, depois do aviso.
- [ ] `rg -n "radar-block|shortReason|explainStock|shortStockReason|\bexplain\(" src` não acha nada.
- [ ] `npm run lint && npm run typecheck && npm test` passam.

**Verify:** `npm run lint && npm run typecheck && npm test` → sem erros.

**Steps:**

- [ ] **Step 1: Célula da lista.** Em `OrdersList`, troque as duas `<p>` de baixo por:

```tsx
                  <p className="flex justify-between gap-3 text-footnote text-muted-foreground tabular-nums">
                    <span>
                      <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>{" "}
                      {unitOf(row.kind, order.quantity)} × {formatBRL(order.price)}
                    </span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {formatPercent(order.weightBefore, 1)} → {formatPercent(order.weightAfter, 1)}
                      <IncomeBadge impact={impact} />
                    </span>
                  </p>
                  <p className="text-caption">{whyOf(row)}</p>
                  {info?.radar?.thesis ? (
                    <p className="line-clamp-2 text-caption text-muted-foreground">
                      {info.radar.thesis.verdict}
                    </p>
                  ) : null}
```

  Import `whyOf, AiSheetGroup, CalcSheetGroup, thesisTerms` de `./order-why`.

- [ ] **Step 2: Folha.** `RowSheet` passa a ser só `OrderSheetFrame`:

```tsx
function RowSheet({ row, ...extras }: { row: MergedOrder } & SheetExtras) {
  return <OrderSheetFrame row={row} {...extras} />;
}
```

  Apague `OrderSheet`, `StockOrderSheet` e `ReasonRow`. Em `OrderSheetFrame`, tire `children` das props e troque o `DrawerBody` por:

```tsx
      <DrawerBody className="grid content-start gap-5">
        <div className="grid justify-items-start gap-1 px-1">
          <p className="text-footnote text-muted-foreground">Comprar</p>
          <p className="text-title-1 tabular-nums">
            <Sensitive>{formatBRL(order.total)}</Sensitive>
          </p>
          <p className="text-subheadline text-muted-foreground tabular-nums">
            <Sensitive mask={QUANTITY_MASK}>{formatQuantity(order.quantity)}</Sensitive>{" "}
            {unitOf(row.kind, order.quantity)} × ~{formatBRL(order.price)}
          </p>
        </div>
        {info?.radar ? <AiSheetGroup radar={info.radar} /> : null}
        <CalcSheetGroup row={row} />
        {impact ? <ImpactGroup impact={impact} /> : null}
        {info?.ceilingWarning ? (
          <InsetGroup title="Aviso">
            <div className="px-4 py-3 text-footnote">
              <CeilingCheckBody
                check={info.ceilingWarning.check}
                ceiling={info.ceilingWarning.ceiling}
                price={order.price}
              />
            </div>
          </InsetGroup>
        ) : null}
        {terms.length > 0 ? (
          <InsetGroup title="Termos deste texto">
            {terms.map((entry) => (
              <div key={entry.id} className="grid gap-0.5 px-4 py-2">
                <p className="text-subheadline font-medium">{entry.term}</p>
                <p className="text-footnote text-muted-foreground">{entry.definition}</p>
              </div>
            ))}
          </InsetGroup>
        ) : null}
      </DrawerBody>
```

  Defina `const terms = thesisTerms(info?.radar);` no começo de `OrderSheetFrame`. Atualize o JSDoc da lista e da folha para a nova ordem.

- [ ] **Step 3: Limpeza.**
  - `git rm src/features/smart-buy/components/aporte/radar-block.tsx`.
  - Em `explain.ts`, apague `shortReason`, `explain`, `shortStockReason`, `explainStock`, `missingText` e `times`, se ficarem sem uso.
  - Em `explain.test.ts`, apague os `describe`/`it` delas (`shortReason`, `explain`, os três primeiros `it` das ações que usam `explainStock`/`shortStockReason`).
  - Rode `rg -n "radar-block|shortReason|explainStock|shortStockReason|\bexplain\(" src` e corrija o que sobrar. Os comentários também contam.

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test`. Commit:

```bash
git add -A src/features/smart-buy
git commit -m "feat(smart-buy): order list and sheet with the AI reading and the calculation; drop the radar popover"
```

---

### Task 7: Docs, verificação completa e conferência na tela

**Goal:** CLAUDE.md e o spec atualizados, o CI local verde e a tela conferida.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-11-14-por-que-na-tabela-design.md` (status)

**Acceptance Criteria:**
- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` passam.
- [ ] CLAUDE.md:
  - não cita mais `shortReason`, `explain(`, `explainStock`, `shortStockReason`, o popover ✨ nem "the table's tooltip";
  - descreve a linha expansível, `plainReason`/`calcSteps`/`calcSummary`, `groupLenses`/`ThesisPoints`, os verbetes novos e a folha nova.
- [ ] A linha 1 do spec diz "Status: implementado em 2026-11-14 (plano `2026-11-14-por-que-na-tabela.md`)".
- [ ] Na tela (sessão do dono, `npm run dev`):
  - em `/recomendacoes?valor=10000`, a linha do RECR11 abre e fecha pelo chevron, pelo teclado e pelo clique na linha;
  - os tooltips de "meta", "teto" e "lista do método" abrem;
  - na largura de iPhone, a folha mostra a nova ordem.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → tudo verde.

**Steps:**

- [ ] **Step 1: CLAUDE.md.** Nos trechos abaixo, troque o texto antigo pelo novo:
  - **Domain flow, item 3,** o bullet "The 'Por quê' comes from `smart-buy/components/aporte/explain.ts`…" →

    > The "Por quê" comes from `smart-buy/components/aporte/explain.ts` (spec `2026-11-14-por-que-na-tabela-design.md`, after the council and a layperson read the first design): `plainReason`/`plainStockReason` is line 1 of the cell, the method's decision in words ("6º na lista do método · faltam 5% para a meta · rendimento caiu"); line 2 is the thesis verdict. A button with the chevron (and a click on the row) opens a detail row (`OrderDetail`, `aporte/order-why.tsx`): "Leitura da IA" (the verdict, the sentences, `ThesisPoints` grouping the lenses into "A favor"/"Atenção" by the code's tone with `groupLenses`, the chips and the note with the date) and "Cálculo do Koinos" (`calcSummary`/`stockCalcSummary`, the sentence that links the gap to the request and the purchase; `calcSteps`/`stockCalcSteps`, each tensor that moved as "↑ compra mais"/"↓ compra menos" with the exact multiplier in the `title`; `ImpactList` with the income first; the ceiling warning). The phone sheet: Comprar, "Por que este ativo", "Por que esta quantidade" (with the weights), "Depois desta ordem", Aviso, "Termos deste texto". "meta", "teto" and "lista do método"/"ranking" are glossary terms (`common`). `reasonHelp` picks the help text of an excluded reason by the classes in it (FII, stock or neutral).

  - **Bullet do Radar em `/recomendacoes`:** troque "um botão ✨ ao lado do ativo na tabela de ordens abre um popover com chips…" e "Na tela (`thesisView`, `RadarView.thesis`): o popover ✨ 'Por que este ativo' (…), a folha do celular (…)" por "Na tela: a linha expansível da tabela de ordens e a folha do celular (ver 'Por quê' em Domain flow, item 3) e o `AporteCard` de `/ativos/[ticker]`".
  - **Aporte impact:** "the tooltip and the phone sheet show 'Depois desta ordem' (`ImpactGroup`)" → "the detail row (`ImpactList`) and the phone sheet (`ImpactGroup`) show 'Depois desta ordem', the income first".
  - **Lista de testes:** troque "the 'Por quê' text, FIIs and stocks ('N lote(s) pela sobra' included)" por "the 'Por quê' in words and the calculation (`plainReason`, `calcSteps`, `calcSummary` and the stock ones, with the lot and the leftover)". Acrescente `groupLenses` ao trecho de `asset-thesis.test.ts` e "os termos do método" ao de `glossary.test.ts`.

- [ ] **Step 2:** No spec, troque "Status: **proposta**, ainda sem plano nem código." por "Status: implementado em 2026-11-14 (plano `2026-11-14-por-que-na-tabela.md`)." Na §7, item 1, acrescente: "Na implementação, a linha 1 mantém o terceiro sinal de `shortReason` em palavras ('rendimento caiu', 'desconto no preço', 'bem abaixo do teto'), para não perder o sinal quando não há tese."

- [ ] **Step 3:**

```bash
npm run format
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 4: Tela.** `npm run dev`, entre com a sessão do dono e confira os itens dos critérios.
  - Também confira um FII sem tese (só o cálculo, com "A leitura da IA deste ativo ainda não foi gerada.").
  - Sem a sessão, diga ao dono o que conferir; não marque como conferido.

- [ ] **Step 5: Commit.**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-11-14-por-que-na-tabela-design.md
git commit -m "docs: document the unified order reason"
```

---

## Depois do plano (com o dono)

- O push para `main` só acontece com o pedido do dono.
- Em produção, as teses v1 (só veredito) ainda aparecem até o cron do Radar refazê-las (03:00–06:45).
