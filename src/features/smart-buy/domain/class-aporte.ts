// Aporte nas duas carteiras (spec aporte por classe, §4.4): divide pela meta, roda uma cascata
// por carteira e passa o troco de uma para a outra.
import {
  splitByClassTarget,
  type ClassKey,
  type ClassSplit,
  type ClassTarget,
} from "./class-split";
import { STOCK_CAPS } from "./risk";
import { sunoCascade, type CascadeAsset, type CascadeResult } from "./suno-cascade";

export type ClassAporteResult = {
  split: ClassSplit;
  fii: CascadeResult;
  stock: CascadeResult;
  /** Troco que passou de uma carteira para a outra. */
  transfers: { stockToFii: number; fiiToStock: number };
  leftover: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Tem ao menos um ativo da estratégia com rank, teto e preço. */
const hasEligible = (assets: readonly CascadeAsset[]) =>
  assets.some(
    (asset) =>
      asset.weight > 0 && asset.rank !== null && asset.ceiling !== null && asset.price !== null,
  );

export function classAporte(input: {
  amount: number;
  target: ClassTarget;
  values: Record<ClassKey, number>;
  fii: readonly CascadeAsset[];
  stock: readonly CascadeAsset[];
}): ClassAporteResult {
  const canReceive: Record<ClassKey, boolean> = {
    FII: hasEligible(input.fii) && input.target.fiiPercent > 0,
    ACAO: hasEligible(input.stock) && input.target.fiiPercent < 100,
  };
  const split = splitByClassTarget({
    amount: input.amount,
    target: input.target,
    values: input.values,
    canReceive,
  });
  let stock = sunoCascade(split.ACAO.share, input.stock, STOCK_CAPS);
  // O troco das ações vai para os FIIs, se eles podem receber.
  const stockToFii = canReceive.FII ? stock.leftover : 0;
  const fii = sunoCascade(round2(split.FII.share + stockToFii), input.fii);
  let fiiToStock = 0;
  if (fii.leftover > 0 && canReceive.ACAO) {
    // O troco das ações já foi para os FIIs: a nova rodada usa o que elas gastaram + o troco dos FIIs.
    const again = sunoCascade(round2(stock.spent + fii.leftover), input.stock, STOCK_CAPS);
    if (again.spent > stock.spent) {
      fiiToStock = round2(again.spent - stock.spent);
      stock = again;
    }
  }
  return {
    split,
    fii,
    stock,
    transfers: { stockToFii: round2(stockToFii), fiiToStock },
    leftover: round2(input.amount - fii.spent - stock.spent),
  };
}
