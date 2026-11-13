import type { DailyClose } from "../ports";
import type { AssetClass } from "./asset-class";
import { INDEX_NAMES, marketReading, movementText, type MarketReadingKind } from "./day-insight";
import type { IndexClose, MarketIndexId } from "./market-indices";

// O preço em 7 dias (spec 2026-11-13-leitura-da-semana-design.md, parte 2): a variação, a faixa
// (que a IA recebe em palavras) e a comparação com o índice, tudo calculado pelo código. A IA
// nunca recebe números de preço, então o texto dela só é refeito quando a faixa ou a leitura mudam.
// Puro.

export const WEEK_MOVE = {
  /** A janela: 7 dias corridos, a mesma das notícias. */
  days: 7,
  /** |variação| (fração) abaixo da qual a semana "ficou estável", por classe. */
  stable: { FII: 0.015, ACAO: 0.025 } satisfies Record<AssetClass, number>,
  /** |variação| (fração) a partir da qual o movimento é forte, por classe. */
  strong: { FII: 0.05, ACAO: 0.08 } satisfies Record<AssetClass, number>,
  /** O piso de `marketReading` na semana (no pregão é 1 p.p.). */
  readingFloor: 0.02,
  /** O índice "ficou estável" abaixo disso e "subiu/caiu forte" a partir disso. */
  indexStable: 0.005,
  indexStrong: 0.03,
} as const;

export type MoveBucket = "queda-forte" | "queda" | "estavel" | "alta" | "alta-forte";

export type WeekMove = {
  /** Fração: o preço atual ÷ o fechamento de referência − 1. */
  change: number;
  /** O pregão de referência: o último fechamento até 7 dias antes do pregão da cotação. */
  from: Date;
  bucket: MoveBucket;
  /** O índice da classe nos mesmos pregões; null sem o histórico dele. */
  index: { id: MarketIndexId; change: number } | null;
  reading: MarketReadingKind | null;
};

const DAY_MS = 86_400_000;
const byDate = (a: DailyClose, b: DailyClose) => a.date.getTime() - b.date.getTime();

/**
 * Os fechamentos diários anteriores ao pregão da cotação, mais o preço atual nesse pregão, em
 * ordem de data. Sem cotação, só os fechamentos.
 */
export function closesWithQuote(
  closes: readonly DailyClose[],
  quote: { price: number; session: Date } | null,
): DailyClose[] {
  const sorted = [...closes].sort(byDate);
  if (!quote || !(quote.price > 0)) return sorted;
  return [
    ...sorted.filter((item) => item.date.getTime() < quote.session.getTime()),
    { date: quote.session, close: quote.price },
  ];
}

/**
 * A variação do último ponto contra o último fechamento até `days` dias antes dele (no sábado, a
 * sexta anterior). Null sem esse fechamento ou com preço inválido.
 */
export function changeOverDays(
  series: readonly DailyClose[],
  days: number = WEEK_MOVE.days,
): { change: number; from: Date } | null {
  const last = series.at(-1);
  if (!last || !(last.close > 0)) return null;
  const limit = last.date.getTime() - days * DAY_MS;
  let reference: DailyClose | null = null;
  for (const item of series) {
    if (item.date.getTime() <= limit) reference = item;
  }
  if (!reference || !(reference.close > 0)) return null;
  return { change: last.close / reference.close - 1, from: reference.date };
}

/** A faixa do movimento pela classe (sem classe, a das ações). O limite exato já conta. */
export function moveBucket(change: number, assetClass: AssetClass | null): MoveBucket {
  const kind = assetClass ?? "ACAO";
  // Arredonda em 1e-9 para 0,05 vindo como 0,04999999 cair na faixa certa.
  const magnitude = Math.round(Math.abs(change) * 1e9) / 1e9;
  if (magnitude < WEEK_MOVE.stable[kind]) return "estavel";
  const strong = magnitude >= WEEK_MOVE.strong[kind];
  if (change < 0) return strong ? "queda-forte" : "queda";
  return strong ? "alta-forte" : "alta";
}

const indexIdFor = (assetClass: AssetClass | null): MarketIndexId =>
  assetClass === "FII" ? "IFIX" : "IBOV";

