// Testes da divisão do aporte entre as classes (spec aporte por classe, §4.2).
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
