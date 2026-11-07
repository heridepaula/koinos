import { formatPercent } from "@/shared/lib/format";
import type { AlertNotification, PortfolioAlert, PositionRow, StrategyRow } from "./types";

/** Um único ativo acima desta fatia do patrimônio gera alerta de concentração. */
export const CONCENTRATION_ALERT = 0.1;

/** A estratégia de uma classe, para os alertas dela. */
export type StrategyAlertInput = {
  rows: readonly StrategyRow[];
  weightsWarning: string | null;
  /** Em Geral, a carteira de ações se identifica no id e no título. null: sem sufixo. */
  tag: { id: string; label: string } | null;
  /**
   * true: o alerta diz que sem ranking ou sem teto o ativo não recebe aporte, a regra da cascata de
   * FIIs. As ações também recebem aporte (stockSmartBuy), mas esse motor só exige o teto e usa o
   * ranking para desempatar: o texto delas não promete a exclusão.
   */
  receivesAporte: boolean;
};

/** Os tickers em ordem alfabética: a impressão não muda quando só a ordem muda. */
const tickersOf = (rows: readonly { ticker: string }[]) =>
  rows
    .map((row) => row.ticker)
    .sort()
    .join(",");

export function buildAlerts(input: {
  positions: readonly PositionRow[];
  strategies: readonly StrategyAlertInput[];
}): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const { positions } = input;

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
      fingerprint: tickersOf(concentrated),
    });
  }

  const noQuote = positions.filter((row) => row.price === null);
  if (noQuote.length > 0) {
    alerts.push({
      id: "sem-cotacao",
      level: "warning",
      title: "Ativos sem cotação",
      detail: `${noQuote.map((row) => row.ticker).join(", ")}: o valor usa o preço médio até a cotação chegar.`,
      fingerprint: tickersOf(noQuote),
    });
  }

  for (const strategy of input.strategies) alerts.push(...strategyAlerts(strategy));

  return alerts;
}

function strategyAlerts({
  rows,
  weightsWarning,
  tag,
  receivesAporte,
}: StrategyAlertInput): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const id = (base: string) => (tag ? `${base}-${tag.id}` : base);
  const title = (base: string) => (tag ? `${base} (${tag.label})` : base);

  const members = rows.filter((row) => row.inStrategy);

  const suspicious = members.filter((row) => row.suspiciousCeiling);
  if (suspicious.length > 0) {
    alerts.push({
      id: id("teto-suspeito"),
      level: "warning",
      title: title("Preço teto suspeito"),
      detail: `${suspicious.map((row) => row.ticker).join(", ")}: teto menor que metade ou maior que o dobro do preço. Pode ser erro de digitação ou teto desatualizado.`,
      fingerprint: tickersOf(suspicious),
    });
  }

  const incomplete = members.filter((row) => row.rank === null || row.ceilingPrice === null);
  if (incomplete.length > 0) {
    const list = incomplete.map((row) => row.ticker).join(", ");
    alerts.push({
      id: id("configuracao-incompleta"),
      level: "info",
      title: title("Estratégia incompleta"),
      detail: receivesAporte
        ? `${list}: sem ranking ou sem preço teto não recebem aporte.`
        : `${list}: sem ranking ou sem preço teto.`,
      fingerprint: tickersOf(incomplete),
    });
  }

  const ranks = new Map<number, string[]>();
  for (const row of members) {
    if (row.rank === null) continue;
    ranks.set(row.rank, [...(ranks.get(row.rank) ?? []), row.ticker]);
  }
  const duplicated = [...ranks].filter(([, tickers]) => tickers.length > 1);
  if (duplicated.length > 0) {
    const detail = duplicated
      .map(([rank, tickers]) => `${rank}º: ${tickers.join(", ")}`)
      .join(" · ");
    alerts.push({
      id: id("ranking-repetido"),
      level: "info",
      title: title("Ranking repetido"),
      detail,
      fingerprint: detail,
    });
  }

  if (weightsWarning) {
    alerts.push({
      id: id("pesos"),
      level: "info",
      title: title("% sugeridas"),
      detail: weightsWarning,
      // O texto só muda quando o dono edita as %: serve de impressão.
      fingerprint: weightsWarning,
    });
  }

  const unconfigured = rows.filter((row) => row.held && !row.configured);
  if (unconfigured.length > 0) {
    alerts.push({
      id: id("sem-configuracao"),
      level: "info",
      title: title("Ativos fora da Carteira Alvo"),
      detail: `${unconfigured.map((row) => row.ticker).join(", ")} estão na carteira, mas não na estratégia.`,
      fingerprint: tickersOf(unconfigured),
    });
  }

  return alerts;
}

/**
 * Os alertas do sino: lido quando a impressão marcada é a de agora. Os não lidos vêm primeiro,
 * cada grupo na ordem de `buildAlerts`.
 */
export function withReadState(
  alerts: readonly PortfolioAlert[],
  reads: ReadonlyMap<string, string>,
): AlertNotification[] {
  const items = alerts.map((alert) => ({
    ...alert,
    read: reads.get(alert.id) === alert.fingerprint,
  }));
  return [...items.filter((item) => !item.read), ...items.filter((item) => item.read)];
}