/**
 * O movimento da semana do ativo: a variação em 7 dias, a faixa e, quando o índice da classe tem o
 * pregão da cotação e o de 7 dias antes, a variação dele nos mesmos pregões e a leitura (piso de
 * 2 p.p.). Null sem o fechamento de referência do ativo.
 */
export function weekMoveOf(input: {
  closes: readonly DailyClose[];
  quote: { price: number; session: Date } | null;
  assetClass: AssetClass | null;
  index: { id: MarketIndexId; closes: readonly IndexClose[] } | null;
}): WeekMove | null {
  const series = closesWithQuote(input.closes, input.quote);
  const week = changeOverDays(series);
  if (!week) return null;
  const lastDate = series.at(-1)!.date.getTime();
  let index: WeekMove["index"] = null;
  if (input.index && input.index.id === indexIdFor(input.assetClass)) {
    const indexSeries = input.index.closes
      .map(({ session, close }) => ({ date: session, close }))
      .filter((item) => item.date.getTime() <= lastDate)
      .sort(byDate);
    const sameSession = indexSeries.at(-1)?.date.getTime() === lastDate;
    const indexWeek = sameSession ? changeOverDays(indexSeries) : null;
    if (indexWeek) index = { id: input.index.id, change: indexWeek.change };
  }
  return {
    change: week.change,
    from: week.from,
    bucket: moveBucket(week.change, input.assetClass),
    index,
    reading: index ? marketReading(week.change, index.change, WEEK_MOVE.readingFloor) : null,
  };
}

/** A chave do movimento para refazer a leitura: faixa e leitura ("" sem movimento). */
export function weekMoveKey(move: WeekMove | null): string {
  return move ? `${move.bucket}:${move.reading ?? "sem-indice"}` : "";
}

/** "Em 7 dias, o IFIX caiu 1,40% e o TRXF11 caiu 12,74%, bem diferente do mercado." */
export function weekMoveText(ticker: string, move: WeekMove): string {
  if (!move.index || !move.reading) return `Em 7 dias, o ${ticker} ${movementText(move.change)}.`;
  const ending =
    move.reading === "acompanhou" ? "acompanhando o mercado" : "bem diferente do mercado";
  return `Em 7 dias, o ${INDEX_NAMES[move.index.id]} ${movementText(move.index.change)} e o ${ticker} ${movementText(move.change)}, ${ending}.`;
}

const BUCKET_WORDS: Record<MoveBucket, string> = {
  "queda-forte": "caiu forte",
  queda: "caiu",
  estavel: "ficou estável",
  alta: "subiu",
  "alta-forte": "subiu forte",
};

const INDEX_DESCRIPTIONS: Record<MarketIndexId, string> = {
  IFIX: "IFIX, o índice dos fundos imobiliários,",
  IBOV: "Ibovespa, o índice das ações,",
};

const indexWords = (change: number) => {
  const magnitude = Math.abs(change);
  if (magnitude < WEEK_MOVE.indexStable) return "ficou estável";
  const verb = change > 0 ? "subiu" : "caiu";
  return `${verb} ${magnitude >= WEEK_MOVE.indexStrong ? "forte" : "pouco"}`;
};

/**
 * Os fatos do preço para o prompt, em palavras e sem números (a tela mostra os números):
 * "Preço em 7 dias: caiu forte. IFIX, o índice dos fundos imobiliários, no período: caiu pouco.
 * O ativo se moveu bem diferente do mercado."
 */
export function weekMoveFacts(move: WeekMove | null, assetClass: AssetClass | null): string {
  if (!move) return "Preço em 7 dias: sem dado.";
  const index = INDEX_DESCRIPTIONS[indexIdFor(assetClass)];
  const parts = [
    `Preço em 7 dias: ${BUCKET_WORDS[move.bucket]}.`,
    `${index} no período: ${move.index ? indexWords(move.index.change) : "sem dado"}.`,
  ];
  if (move.reading === "acompanhou") parts.push("O ativo acompanhou o mercado.");
  if (move.reading === "descolou") parts.push("O ativo se moveu bem diferente do mercado.");
  return parts.join(" ");
}
