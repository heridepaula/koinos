"use client";

import { Trash2Icon } from "lucide-react";
import type { StrategyRow as StrategyRowData } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { TableCell, TableRow } from "@/shared/ui/table";
import { CategorySelect } from "./category-select";
import { NumberField } from "./number-field";
import { MarginValue, WeightValue } from "./read-only-cells";
import { useTargetRow } from "./use-target-row";

/** Linha editável da tabela (a partir de 900 px de card). */
export function StrategyRow({ row }: { row: StrategyRowData }) {
  const { save, remove, removing } = useTargetRow(row.ticker);
  return (
    <TableRow className={row.inStrategy ? undefined : "text-muted-foreground"}>
      <TableCell className="sticky left-0 z-10 bg-card pl-(--card-spacing)">
        <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${row.ticker} na estratégia`}
          checked={row.inStrategy}
          onCheckedChange={(checked) => save({ inStrategy: checked })}
        />
      </TableCell>
      <TableCell>
        <NumberField
          label="Rank"
          integer
          className="w-14"
          value={row.sunoRank}
          onCommit={(value) => save({ sunoRank: value })}
        />
      </TableCell>
      <TableCell>
        <NumberField
          label="Preço teto"
          className="w-20"
          value={row.ceilingPrice}
          onCommit={(value) => save({ ceilingPrice: value })}
        />
      </TableCell>
      <TableCell>
        <NumberField
          label="% sugerida"
          className="w-16"
          value={row.suggestedPercent}
          onCommit={(value) => save({ suggestedPercent: value })}
        />
      </TableCell>
      <TableCell>
        <CategorySelect
          row={row}
          quiet="table"
          className="w-36"
          onChange={(category) => save({ category })}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.price === null ? "—" : formatBRL(row.price)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <MarginValue row={row} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <WeightValue row={row} />
      </TableCell>
      <TableCell>
        <PriorityBadge priority={row.priority} />
      </TableCell>
      <TableCell className="pr-(--card-spacing) text-right">
        {row.configured ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover ${row.ticker} da Carteira Alvo`}
            disabled={removing}
            onClick={remove}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
