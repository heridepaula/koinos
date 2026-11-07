import { describe, expect, it } from "vitest";
import { buildAlerts, withReadState } from "./alerts";
import type { PortfolioAlert, PositionRow, StrategyRow } from "./types";

const row = (ticker: string, patch: Partial<StrategyRow> = {}): StrategyRow => ({
  ticker,
  name: null,
  logoUrl: null,
  configured: false,
  held: true,
  quantity: 10,
  inStrategy: false,
  rank: null,
  ceilingPrice: null,
  suggestedPercent: null,
  category: null,
  bias: null,
  suggestedCategory: null,
  price: 10,
  marginToCeiling: null,
  suspiciousCeiling: false,
  ceilingCheck: null,
  strategyWeight: null,
  targetWeight: null,
  priority: null,
  ...patch,
});

describe("buildAlerts: estratégia por classe", () => {
  const fiis = { rows: [row("AAAA11")], weightsWarning: null, tag: null, receivesAporte: true };

  it("em Geral, os alertas de ações levam o sufixo", () => {
    const alerts = buildAlerts({
      positions: [],
      strategies: [
        fiis,
        {
          rows: [row("PETR4")],
          weightsWarning: null,
          tag: { id: "acoes", label: "ações" },
          receivesAporte: false,
        },
      ],
    });
    const stock = alerts.find((alert) => alert.id === "sem-configuracao-acoes");
    expect(stock?.title).toBe("Ativos fora da Carteira Alvo (ações)");
    expect(stock?.detail).toContain("PETR4");
    expect(alerts.find((alert) => alert.id === "sem-configuracao")?.detail).toContain("AAAA11");
  });

  it("sem tag, o id e o título são os de sempre", () => {
    const alerts = buildAlerts({ positions: [], strategies: [fiis] });
    expect(alerts.map((alert) => alert.id)).toEqual(["sem-configuracao"]);
  });

  it("estratégia incompleta da ação não fala de aporte", () => {
    const alerts = buildAlerts({
      positions: [],
      strategies: [
        {
          rows: [row("PETR4", { configured: true, inStrategy: true })],
          weightsWarning: null,
          tag: null,
          receivesAporte: false,
        },
      ],
    });
    const incomplete = alerts.find((alert) => alert.id === "configuracao-incompleta");
    expect(incomplete?.detail).toBe("PETR4: sem ranking ou sem preço teto.");
  });
});

const position = (ticker: string, portfolioWeight: number): PositionRow =>
  ({ ticker, portfolioWeight, price: 10 }) as PositionRow;

describe("buildAlerts: impressão da concentração", () => {
  const concentration = (positions: PositionRow[]) =>
    buildAlerts({ positions, strategies: [] }).find((alert) => alert.id === "concentracao");

  it("é a lista dos ativos, sem a fatia: o % mudar não reabre o alerta", () => {
    const today = concentration([position("BBBB11", 0.12), position("AAAA11", 0.15)]);
    const tomorrow = concentration([position("BBBB11", 0.13), position("AAAA11", 0.11)]);
    expect(today?.fingerprint).toBe("AAAA11,BBBB11");
    expect(tomorrow?.fingerprint).toBe(today?.fingerprint);
  });

  it("um ativo novo acima do limite muda a impressão", () => {
    const before = concentration([position("AAAA11", 0.15)]);
    const after = concentration([position("AAAA11", 0.15), position("CCCC11", 0.11)]);
    expect(after?.fingerprint).not.toBe(before?.fingerprint);
  });
});

describe("withReadState", () => {
  const alert = (id: string, fingerprint: string): PortfolioAlert => ({
    id,
    level: "info",
    title: id,
    detail: "",
    fingerprint,
  });

  it("lido só com a mesma impressão; os não lidos vêm primeiro", () => {
    const items = withReadState(
      [alert("concentracao", "A,B"), alert("pesos", "x"), alert("sem-cotacao", "C")],
      new Map([
        ["concentracao", { fingerprint: "A,B", dismissed: false }],
        ["sem-cotacao", { fingerprint: "D", dismissed: false }],
      ]),
    );
    expect(items.map((item) => [item.id, item.read])).toEqual([
      ["pesos", false],
      ["sem-cotacao", false],
      ["concentracao", true],
    ]);
  });

  it("excluído some do sino até a impressão mudar", () => {
    const reads = new Map([["concentracao", { fingerprint: "A,B", dismissed: true }]]);
    expect(withReadState([alert("concentracao", "A,B")], reads)).toEqual([]);
    expect(withReadState([alert("concentracao", "A,B,C")], reads)).toMatchObject([
      { id: "concentracao", read: false },
    ]);
  });
});
