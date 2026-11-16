import type { DividendEntry } from "@/features/transactions";
import { round2 } from "./format";
import { receitaCodesFor } from "./receita-codes";
import type { DividendFiscalItem, FiscalClass } from "./types";

/**
 * O JCP vem líquido dos 15% retidos na fonte. Com bruto por cota e quantidade (o extrato da B3 os
 * traz), o bruto é quantidade × bruto por cota e o líquido precisa ser 85% dele, com até R$ 0,02 de
 * diferença; fora disso o dado é suspeito (`offRange`). Sem eles, o bruto é líquido ÷ 0,85 e não há
 * como conferir (recompor o bruto do próprio líquido sempre fecha, então `offRange` é falso).
 */
export function grossUpJcp(
  net: number,
  perShare: number | null = null,
  quantity: number | null = null,
): { gross: number; withheld: number; offRange: boolean } {
  if (perShare !== null && quantity !== null && perShare > 0 && quantity > 0) {
    const gross = round2(perShare * quantity);
    return {
      gross,
      withheld: round2(gross - net),
      offRange: Math.abs(round2(gross * 0.85) - net) > 0.02,
    };
  }
  const gross = round2(net / 0.85);
  return { gross, withheld: round2(gross - net), offRange: false };
}

export type YearDividends = {
  exempt: DividendFiscalItem[];
  exclusive: DividendFiscalItem[];
  unclassified: { ticker: string; kind: string; month: string; amount: number }[];
  jcpOffRange: string[];
};

export function groupYearDividends(input: {
  year: number;
  dividends: readonly DividendEntry[];
  cnpjOf: (ticker: string) => string | null;
  classOf: (ticker: string) => FiscalClass | null;
}): YearDividends {
  const { year, dividends, cnpjOf, classOf } = input;
  const codes = receitaCodesFor(year);
  const groups = new Map<string, DividendFiscalItem>();
  const unclassified: YearDividends["unclassified"] = [];
  const jcpOffRange = new Set<string>();

  const add = (
    sourceKey: string,
    ticker: string,
    cnpj: string | null,
    kind: "DIVIDENDO" | "RENDIMENTO" | "JCP",
    net: number,
    perShare: number | null,
    quantity: number | null,
  ) => {
    const sheet = kind === "JCP" ? "EXCLUSIVA" : "ISENTO";
    const receita =
      kind === "JCP" ? codes.jcp : kind === "RENDIMENTO" ? codes.rendimentoFii : codes.dividendo;
    const key = `${sheet}|${receita.code}|${sourceKey}`;
    const item = groups.get(key) ?? {
      sourceKey,
      tickers: [],
      cnpj,
      sheet,
      receita,
      net: 0,
      gross: 0,
      withheld: 0,
    };
    if (!item.tickers.includes(ticker)) item.tickers.push(ticker);
    if (kind === "JCP") {
      const g = grossUpJcp(net, perShare, quantity);
      if (g.offRange) jcpOffRange.add(ticker);
      item.gross = round2(item.gross + g.gross);
      item.withheld = round2(item.withheld + g.withheld);
    } else {
      item.gross = round2(item.gross + net);
    }
    item.net = round2(item.net + net);
    groups.set(key, item);
  };

  for (const d of dividends) {
    if (d.paidAt.getUTCFullYear() !== year) continue;
    if (d.kind === "REEMBOLSO" || d.kind === "ALUGUEL") {
      unclassified.push({
        ticker: d.ticker,
        kind: d.kind,
        month: `${year}-${String(d.paidAt.getUTCMonth() + 1).padStart(2, "0")}`,
        amount: d.amount,
      });
      continue;
    }
    if (!classOf(d.ticker)) continue;
    const cnpj = cnpjOf(d.ticker);
    add(cnpj ?? d.ticker, d.ticker, cnpj, d.kind, d.amount, d.perShare, d.quantity);
  }

  const items = [...groups.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return {
    exempt: items.filter((i) => i.sheet === "ISENTO"),
    exclusive: items.filter((i) => i.sheet === "EXCLUSIVA"),
    unclassified,
    jcpOffRange: [...jcpOffRange].sort(),
  };
}
