import { formatPercent } from "@/shared/lib/format";
import type { PortfolioAlert, PositionRow, StrategyRow } from "./types";

/** Um único ativo acima desta fatia do patrimônio gera alerta de concentração. */
export const CONCENTRATION_ALERT = 0.1;

export function buildAlerts(input: {
  positions: readonly PositionRow[];
  strategyRows: readonly StrategyRow[];
  weightsWarning: string | null;
}): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const { positions, strategyRows } = input;

  const concentrated = positions
    .filter((row) => row.portfolioWeight > CONCENTRATION_ALERT)
    .sort((a, b) => b.portfolioWeight - a.portfolioWeight);
  if (concentrated.length > 0) {
    const total = concentrated.reduce((sum, row) => sum + row.portfolioWeight, 0);
    alerts.push({
      id: "concentracao",
      level: "warning",
      title: `Concentração: ${formatPercent(total, 1)} do patrimônio em ${concentrated.length} ativo(s)`,
      detail: concentrated
        .map((row) => `${row.ticker} ${formatPercent(row.portfolioWeight, 1)}`)
        .join(" · "),
    });
  }

  const noQuote = positions.filter((row) => row.price === null);
  if (noQuote.length > 0) {
    alerts.push({
      id: "sem-cotacao",
      level: "warning",
      title: "Ativos sem cotação",
      detail: `${noQuote.map((row) => row.ticker).join(", ")}: o valor usa o preço médio até a cotação chegar.`,
    });
  }

  const members = strategyRows.filter((row) => row.inStrategy);

  const suspicious = members.filter((row) => row.suspiciousCeiling);
  if (suspicious.length > 0) {
    alerts.push({
      id: "teto-suspeito",
      level: "warning",
      title: "Preço teto suspeito",
      detail: `${suspicious.map((row) => row.ticker).join(", ")}: teto menor que metade ou maior que o dobro do preço. Pode ser erro de digitação ou teto desatualizado.`,
    });
  }

  const incomplete = members.filter((row) => row.sunoRank === null || row.ceilingPrice === null);
  if (incomplete.length > 0) {
    alerts.push({
      id: "configuracao-incompleta",
      level: "info",
      title: "Estratégia incompleta",
      detail: `${incomplete.map((row) => row.ticker).join(", ")}: sem ranking ou sem preço teto não recebem aporte.`,
    });
  }

  const ranks = new Map<number, string[]>();
  for (const row of members) {
    if (row.sunoRank === null) continue;
    ranks.set(row.sunoRank, [...(ranks.get(row.sunoRank) ?? []), row.ticker]);
  }
  const duplicated = [...ranks].filter(([, tickers]) => tickers.length > 1);
  if (duplicated.length > 0) {
    alerts.push({
      id: "ranking-repetido",
      level: "info",
      title: "Ranking repetido",
      detail: duplicated.map(([rank, tickers]) => `${rank}º: ${tickers.join(", ")}`).join(" · "),
    });
  }

  if (input.weightsWarning) {
    alerts.push({
      id: "pesos",
      level: "info",
      title: "% sugeridas",
      detail: input.weightsWarning,
    });
  }

  const unconfigured = strategyRows.filter((row) => row.held && !row.configured);
  if (unconfigured.length > 0) {
    alerts.push({
      id: "sem-configuracao",
      level: "info",
      title: "Ativos fora da Carteira Alvo",
      detail: `${unconfigured.map((row) => row.ticker).join(", ")} estão na carteira, mas não na estratégia.`,
    });
  }

  return alerts;
}
