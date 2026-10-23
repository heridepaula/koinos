"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useTransition } from "react";
import { formatMonth } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Mês do relatório na URL (?mes=). shallow: false faz o servidor montar a tela do mês novo.
 * `months` vem do mais recente ao mais antigo.
 *
 * O seletor mostra na hora o mês escolhido (o da URL), sem esperar o servidor: sem isso, o
 * select controlado voltava ao mês antigo até a resposta chegar, e pelo teclado só andava um
 * mês por requisição. Enquanto o mês novo carrega, um indicador avisa.
 */
export function MonthPicker({ month, months }: { month: string; months: readonly string[] }) {
  const [loading, startTransition] = useTransition();
  const [requested, setMonth] = useQueryState(
    "mes",
    parseAsString.withOptions({ shallow: false, history: "replace", startTransition }),
  );
  const shown = requested && months.includes(requested) ? requested : month;
  const index = months.indexOf(shown);
  const newer = index > 0 ? months[index - 1] : undefined;
  const older = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;
  return (
    <div className="flex items-center gap-2" aria-busy={loading}>
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
        value={shown}
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
      {loading ? <Spinner className="text-muted-foreground" aria-label="Carregando o mês" /> : null}
    </div>
  );
}
