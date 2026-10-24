"use client";

import { ChevronDownIcon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import type { StrategyRow } from "@/features/portfolio";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { setSuggestedPercentsAction } from "../../actions";
import type { PercentFix } from "../../domain/weights";

const percentText = (value: number) => formatPercent(value / 100, 1);

/**
 * Quando as % sugeridas não somam 100%: quanto falta (ou sobra), a sugestão e o botão que grava o
 * ajuste. A lista de cada FII fica num recolhível: com 21 ativos, ela tomava a tela do celular.
 */
export function PercentFixPanel({ rows, fixes }: { rows: StrategyRow[]; fixes: PercentFix[] }) {
  const apply = useAction(setSuggestedPercentsAction, {
    onSuccess: () => toast.success("% sugeridas ajustadas: a soma fecha 100%."),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const sum = rows
    .filter((row) => row.inStrategy)
    .reduce((acc, row) => acc + (row.suggestedPercent ?? 0), 0);
  const rest = 100 - sum;
  const fillsMissing = fixes.every((fix) => fix.from === null);

  return (
    <div className="mx-(--card-spacing) mb-4 grid gap-3 rounded-xl border border-warn/30 bg-warn/8 p-4 text-sm">
      <p className="flex items-start gap-3">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
        <span>
          As % sugeridas somam <strong className="tabular-nums">{percentText(sum)}</strong>:{" "}
          {rest > 0
            ? `faltam ${percentText(rest)} para 100%.`
            : `passam ${percentText(-rest)} de 100%.`}{" "}
          {fillsMissing
            ? "Sugestão: dividir o que falta igualmente entre os ativos sem %."
            : "Sugestão: ajustar cada % na mesma proporção."}
        </span>
      </p>
      <details className="group pl-7">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Ver o ajuste de cada FII ({fixes.length})
          <ChevronDownIcon
            className="size-4 transition-transform duration-420 ease-snappy group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-1 tabular-nums">
          {fixes.map((fix) => (
            <li key={fix.ticker}>
              <span className="font-medium">{fix.ticker}</span>{" "}
              <span className="text-muted-foreground">
                {fix.from === null ? "sem %" : percentText(fix.from)} →
              </span>{" "}
              {percentText(fix.to)}
            </li>
          ))}
        </ul>
      </details>
      <div className="pl-7">
        <Button
          variant="outline"
          size="sm"
          disabled={apply.isPending}
          onClick={() =>
            apply.execute({
              items: fixes.map((fix) => ({ ticker: fix.ticker, suggestedPercent: fix.to })),
            })
          }
        >
          <WandSparklesIcon />
          Aplicar ajuste
        </Button>
      </div>
    </div>
  );
}
