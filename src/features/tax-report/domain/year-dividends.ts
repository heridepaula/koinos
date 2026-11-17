import type { DividendEntry } from "@/features/transactions";
import { round2 } from "./format";
import { receitaCodesFor } from "./receita-codes";
import type { DividendFiscalItem, FiscalClass } from "./types";

/**
 * Alíquota de IRRF sobre o JCP pela data de pagamento do extrato: 15% até 2025 e 17,5% a partir
 * de 1º/1/2026 (LC 224/2025). A taxa se confirma nos extratos reais (retenção ~15% até 2025 e
 * ~17,4–17,9% em 2026, a diferença vem do arredondamento do bruto por cota). A vigência exata
 * (data do pagamento ou do crédito) não foi confirmada no texto da lei, então a regra usa a data
 * de pagamento do extrato.
 */
export function jcpWithholdingRate(paidAt: Date): number {
  return paidAt.getTime() < Date.UTC(2026, 0, 1) ? 0.15 : 0.175;
}

/**
 * O JCP vem líquido da retenção na fonte, então o bruto é líquido ÷ (1 − taxa), ao centavo (o
 * bruto por cota da B3 pode vir arredondado e não serve de base). Com bruto por cota e
 * quantidade, eles só conferem: `offRange` quando quantidade × bruto por cota × (1 − taxa) difere
 * do líquido em mais de max(R$ 0,05; 1% do líquido). Sem eles não há como conferir.
 */
export function grossUpJcp(
  net: number,
  perShare: number | null = null,
  quantity: number | null = null,
  rate = 0.15,
): { gross: number; withheld: number; offRange: boolean } {
  const gross = round2(net / (1 - rate));
  const withheld = round2(gross - net);
  let offRange = false;
  if (perShare !== null && quantity !== null && perShare > 0 && quantity > 0) {
    const tolerance = Math.max(0.05, Math.abs(net) * 0.01);
    offRange = Math.abs(round2(perShare * quantity * (1 - rate)) - net) > tolerance;
  }
  return { gross, withheld, offRange };
}

export type UnclassifiedReason = "REEMBOLSO" | "ALUGUEL" | "SEM_CLASSE" | "TIPO_FORA_DA_FICHA";

export type UnclassifiedDividend = {
  ticker: string;
  kind: string;
  month: string;
  amount: number;
  reason: UnclassifiedReason;
};

export type YearDividends = {
  exempt: DividendFiscalItem[];
  exclusive: DividendFiscalItem[];
  unclassified: UnclassifiedDividend[];
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
    paidAt: Date,
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
      const g = grossUpJcp(net, perShare, quantity, jcpWithholdingRate(paidAt));
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
    const month = `${year}-${String(d.paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const out = (reason: UnclassifiedReason) =>
      unclassified.push({ ticker: d.ticker, kind: d.kind, month, amount: d.amount, reason });
    if (d.kind === "REEMBOLSO" || d.kind === "ALUGUEL") {
      out(d.kind);
      continue;
    }
    const assetClass = classOf(d.ticker);
    if (!assetClass) {
      out("SEM_CLASSE");
      continue;
    }
    const known =
      (d.kind === "DIVIDENDO" && assetClass === "ACAO") ||
      (d.kind === "RENDIMENTO" && assetClass === "FII") ||
      (d.kind === "JCP" && assetClass === "ACAO");
    if (!known) {
      out("TIPO_FORA_DA_FICHA");
      continue;
    }
    const cnpj = cnpjOf(d.ticker);
    add(cnpj ?? d.ticker, d.ticker, cnpj, d.kind, d.amount, d.perShare, d.quantity, d.paidAt);
  }

  const items = [...groups.values()].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return {
    exempt: items.filter((i) => i.sheet === "ISENTO"),
    exclusive: items.filter((i) => i.sheet === "EXCLUSIVA"),
    unclassified,
    jcpOffRange: [...jcpOffRange].sort(),
  };
}
