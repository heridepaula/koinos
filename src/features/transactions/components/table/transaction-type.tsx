import { Badge } from "@/shared/ui/badge";
import { TRANSACTION_KIND_LABELS } from "../../domain/types";
import type { TransactionRow } from "../types";

export const KIND_LABELS = TRANSACTION_KIND_LABELS;

/**
 * Tipo do lançamento: compra em azul tingido e venda em cinza (cor só para separar, sem ganho ou
 * perda), o tipo especial em texto secundário e a origem (B3 ou planilha).
 */
export function TransactionType({
  row,
}: {
  row: Pick<TransactionRow, "type" | "kind" | "source">;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {row.type === "BUY" ? (
        <Badge variant="secondary" className="bg-info/8 text-info">
          Compra
        </Badge>
      ) : (
        <Badge variant="secondary">Venda</Badge>
      )}
      {row.kind !== "NEGOCIO" ? (
        <span className="text-caption text-muted-foreground">{KIND_LABELS[row.kind]}</span>
      ) : null}
      {row.source === "B3" ? (
        <Badge variant="outline">B3</Badge>
      ) : row.source === "PLANILHA" ? (
        <span className="text-caption text-muted-foreground">planilha</span>
      ) : null}
    </span>
  );
}
