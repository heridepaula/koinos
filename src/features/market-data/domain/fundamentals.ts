// Dados de FII da usebolsai (informe mensal e trimestral da CVM): valor patrimonial por cota (VP),
// vacância, segmento, tipo e composição do ativo. O P/VP é calculado aqui, com o fechamento e o VP
// da mesma resposta: o `pvp` pronto da API vem arredondado em 2 casas e troca os multiplicadores
// perto dos limites.

export type FiiFundamentals = {
  ticker: string;
  /** VP por cota, do informe mensal da CVM. */
  bookValuePerShare: number;
  /** Mês do informe (AAAA-MM). */
  bookValueMonth: string;
  /** Fechamento do pregão anterior ÷ VP. Null fora da faixa plausível. */
  priceToBook: number | null;
  /** Vacância física, em % (5,2 = 5,2%). Null quando a API não informa (papel, por exemplo). */
  vacancyPct: number | null;
  /** Segmento na CVM ("Shoppings", "Logística"…; muitos vêm "Multicategoria" ou "Outros"). */
  segment: string | null;
  /** Tipo do fundo: "Tijolo", "Papel", "Híbrido", "Fiagro", "Fundo de Fundos". */
  fundType: string | null;
  /** % do ativo em recebíveis (CRI, LCI, CEPAC, debêntures) e em imóveis. Decide os híbridos. */
  paperPct: number | null;
  realEstatePct: number | null;
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

const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const PAPER_KEYS = ["cri_pct", "lci_pct", "cepac_pct", "debentures_pct"] as const;
const REAL_ESTATE_KEYS = [
  "real_estate_leased_pct",
  "real_estate_under_construction_pct",
  "real_estate_for_sale_pct",
  "land_pct",
  "other_real_estate_pct",
] as const;

/** Soma as fatias da composição; null quando nenhuma veio. */
function share(composition: unknown, keys: readonly string[]): number | null {
  if (typeof composition !== "object" || composition === null) return null;
  const values = keys.map((key) => (composition as Record<string, unknown>)[key]).filter(isNumber);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

/** Lê a resposta de `GET /fiis/{ticker}`. Null quando falta o VP ou o mês de referência. */
export function parseBolsaiFii(body: unknown): FiiFundamentals | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const { ticker, book_value_per_share, reference_date, close_price } = record;
  if (typeof ticker !== "string" || !isNumber(book_value_per_share) || book_value_per_share <= 0) {
    return null;
  }
  if (typeof reference_date !== "string" || !/^\d{4}-\d{2}/.test(reference_date)) return null;
  const vacancy = record.vacancy_pct;
  return {
    ticker: ticker.trim().toUpperCase(),
    bookValuePerShare: book_value_per_share,
    bookValueMonth: reference_date.slice(0, 7),
    priceToBook: priceToBook(isNumber(close_price) ? close_price : null, book_value_per_share),
    vacancyPct: isNumber(vacancy) && vacancy >= 0 && vacancy <= 100 ? vacancy : null,
    segment: text(record.segment),
    fundType: text(record.fund_type),
    paperPct: share(record.asset_composition, PAPER_KEYS),
    realEstatePct: share(record.asset_composition, REAL_ESTATE_KEYS),
  };
}
