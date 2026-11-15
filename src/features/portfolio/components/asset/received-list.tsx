"use client";

import { DIVIDEND_KIND_LABELS } from "@/features/transactions";
import { Pagination } from "@/shared/components/pagination";
import { usePagedRows } from "@/shared/hooks/use-paged-rows";
import { formatTradeDate } from "@/shared/lib/format";
import { PAGE_SIZES } from "@/shared/lib/paginate";
import type { AssetOverview } from "../../domain/types";
import { MoneyRow } from "./money-row";

/** Abaixo do menor tamanho de página a lista cabe inteira e o rodapé não aparece. */
const FOOTER_MIN = PAGE_SIZES[0];

type Received = AssetOverview["received"][number];

/** Os recebidos do ativo, paginados na URL (?recebidos= e ?recebidos-por=). */
export function ReceivedList({ items, unit }: { items: Received[]; unit: string }) {
  const { rows, pagination } = usePagedRows(items, { page: "recebidos", size: "recebidos-por" });

  return (
    <>
      <ul className="divide-y divide-border/70">
        {rows.map((item, index) => (
          <MoneyRow
            key={`${item.paidAt.toISOString()}-${item.kind}-${pagination.firstIndex + index}`}
            date={formatTradeDate(item.paidAt)}
            detail={DIVIDEND_KIND_LABELS[item.kind]}
            amount={item.amount}
            perShare={item.perShare}
            unit={unit}
          />
        ))}
      </ul>
      {items.length > FOOTER_MIN ? (
        <Pagination {...pagination} itemLabel="Recebidos" className="px-0" />
      ) : null}
    </>
  );
}
