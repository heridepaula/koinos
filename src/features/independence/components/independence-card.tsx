import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sensitive } from "@/shared/components/sensitive";
import { formatCompactBRL, formatPercent } from "@/shared/lib/format";
import type { IndependenceSummary } from "../domain/types";
import { ProgressBar } from "./progress-bar";

const LINK =
  "relative rounded-xl text-footnote text-muted-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** Um dos três números da faixa: o nome pequeno e o valor compacto embaixo. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-caption">{label}</dt>
      <dd className="text-headline font-semibold text-foreground tabular-nums">
        <Sensitive>{formatCompactBRL(value)}</Sensitive>
      </dd>
    </div>
  );
}

/**
 * A meta no topo do Dashboard: uma faixa sem card, em tipo pequeno. No alto, o nome e o progresso;
 * embaixo, a barra e os três números que importam: o montante necessário, o que a meta rende por
 * mês e o que dele é reinvestido. A faixa inteira é o link para /independencia (dono, 2026-11-07).
 * Sem meta, vira uma linha com o convite.
 */
export function IndependenceCard({
  summary,
  needsUpdate = false,
}: {
  summary: IndependenceSummary | null;
  /** Um plano da v1 salvo: a meta ganhou perguntas novas. */
  needsUpdate?: boolean;
}) {
  if (!summary) {
    return (
      <Link
        href="/independencia"
        className={`${LINK} mt-2 mb-3 flex h-5 w-fit max-w-full items-center gap-2`}
      >
        <span className="shrink-0">Independência financeira</span>
        <span className="font-medium text-foreground">
          {needsUpdate ? "Atualizar meta" : "Definir meta"}
        </span>
        <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </Link>
    );
  }
  const row = (children: ReactNode) => (
    <div className="flex items-center justify-between gap-3">{children}</div>
  );
  return (
    <Link href="/independencia" className={`${LINK} mt-2 mb-3 grid max-w-xl gap-2`}>
      {row(
        <>
          <span>Independência financeira</span>
          <span className="flex items-center gap-1">
            <span className="font-medium text-foreground tabular-nums">
              {formatPercent(summary.progress, 1)}
            </span>
            <ChevronRightIcon aria-hidden="true" className="size-3.5" />
          </span>
        </>,
      )}
      <ProgressBar
        value={summary.progress}
        label="Progresso da independência financeira"
        className="h-1.5"
      />
      <dl className="grid grid-cols-3 gap-3">
        <Figure label="Montante" value={summary.target} />
        <Figure label="Rende/mês" value={summary.monthlyYield} />
        <Figure label="Reinveste" value={summary.reinvestment} />
      </dl>
    </Link>
  );
}
