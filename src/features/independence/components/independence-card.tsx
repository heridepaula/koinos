import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { formatPercent } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import type { IndependenceSummary } from "../domain/types";
import { forecastLine } from "./format";
import { ProgressBar } from "./progress-bar";

/** O card do Dashboard, o mais simples possível: %, barra e prazo. Os detalhes ficam na página. */
export function IndependenceCard({ summary }: { summary: IndependenceSummary | null }) {
  return (
    <Link
      href="/independencia"
      className="group/independence rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="card-lift">
        <CardContent className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-subheadline font-semibold">Independência financeira</span>
            <span className="flex items-center gap-1 text-subheadline tabular-nums">
              {summary ? formatPercent(summary.progress, 1) : "Definir meta"}
              <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            </span>
          </div>
          {summary ? (
            <>
              <ProgressBar value={summary.progress} label="Progresso da independência financeira" />
              <span className="text-footnote text-muted-foreground">{forecastLine(summary)}</span>
            </>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
