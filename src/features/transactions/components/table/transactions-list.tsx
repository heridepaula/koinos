import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import type { TransactionRow } from "../types";
import { TransactionActions } from "./transaction-actions";
import { TransactionType } from "./transaction-type";

/**
 * Lista do celular, como uma tabela do iOS: cada lançamento numa célula de duas linhas (ativo,
 * tipo e total; data, cotas × preço e taxas) e as ações no fim. Fios de cabelo entre as células.
 */
export function TransactionsList({
  rows,
  total,
}: {
  rows: TransactionRow[];
  total: (row: TransactionRow) => number;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-(--card-spacing) py-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-subheadline font-semibold">{row.ticker}</span>
                <TransactionType row={row} />
              </div>
              <span className="text-subheadline font-semibold whitespace-nowrap tabular-nums">
                {formatBRL(total(row))}
              </span>
            </div>
            <p className="text-footnote text-muted-foreground tabular-nums">
              {formatTradeDate(row.date)} · {formatQuantity(row.quantity)} ×{" "}
              {formatBRL(row.unitPrice)}
              {row.fees > 0 ? ` · taxas ${formatBRL(row.fees)}` : ""}
            </p>
            {row.notes ? (
              <p className="truncate text-footnote text-muted-foreground">{row.notes}</p>
            ) : null}
          </div>
          <TransactionActions row={row} />
        </li>
      ))}
    </ul>
  );
}
