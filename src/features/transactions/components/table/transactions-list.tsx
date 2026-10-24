"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { TransactionDialog } from "../transaction-dialog";
import type { TransactionRow } from "../types";
import { KIND_LABELS } from "./transaction-type";

const STEP = 20;

/**
 * Lista do celular, como uma tabela do iOS: cada lançamento numa célula de duas linhas (o ativo e
 * o total; o tipo, a data e cotas × preço), sem selos nem ícones. Os lançamentos manuais têm o
 * chevron e abrem a folha de edição (com o Excluir dentro); os da B3 só se leem, porque a B3
 * manda. No fim, "Mostrar mais" no lugar das páginas, como nas listas do iOS.
 */
export function TransactionsList({
  rows,
  total,
}: {
  rows: TransactionRow[];
  total: (row: TransactionRow) => number;
}) {
  const [visible, setVisible] = useState(STEP);
  const shown = rows.slice(0, visible);
  return (
    <>
      <ul className="divide-y divide-border">
        {shown.map((row) => (
          <li key={row.id}>
            {row.source === "B3" ? (
              <div className={CELL}>
                <CellContent row={row} total={total(row)} />
              </div>
            ) : (
              <TransactionDialog
                transaction={row}
                deletable
                trigger={
                  <button
                    type="button"
                    aria-label={`Editar o lançamento de ${row.ticker} de ${formatTradeDate(row.date)}`}
                    className={cn(CELL, CELL_TAPPABLE)}
                  >
                    <CellContent row={row} total={total(row)} />
                    <ChevronRightIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                }
              />
            )}
          </li>
        ))}
      </ul>
      {rows.length > visible ? (
        <div className="grid justify-items-center gap-1 px-(--card-spacing) pt-4">
          <Button variant="secondary" onClick={() => setVisible((count) => count + STEP)}>
            Mostrar mais {Math.min(STEP, rows.length - visible)}
          </Button>
          <p className="text-footnote text-muted-foreground tabular-nums">
            {visible} de {rows.length}
          </p>
        </div>
      ) : null}
    </>
  );
}

const CELL = "flex w-full items-center gap-3 px-(--card-spacing) py-3 text-left";
const CELL_TAPPABLE =
  "outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-foreground/5 active:bg-foreground/8";

function CellContent({ row, total }: { row: TransactionRow; total: number }) {
  return (
    <div className="grid min-w-0 flex-1 gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-headline">{row.ticker}</span>
        <span className="text-headline font-normal whitespace-nowrap tabular-nums">
          {formatBRL(total)}
        </span>
      </div>
      <p className="truncate text-footnote text-muted-foreground tabular-nums">
        <span className={cn("font-medium", row.type === "BUY" && "text-info")}>
          {row.type === "BUY" ? "Compra" : "Venda"}
        </span>
        {row.kind !== "NEGOCIO" ? ` · ${KIND_LABELS[row.kind]}` : ""} · {formatTradeDate(row.date)}{" "}
        · {formatQuantity(row.quantity)} × {formatBRL(row.unitPrice)}
        {row.fees > 0 ? ` · taxas ${formatBRL(row.fees)}` : ""}
      </p>
      {row.notes ? (
        <p className="truncate text-footnote text-muted-foreground">{row.notes}</p>
      ) : null}
    </div>
  );
}
