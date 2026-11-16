import type { ReactNode } from "react";
import { QUANTITY_MASK, Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatQuantity } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { FiscalClass } from "../domain/types";

export const CLASS_LABEL: Record<FiscalClass, string> = { FII: "FIIs", ACAO: "Ações" };

/** Valor em R$ que o olho da barra esconde. */
export function Money({ value }: { value: number }) {
  return <Sensitive>{formatBRL(value)}</Sensitive>;
}

/** Quantidade de cotas ou ações, também escondida no modo privado. */
export function Qty({ value }: { value: number }) {
  return <Sensitive mask={QUANTITY_MASK}>{formatQuantity(value)}</Sensitive>;
}

/** Selo discreto: contorno e texto na cor do texto, para manter o contraste AA. */
export function Seal({ children, tone }: { children: ReactNode; tone?: "warn" }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-auto py-0.5", tone === "warn" && "text-amber-700 dark:text-amber-400")}
    >
      {children}
    </Badge>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2025-03" → "mar/2025". */
export function monthText(month: string): string {
  const [year, number] = month.split("-");
  return `${MONTHS[Number(number) - 1] ?? number}/${year}`;
}

/** "2025-04-30" → "30/04/2025". */
export function dateText(iso: string): string {
  return iso.split("-").reverse().join("/");
}
