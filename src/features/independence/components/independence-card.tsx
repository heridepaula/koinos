import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Sensitive } from "@/shared/components/sensitive";
import { formatCompactBRL, formatPercent } from "@/shared/lib/format";
import type { IndependenceSummary } from "../domain/types";
import { shortForecast } from "./format";
import { ProgressBar } from "./progress-bar";

/**
 * A meta no topo do Dashboard: uma linha discreta, sem card. No iPhone, o rótulo, a barra fina e a
 * %; a partir do `sm`, também o montante e a idade prevista: "22,8% de R$ 4,4 mi · aos ~55". Os
 * detalhes ficam em /independencia. A linha inteira é o link; no toque, a área tem 44 px.
 */
export function IndependenceCard({
  summary,
  needsUpdate = false,
}: {
  summary: IndependenceSummary | null;
  /** Um plano da v1 salvo: a meta ganhou perguntas novas. */
  needsUpdate?: boolean;
}) {
  return (
    <Link
      href="/independencia"
      className="relative mt-2 mb-3 flex h-5 w-fit max-w-full items-center gap-2 rounded-md text-footnote text-muted-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-3 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="shrink-0">Independência financeira</span>
      {summary ? (
        <>
          <ProgressBar
            value={summary.progress}
            label="Progresso da independência financeira"
            className="h-1 w-20 shrink-0 sm:w-28"
          />
          <span className="shrink-0 font-medium text-foreground tabular-nums">
            {formatPercent(summary.progress, 1)}
          </span>
          <span className="truncate tabular-nums max-sm:hidden">
            de <Sensitive>{formatCompactBRL(summary.target)}</Sensitive> · {shortForecast(summary)}
          </span>
        </>
      ) : (
        <span className="font-medium text-foreground">
          {needsUpdate ? "Atualizar meta" : "Definir meta"}
        </span>
      )}
      <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
    </Link>
  );
}
