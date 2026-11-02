import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";
import {
  CEILING_CHECK,
  CEILING_MAX,
  ceilingCheck,
  ceilingCheckMessage,
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
    ["sem teto da Suno", { ceiling: null }],
    ["teto da Suno zero", { ceiling: 0 }],
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
  it("tijolo: cita o teto da Suno, o calculado, a divergência, a taxa e o spread", () => {
    const check = ceilingCheck(base)!;
    const message = ceilingCheckMessage(check, 100);
    expect(message).toContain(`Teto da Suno ${formatBRL(100)}`);
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
