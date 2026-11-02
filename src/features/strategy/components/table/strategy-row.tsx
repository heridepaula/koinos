"use client";

import { Trash2Icon } from "lucide-react";
import type { StrategyRow as StrategyRowData } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { TableCell, TableRow } from "@/shared/ui/table";
import { BiasSelect } from "./bias-select";
import { CategorySelect } from "./category-select";
import { CATEGORY_LABELS } from "../../domain/categories";
import { suggestedPercentProblem } from "../../domain/quarantine";
import { CeilingCheckIcon } from "../ceiling-check-icon";
import { MoneyField } from "./money-field";
import { NumberField } from "./number-field";
import { MarginValue, WeightValue } from "./read-only-cells";
import { useTargetRow } from "./use-target-row";

/**
 * Linha editável da tabela (a partir de 900 px de card), com as mesmas 12 colunas para FIIs e
 * ações. `stock` só troca a Categoria, que na ação é fixa.
 */
export function StrategyRow({ row, stock = false }: { row: StrategyRowData; stock?: boolean }) {
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
          value={row.rank}
          onCommit={(value) => save({ rank: value })}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {/* O espaço do triângulo fica reservado, para os campos alinharem com ou sem aviso. */}
          <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
            {row.ceilingCheck && row.ceilingPrice !== null ? (
              <CeilingCheckIcon
                check={row.ceilingCheck}
                ceiling={row.ceilingPrice}
                price={row.price}
              />
            ) : null}
          </span>
          <MoneyField
            label="Preço teto"
            className="w-28"
            value={row.ceilingPrice}
            onCommit={(value) => save({ ceilingPrice: value })}
          />
        </div>
      </TableCell>
      <TableCell>
        <NumberField
          label="% sugerida"
          className="w-16"
          value={row.suggestedPercent}
          validate={(value) => suggestedPercentProblem(value, row.inStrategy)}
          onCommit={(value) => save({ suggestedPercent: value })}
        />
      </TableCell>
      <TableCell>
        {stock ? (
          // A ação só tem a categoria "Ação": texto no lugar do select, com a mesma largura e o
          // mesmo recuo, para a coluna ficar igual à da aba FIIs.
          <span className="inline-block w-36 border border-transparent pl-3 text-sm">
            {CATEGORY_LABELS.ACAO}
          </span>
        ) : (
          <CategorySelect
            row={row}
            quiet="table"
            className="w-36"
            onChange={(category) => save({ category })}
          />
        )}
      </TableCell>
      <TableCell>
        <BiasSelect row={row} quiet="table" className="w-32" onChange={(bias) => save({ bias })} />
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
