import {
  FII_CAPITAL_GAINS_RATE,
  STOCK_CAPITAL_GAINS_RATE,
  STOCK_EXEMPTION_LIMIT,
} from "@/features/portfolio";
import type { RealizedSale } from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import { round2 } from "./format";
import type { ApurationMonth, DarfMonth, FiscalClass } from "./types";

/** DARF abaixo disso não se paga: soma ao mês seguinte (Lei 10.522/2002, art. 67). */
export const DARF_MINIMUM = 10;

const RATES: Record<FiscalClass, number> = {
  FII: FII_CAPITAL_GAINS_RATE,
  ACAO: STOCK_CAPITAL_GAINS_RATE,
};

/**
 * Apuração mensal de swing trade, por classe. Passo 1 da spec do relatório de IR: sem day trade e
 * sem IRRF ("dedo-duro"). `openingLoss` é o saldo de prejuízo que entra no primeiro mês com venda
 * do livro-razão; a apuração corre desse mês até `throughMonth`, para o saldo chegar certo ao ano
 * declarado, e a tela filtra os meses do ano.
 */
export function apureMonthly(input: {
  sales: readonly RealizedSale[];
  unitPriceOf: (entryId: string) => number;
  classOf: (ticker: string) => FiscalClass | null;
  openingLoss: Record<FiscalClass, number>;
  throughMonth: string;
}): { months: ApurationMonth[]; darf: DarfMonth[]; closingLoss: Record<FiscalClass, number> } {
  const { sales, unitPriceOf, classOf, throughMonth } = input;
  const buckets = new Map<string, { sold: number; result: number }>();
  const monthSet = new Set<string>();

  for (const s of sales) {
    if (s.kind === "INCORPORACAO") continue;
    const assetClass = classOf(s.ticker);
    if (!assetClass) continue;
    const month = monthKeyOfTradeDate(s.date);
    if (month > throughMonth) continue;
    monthSet.add(month);
    const key = `${month}|${assetClass}`;
    const bucket = buckets.get(key) ?? { sold: 0, result: 0 };
    bucket.sold += s.quantity * unitPriceOf(s.entryId);
    bucket.result += s.proceeds - s.cost;
    buckets.set(key, bucket);
  }

  const loss: Record<FiscalClass, number> = { ...input.openingLoss };
  const months: ApurationMonth[] = [];
  const taxByMonth = new Map<string, number>();
  const sortedMonths = [...monthSet].sort();

  for (const month of sortedMonths) {
    for (const assetClass of ["FII", "ACAO"] as const) {
      const bucket = buckets.get(`${month}|${assetClass}`);
      if (!bucket) continue;
      const result = Math.abs(bucket.result) < 0.005 ? 0 : round2(bucket.result);
      const sold = round2(bucket.sold);
      const exempt = assetClass === "ACAO" && result > 0 && sold <= STOCK_EXEMPTION_LIMIT;
      let lossCompensated = 0;
      let taxableBase = 0;
      let tax = 0;

      if (result < 0) {
        loss[assetClass] = round2(loss[assetClass] - result);
      } else if (result > 0 && !exempt) {
        lossCompensated = round2(Math.min(loss[assetClass], result));
        taxableBase = round2(result - lossCompensated);
        tax = round2(taxableBase * RATES[assetClass]);
        loss[assetClass] = round2(loss[assetClass] - lossCompensated);
      }

      months.push({
        month,
        assetClass,
        sold,
        result,
        exempt,
        lossCompensated,
        taxableBase,
        tax,
        lossBalanceAfter: loss[assetClass],
      });
      taxByMonth.set(month, round2((taxByMonth.get(month) ?? 0) + tax));
    }
  }

  const darf: DarfMonth[] = [];
  let carried = 0;
  for (const month of sortedMonths) {
    const tax = taxByMonth.get(month) ?? 0;
    const pending = round2(carried + tax);
    if (pending >= DARF_MINIMUM) {
      darf.push({ month, tax, due: pending, carriedOut: 0 });
      carried = 0;
    } else {
      darf.push({ month, tax, due: 0, carriedOut: pending });
      carried = pending;
    }
  }

  return { months, darf, closingLoss: loss };
}
