import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL } from "@/shared/lib/format";

/** Uma linha de dinheiro: a data e o tipo à esquerda, o valor (e o por cota) à direita. */
export function MoneyRow({
  date,
  detail,
  amount,
  perShare,
  unit,
}: {
  date: string;
  detail: string;
  amount: number;
  perShare: number | null;
  /** "por cota" ou "por ação". */
  unit: string;
}) {
  return (
    <li className="flex min-h-13 items-center justify-between gap-4 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="font-medium">{date}</span>
        <span className="truncate text-footnote text-muted-foreground">{detail}</span>
      </div>
      <div className="grid justify-items-end gap-0.5 text-right tabular-nums">
        <span className="font-medium">
          <Sensitive>{formatBRL(amount)}</Sensitive>
        </span>
        {perShare !== null ? (
          <span className="text-footnote text-muted-foreground">
            {formatBRL(perShare)} {unit}
          </span>
        ) : null}
      </div>
    </li>
  );
}
