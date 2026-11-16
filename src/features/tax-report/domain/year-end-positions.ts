import { replayLedger, type LedgerEntry, type PriceSource } from "@/features/transactions";
import { formatCnpj } from "./cnpj";
import { formatMoney, formatPrice } from "./format";
import { receitaCodesFor } from "./receita-codes";
import type { AssetFiscalPosition, AssetIdentity, FiscalClass, PositionFlag } from "./types";

const EPSILON = 1e-9;

export type TaxLedgerEntry = LedgerEntry & {
  priceSource?: PriceSource | null;
  relatedTicker?: string | null;
};

/**
 * Tickers com preço de compra estimado, direto ou herdado: o destino de uma incorporação recebe o
 * custo da origem, e com ele a estimativa (mesma regra de `closed-positions.ts`, em cadeia A → B → C).
 */
function estimatedTickers(entries: readonly TaxLedgerEntry[]): Set<string> {
  const estimated = new Set(
    entries.filter((e) => e.type === "BUY" && e.priceSource === "ESTIMADO").map((e) => e.ticker),
  );
  const incorporations = entries.filter(
    (e) => e.type === "BUY" && e.kind === "INCORPORACAO" && e.relatedTicker,
  );
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of incorporations) {
      if (estimated.has(e.relatedTicker!) && !estimated.has(e.ticker)) {
        estimated.add(e.ticker);
        grew = true;
      }
    }
  }
  return estimated;
}

const endOfYear = (year: number) => Date.UTC(year, 11, 31);

/** As posições em 31/12: o livro-razão até essa data, pelo preço médio da Receita (com taxas). */
function positionsAt(entries: readonly LedgerEntry[], year: number) {
  const cutoff = endOfYear(year);
  const { positions } = replayLedger(entries.filter((e) => e.date.getTime() <= cutoff));
  return new Map(positions.map((p) => [p.ticker, p]));
}

type DiscriminationInput = {
  assetClass: FiscalClass;
  quantity: number;
  name: string | null;
  ticker: string;
  cnpj: string | null;
  cost: number;
  averagePrice: number;
};

/** Texto de modelo fixo da ficha (spec §6). Sem CNPJ não há texto: é pendência, não texto errado. */
export function discriminationOf(input: DiscriminationInput): string | null {
  if (!input.cnpj) return null;
  const unit = input.assetClass === "FII" ? "COTAS" : "AÇÕES";
  const name = (input.name ?? input.ticker).toUpperCase();
  return (
    `${input.quantity} ${unit} DE ${name} (${input.ticker}), CNPJ ${formatCnpj(input.cnpj)}. ` +
    `CUSTO TOTAL DE AQUISIÇÃO: R$ ${formatMoney(input.cost)} (PREÇO MÉDIO DE R$ ${formatPrice(input.averagePrice)}).`
  );
}

export function buildAssetPositions(input: {
  year: number;
  entries: readonly TaxLedgerEntry[];
  assetClasses: ReadonlyMap<string, FiscalClass>;
  identities: ReadonlyMap<string, AssetIdentity>;
}): AssetFiscalPosition[] {
  const { year, entries, assetClasses, identities } = input;
  const previous = positionsAt(entries, year - 1);
  const current = positionsAt(entries, year);
  const codes = receitaCodesFor(year);
  const cutoff = endOfYear(year);
  const estimated = estimatedTickers(entries.filter((e) => e.date.getTime() <= cutoff));
  const rows: AssetFiscalPosition[] = [];

  for (const ticker of new Set([...previous.keys(), ...current.keys()])) {
    const assetClass = assetClasses.get(ticker);
    if (!assetClass) continue;
    const prev = previous.get(ticker);
    const cur = current.get(ticker);
    const quantityPrevious = prev && prev.quantity > EPSILON ? prev.quantity : 0;
    const quantity = cur && cur.quantity > EPSILON ? cur.quantity : 0;
    if (quantityPrevious === 0 && quantity === 0) continue;

    const own = entries.filter((e) => e.ticker === ticker && e.date.getTime() <= cutoff);
    const flags: PositionFlag[] = [];
    if (estimated.has(ticker)) flags.push("PRECO_ESTIMADO");
    if (own.some((e) => e.kind === "POSICAO_ANTERIOR")) flags.push("POSICAO_ANTERIOR");

    const identity = identities.get(ticker);
    const name = identity?.legalName ?? identity?.name ?? null;
    const cnpj = identity?.cnpj ?? null;
    const cost = quantity > 0 ? (cur?.totalCost ?? 0) : 0;
    const averagePrice = quantity > 0 ? cost / quantity : 0;
    rows.push({
      ticker,
      assetClass,
      name,
      cnpj,
      quantityPrevious,
      costPrevious: quantityPrevious > 0 ? (prev?.totalCost ?? 0) : 0,
      quantity,
      cost,
      averagePrice,
      receita:
        assetClass === "FII" && identity?.subType?.toLowerCase() === "fi-agro"
          ? codes.fiagro
          : codes.bens[assetClass],
      discrimination:
        quantity > 0
          ? discriminationOf({ assetClass, quantity, name, ticker, cnpj, cost, averagePrice })
          : null,
      closedInYear: quantity === 0,
      flags,
    });
  }
  return rows.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
