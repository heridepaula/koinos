"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { formatMonth } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Mês do relatório na URL (?mes=). shallow: false faz o servidor montar a tela do mês novo.
 * `months` vem do mais recente ao mais antigo.
 */
export function MonthPicker({ month, months }: { month: string; months: readonly string[] }) {
  const [, setMonth] = useQueryState(
    "mes",
    parseAsString.withOptions({ shallow: false, history: "replace" }),
  );
  const index = months.indexOf(month);
  const newer = index > 0 ? months[index - 1] : undefined;
  const older = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Mês anterior"
        disabled={!older}
        onClick={() => older && void setMonth(older)}
      >
        <ChevronLeftIcon />
      </Button>
      <select
        aria-label="Mês do relatório"
        className={selectClass}
        value={month}
        onChange={(event) => void setMonth(event.target.value)}
      >
        {months.map((key) => (
          <option key={key} value={key}>
            {formatMonth(key)}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Próximo mês"
        disabled={!newer}
        onClick={() => newer && void setMonth(newer)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
