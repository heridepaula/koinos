import { describe, expect, it } from "vitest";
import { buildAlerts } from "./alerts";
import type { StrategyRow } from "./types";

const row = (ticker: string, patch: Partial<StrategyRow> = {}): StrategyRow => ({
  ticker,
  name: null,
  logoUrl: null,
  configured: false,
  held: true,
  quantity: 10,
  inStrategy: false,
  sunoRank: null,
  ceilingPrice: null,
  suggestedPercent: null,
  category: null,
  suggestedCategory: null,
  price: 10,
  marginToCeiling: null,
  suspiciousCeiling: false,
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
