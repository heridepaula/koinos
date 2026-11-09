import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";
import {
  CEILING_CHECK,
  CEILING_MAX,
  calculatedCeiling,
  ceilingCheck,
  ceilingCheckDetails,
  ceilingFromInput,
} from "./ceiling";

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
    expect(check?.income12m).toBe(12);
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

describe("ceilingCheckDetails: o texto estruturado do aviso", () => {
  // Tijolo, NTN-B 7%: renda 8 ÷ 0,08 = calculado 100. Contra um teto do ranking de 120: negativo.
  const negative = ceilingCheck({ ceiling: 120, income12m: 8, paper: false, ntnbRealRate: 0.07 })!;
  // Renda 12 ÷ 0,08 = calculado 150. Contra um teto do ranking de 100: positivo.
  const positive = ceilingCheck(base)!;

  it("calculado ABAIXO do teto do ranking é negativo", () => {
    const d = ceilingCheckDetails(negative, 120);
    expect(d.direction).toBe("negative");
    expect(d.badge).toBe("Negativo");
    expect(d.change).toBe(formatSignedPercent(negative.divergence, 1));
    expect(d.headline).toBe("Teto calculado abaixo do teto do ranking");
    expect(d.meaning).toContain("pode sair caro");
  });

  it("calculado ACIMA do teto do ranking é positivo", () => {
    const d = ceilingCheckDetails(positive, 100);
    expect(d.direction).toBe("positive");
    expect(d.badge).toBe("Positivo");
    expect(d.change).toBe(formatSignedPercent(positive.divergence, 1));
    expect(d.headline).toBe("Teto calculado acima do teto do ranking");
    expect(d.meaning).toContain("mais conservador");
  });

  it("negativo com o preço no teto calculado ou abaixo é atenção (amarelo); acima, segue vermelho", () => {
    // Calculado 100: 90 e 100 cabem; 110 passou.
    for (const price of [90, 100]) {
      const d = ceilingCheckDetails(negative, 120, price);
      expect(d.tone).toBe("caution");
      expect(d.badge).toBe("Atenção");
      expect(d.headline).toContain("preço atual está abaixo do calculado");
    }
    expect(ceilingCheckDetails(negative, 120, 110).tone).toBe("negative");
    expect(ceilingCheckDetails(negative, 120).tone).toBe("negative");
    // O positivo nunca vira atenção.
    expect(ceilingCheckDetails(positive, 100, 90).tone).toBe("positive");
  });

  it("as linhas trazem o teto do ranking e o calculado, e só elas quando não há preço", () => {
    const d = ceilingCheckDetails(negative, 120);
    expect(d.rows).toEqual([
      { label: "Teto do ranking", value: formatBRL(120) },
      { label: "Teto calculado", value: formatBRL(100) },
    ]);
    expect(ceilingCheckDetails(negative, 120, null).rows).toHaveLength(2);
    expect(ceilingCheckDetails(negative, 120, 0).rows).toHaveLength(2);
    expect(ceilingCheckDetails(negative, 120, Number.NaN).rows).toHaveLength(2);
  });

  it("o preço acima do teto calculado vem destacado, com quanto passa", () => {
    // 110 contra 100 calculado: 10% acima.
    const row = ceilingCheckDetails(negative, 120, 110).rows[2];
    expect(row).toEqual({
      label: "Preço atual",
      value: formatBRL(110),
      note: `${formatPercent(0.1, 1)} acima do teto calculado`,
      tone: "warn",
    });
  });

  it("o preço abaixo do teto calculado mostra a margem, sem destaque", () => {
    // 90 contra 150 calculado: margem de 40%.
    const row = ceilingCheckDetails(positive, 100, 90).rows[2];
    expect(row).toEqual({
      label: "Preço atual",
      value: formatBRL(90),
      note: `margem de ${formatPercent(0.4, 1)} até o teto calculado`,
    });
  });

  it("a fórmula mostra a renda, o rendimento exigido e de onde ele vem (tijolo)", () => {
    const formula = ceilingCheckDetails(negative, 120).formula;
    expect(formula).toContain(`Proventos de 12 meses ${formatBRL(8)}`);
    expect(formula).toContain(formatPercent(0.08, 2));
    expect(formula).toContain(`NTN-B ${formatPercent(0.07, 2)}`);
    expect(formula).toContain("1,0 p.p.");
    expect(formula).not.toContain("IPCA");
  });

  it("no papel a fórmula inclui também o IPCA assumido", () => {
    const paper = ceilingCheck({ ...base, income12m: 9.6, paper: true })!;
    const formula = ceilingCheckDetails(paper, 100).formula;
    expect(formula).toContain(`Proventos de 12 meses ${formatBRL(9.6)}`);
    expect(formula).toContain(formatPercent(0.12, 2));
    expect(formula).toContain(`IPCA ${formatPercent(0.04, 1)}`);
    expect(formula).toContain("1,0 p.p.");
  });
});

describe("ceilingFromInput: o teto digitado na máscara de moeda", () => {
  it("campo em branco ou em 0,00 é 'sem teto'", () => {
    expect(ceilingFromInput(null)).toEqual({ value: null, problem: null });
    expect(ceilingFromInput(0)).toEqual({ value: null, problem: null });
  });

  it("um valor em reais passa como está, com os centavos", () => {
    expect(ceilingFromInput(124.5)).toEqual({ value: 124.5, problem: null });
    expect(ceilingFromInput(0.01)).toEqual({ value: 0.01, problem: null });
  });

  it("o máximo (R$ 1.000.000,00) vale; acima dele é recusado com a mensagem", () => {
    expect(CEILING_MAX).toBe(1_000_000);
    expect(ceilingFromInput(CEILING_MAX)).toEqual({ value: CEILING_MAX, problem: null });
    expect(ceilingFromInput(CEILING_MAX + 0.01)).toEqual({
      value: null,
      problem: `O teto deve ser de até ${formatBRL(CEILING_MAX)}.`,
    });
  });
});

describe("calculatedCeiling: o teto calculado sem o limite", () => {
  it("existe mesmo quando o teto do ranking está dentro dos 10%", () => {
    // 8 ÷ 0,08 = 100, contra um teto de 100: sem aviso, mas com o teto calculado.
    expect(ceilingCheck({ ...base, income12m: 8 })).toBeNull();
    const result = calculatedCeiling({ income12m: 8, paper: false, ntnbRealRate: 0.07 });
    expect(result?.calculated).toBeCloseTo(100, 6);
    expect(result?.requiredYield).toBeCloseTo(0.08, 10);
  });

  it("papel soma o IPCA assumido, como no aviso", () => {
    const result = calculatedCeiling({ income12m: 9.6, paper: true, ntnbRealRate: 0.07 });
    expect(result?.calculated).toBeCloseTo(80, 6);
    expect(ceilingCheck({ ...base, income12m: 9.6, paper: true })?.calculated).toBe(
      result?.calculated,
    );
  });

  it.each([
    ["sem renda", { income12m: null, paper: false, ntnbRealRate: 0.07 }],
    ["renda zero", { income12m: 0, paper: false, ntnbRealRate: 0.07 }],
    ["sem taxa", { income12m: 8, paper: false, ntnbRealRate: null }],
    ["rendimento exigido não positivo", { income12m: 8, paper: false, ntnbRealRate: -0.01 }],
  ])("%s: null", (_name, input) => {
    expect(calculatedCeiling(input)).toBeNull();
  });
});
