// Valor patrimonial por cota (VP) dos FIIs, da usebolsai (informe mensal da CVM). O P/VP é
// calculado aqui, com o fechamento e o VP da mesma resposta: o `pvp` pronto da API vem arredondado
// em 2 casas e troca o multiplicador do Índice de Convicção perto de 0,95 e 1,00.

export type FiiFundamentals = {
  ticker: string;
  /** VP por cota, do informe mensal da CVM. */
  bookValuePerShare: number;
  /** Mês do informe (AAAA-MM). */
  bookValueMonth: string;
  /** Fechamento do pregão anterior ÷ VP. Null fora da faixa plausível. */
  priceToBook: number | null;
};

/** P/VP fora desta faixa é dado suspeito (fundo em liquidação, cota sem negócio). */
export const PRICE_TO_BOOK_RANGE = { min: 0.3, max: 3 } as const;

export function priceToBook(price: number | null, bookValuePerShare: number): number | null {
  if (price === null || !(price > 0) || !(bookValuePerShare > 0)) return null;
  const ratio = price / bookValuePerShare;
  return ratio >= PRICE_TO_BOOK_RANGE.min && ratio <= PRICE_TO_BOOK_RANGE.max ? ratio : null;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Lê a resposta de `GET /fiis/{ticker}`. Null quando falta o VP ou o mês de referência. */
export function parseBolsaiFii(body: unknown): FiiFundamentals | null {
  if (typeof body !== "object" || body === null) return null;
  const { ticker, book_value_per_share, reference_date, close_price } = body as Record<
    string,
    unknown
  >;
  if (typeof ticker !== "string" || !isNumber(book_value_per_share) || book_value_per_share <= 0) {
    return null;
  }
  if (typeof reference_date !== "string" || !/^\d{4}-\d{2}/.test(reference_date)) return null;
  return {
    ticker: ticker.trim().toUpperCase(),
    bookValuePerShare: book_value_per_share,
    bookValueMonth: reference_date.slice(0, 7),
    priceToBook: priceToBook(isNumber(close_price) ? close_price : null, book_value_per_share),
  };
}
