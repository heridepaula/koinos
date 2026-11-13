import { parseBrDate, parseBrNumber } from "./fundamentus";

// Indicadores das páginas públicas `detalhes.php` do Fundamentus (spec radar-fundamentos). A
// página não tem API: lê pares rótulo → valor e recusa a página que não tiver os rótulos de sempre.

export type StockIndicators = {
  kind: "ACAO";
  sector: string | null;
  subsector: string | null;
  /** "Últ balanço processado". */
  balanceDate: Date | null;
  pl: number | null;
  pvp: number | null;
  /** Frações (0.05 = 5%). */
  netMargin: number | null;
  ebitMargin: number | null;
  roe: number | null;
  roic: number | null;
  netDebtToEquity: number | null;
  currentRatio: number | null;
  revenueGrowth5y: number | null;
  /** Lucro líquido dos últimos 12 meses, em R$. */
  netIncome12m: number | null;
};

export type FiiIndicators = {
  kind: "FII";
  ffoYield: number | null;
  capRate: number | null;
  propertyCount: number | null;
  /** "Últ Info Trimestral". */
  quarterlyReport: Date | null;
};

const PAIR =
  /<span class="txt">([^<]+)<\/span><\/td>\s*<td[^>]*>\s*<span class="(?:txt|oscil)">\s*(?:<a [^>]*>)?\s*(?:<font[^>]*>)?\s*([^<]*)/g;

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();

/** Rótulo → valor, o primeiro de cada rótulo (os 12 meses vêm antes dos 3 meses). */
export function labelValues(html: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of html.matchAll(PAIR)) {
    const label = decode(match[1]);
    if (!values.has(label)) values.set(label, decode(match[2]));
  }
  return values;
}

const number = (text: string | undefined) =>
  text === undefined ? null : parseBrNumber(text.replace(/%$/, ""));

const percent = (text: string | undefined) => {
  if (text === undefined || !text.trim().endsWith("%")) return null;
  const value = parseBrNumber(text.trim().slice(0, -1));
  // toFixed: 9,2 ÷ 100 dá 0,09199999… em ponto flutuante; o Fundamentus tem no máximo 2 casas.
  return value === null ? null : Number((value / 100).toFixed(6));
};

/** O Fundamentus mostra 0 onde não há dado (bancos, papel): zero conta como ausente. */
const nonZero = (value: number | null) => (value === 0 ? null : value);

/** Margem: zero (banco) ou acima de 100% (holding) não descreve a operação. */
const margin = (text: string | undefined) => {
  const value = percent(text);
  return value === null || value === 0 || value > 1 ? null : value;
};

const date = (text: string | undefined) => (text ? parseBrDate(text) : null);

function requireLabels(values: Map<string, string>, first: string) {
  if (!values.has(first) || !values.has("Cotação")) {
    throw new Error(`Fundamentus: página sem os rótulos esperados ("${first}", "Cotação")`);
  }
}

export function parseStockDetails(html: string): StockIndicators {
  const values = labelValues(html);
  requireLabels(values, "Papel");
  return {
    kind: "ACAO",
    sector: values.get("Setor") || null,
    subsector: values.get("Subsetor") || null,
    balanceDate: date(values.get("Últ balanço processado")),
    pl: number(values.get("P/L")),
    pvp: number(values.get("P/VP")),
    netMargin: margin(values.get("Marg. Líquida")),
    ebitMargin: margin(values.get("Marg. EBIT")),
    roe: percent(values.get("ROE")),
    roic: percent(values.get("ROIC")),
    netDebtToEquity: nonZero(number(values.get("Dív Líq / Patrim"))),
    currentRatio: nonZero(number(values.get("Liquidez Corr"))),
    revenueGrowth5y: percent(values.get("Cres. Rec (5a)")),
    netIncome12m: number(values.get("Lucro Líquido")),
  };
}

export function parseFiiDetails(html: string): FiiIndicators {
  const values = labelValues(html);
  requireLabels(values, "FII");
  return {
    kind: "FII",
    ffoYield: percent(values.get("FFO Yield")),
    capRate: nonZero(percent(values.get("Cap Rate"))),
    propertyCount: nonZero(number(values.get("Qtd imóveis"))),
    quarterlyReport: date(values.get("Últ Info Trimestral")),
  };
}
