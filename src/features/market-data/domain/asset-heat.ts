import type { DailyClose } from "../ports";
import type { AssetClass } from "./asset-class";
import { weekMoveText, type WeekMove } from "./week-move";
import type { WeekTone } from "./week-summary";

// O termômetro do ativo, de medo extremo a euforia (spec 2026-11-13-leitura-da-semana-design.md,
// parte 3): um índice de 0 a 100 do momento, calculado pelo código com o preço (a semana contra o
// índice, o IFR e a distância da média) e, com peso menor, o sentido das notícias dado pela leitura
// da semana. É um retrato, não um sinal de compra ou venda. Puro.

export const HEAT = {
  /** Pesos de cada componente; os ausentes saem e os outros são reponderados. */
  weights: { semana: 0.3, ifr: 0.3, media: 0.25, noticias: 0.15 },
  /** A variação (fração) que leva a semana e a média ao extremo (0 ou 100), por classe. */
  span: { FII: 0.06, ACAO: 0.1 } satisfies Record<AssetClass, number>,
  rsiPeriod: 14,
  averagePoints: 20,
  minAveragePoints: 10,
  newsScore: { favoravel: 80, misto: 50, neutro: 50, desfavoravel: 20 },
} as const;

export type HeatLevel = "medo-extremo" | "medo" | "neutro" | "otimismo" | "euforia";

export const HEAT_LABELS: Record<HeatLevel, string> = {
  "medo-extremo": "Medo extremo",
  medo: "Medo",
  neutro: "Neutro",
  otimismo: "Otimismo",
  euforia: "Euforia",
};

export type HeatFactorId = keyof typeof HEAT.weights;

export type HeatFactor = { id: HeatFactorId; label: string; score: number; detail: string };

export type AssetHeat = { score: number; level: HeatLevel; label: string; factors: HeatFactor[] };

/** O momento do ativo para a tela: o movimento em 7 dias e o termômetro. */
export type AssetPulse = { move: WeekMove | null; heat: AssetHeat | null };

const FACTOR_LABELS: Record<HeatFactorId, string> = {
  semana: "Variação em 7 dias",
  ifr: "Força das altas e das baixas (IFR)",
  media: "Preço contra a média",
  noticias: "Tom das notícias",
};

const TONE_WORDS: Record<keyof typeof HEAT.newsScore, string> = {
  favoravel: "favorável",
  misto: "misto",
  neutro: "neutro",
  desfavoravel: "desfavorável",
};

/**
 * O Índice de Força Relativa de Wilder: a média das altas contra a das quedas nos últimos
 * `period` pregões, suavizada a cada pregão novo. 100 só com altas, 0 só com quedas, 50 parado.
 * Null com menos de `period + 1` fechamentos.
 */
export function rsi(closes: readonly number[], period: number = HEAT.rsiPeriod): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gain += change;
    else loss -= change;
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

/** O nível pela nota: abaixo de 20, 40; até 60, 80; acima de 80. */
export function heatLevel(score: number): HeatLevel {
  if (score < 20) return "medo-extremo";
  if (score < 40) return "medo";
  if (score <= 60) return "neutro";
  if (score <= 80) return "otimismo";
  return "euforia";
}

const clampScore = (value: number) => Math.min(100, Math.max(0, value));
const fromRatio = (ratio: number, span: number) => clampScore(50 + (50 * ratio) / span);
const percent1 = (fraction: number) =>
  `${Math.abs(fraction * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

/**
 * O termômetro do ativo agora, ou null com menos de dois componentes de preço. `series` são os
 * fechamentos diários terminando no preço atual (`closesWithQuote`); `move` é o movimento em 7 dias
 * (com o índice, conta a diferença para ele); `tone`, o sentido da leitura da semana ("sem_fato" e
 * null ficam de fora).
 */
export function assetHeat(input: {
  ticker: string;
  series: readonly DailyClose[];
  assetClass: AssetClass | null;
  move: WeekMove | null;
  tone: WeekTone | null;
}): AssetHeat | null {
  const span = HEAT.span[input.assetClass ?? "ACAO"];
  const closes = input.series.map((point) => point.close);
  const factors: HeatFactor[] = [];
  const add = (id: HeatFactorId, score: number, detail: string) =>
    factors.push({ id, label: FACTOR_LABELS[id], score: Math.round(score), detail });

  if (input.move) {
    const relative = input.move.change - (input.move.index?.change ?? 0);
    add("semana", fromRatio(relative, span), weekMoveText(input.ticker, input.move));
  }
  const strength = rsi(closes);
  if (strength !== null) {
    add(
      "ifr",
      strength,
      `IFR de ${HEAT.rsiPeriod} pregões: ${Math.round(strength)} de 100. Abaixo de 30, as quedas pesaram mais que as altas; acima de 70, o contrário.`,
    );
  }
  if (closes.length >= HEAT.minAveragePoints) {
    const window = closes.slice(-HEAT.averagePoints);
    const average = window.reduce((sum, close) => sum + close, 0) / window.length;
    const distance = average > 0 ? closes.at(-1)! / average - 1 : 0;
    const where =
      Math.abs(distance) < 0.0005
        ? `Preço na média dos últimos ${window.length} pregões.`
        : `Preço ${percent1(distance)} ${distance < 0 ? "abaixo" : "acima"} da média dos últimos ${window.length} pregões.`;
    add("media", fromRatio(distance, span), where);
  }
  if (factors.length < 2) return null;
  if (input.tone && input.tone !== "sem_fato") {
    add(
      "noticias",
      HEAT.newsScore[input.tone],
      `Tom das notícias da semana: ${TONE_WORDS[input.tone]}.`,
    );
  }
  let total = 0;
  let weight = 0;
  for (const factor of factors) {
    total += HEAT.weights[factor.id] * factor.score;
    weight += HEAT.weights[factor.id];
  }
  const score = Math.round(total / weight);
  const level = heatLevel(score);
  return { score, level, label: HEAT_LABELS[level], factors };
}
