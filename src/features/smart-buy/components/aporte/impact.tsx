"use client";

import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { OrderImpact } from "../../domain/aporte-impact";

// O impacto de cada ordem na tela (spec impacto-do-aporte): o selo da renda na linha e o bloco
// "Depois desta ordem" no porquê.

/** A chave de uma ordem nas duas carteiras: o mesmo ticker não se repete dentro da classe. */
export const impactKey = (kind: "FII" | "ACAO", ticker: string) => `${kind}:${ticker}`;

/** Em R$, comprar ao preço atual não muda o resultado da posição; só o % se dilui. */
export const RESULT_NOTE =
  "Em R$, o resultado da posição não muda: a compra ao preço atual só dilui o %.";

/** "+R$ 13,20/mês estim.", discreto, ao lado do total da ordem. Sem dado, nada. */
export function IncomeBadge({ impact, className }: { impact?: OrderImpact; className?: string }) {
  if (!impact || impact.monthlyIncome === null) return null;
  return (
    <span className={cn("text-caption whitespace-nowrap text-gain tabular-nums", className)}>
      +<Sensitive>{formatBRL(impact.monthlyIncome)}</Sensitive>/mês estim.
    </span>
  );
}

/** Melhorou (verde), piorou (vermelho) ou ficou igual, conforme o lado bom da métrica. */
function toneOf(before: number | null, after: number | null, better: "up" | "down") {
  if (before === null || after === null) return undefined;
  const diff = after - before;
  if (Math.abs(diff) < 1e-9) return undefined;
  return diff > 0 === (better === "up") ? "text-gain" : "text-loss";
}

function Transition({
  before,
  after,
  format,
  better,
  sensitive,
}: {
  before: number | null;
  after: number;
  format: (value: number) => string;
  better: "up" | "down";
  sensitive?: boolean;
}) {
  const wrap = (text: string) => (sensitive ? <Sensitive>{text}</Sensitive> : text);
  return (
    <span className="whitespace-nowrap">
      {before === null ? "—" : wrap(format(before))} ➔{" "}
      <span className={toneOf(before, after, better)}>{wrap(format(after))}</span>
    </span>
  );
}

/** O bloco "Depois desta ordem" da folha: preço médio, YOC, L/P % e a renda a mais. */
export function ImpactGroup({ impact }: { impact: OrderImpact }) {
  const percent = (value: number) => formatPercent(value, 1);
  return (
    <InsetGroup
      title="Depois desta ordem"
      footer={impact.averagePriceBefore === null ? "Posição nova." : RESULT_NOTE}
    >
      <InsetValueRow
        label="Renda/mês a mais"
        value={
          impact.monthlyIncome === null ? (
            "sem dado"
          ) : (
            <span className="text-gain">
              +<Sensitive>{formatBRL(impact.monthlyIncome)}</Sensitive>
            </span>
          )
        }
      />
      <InsetValueRow
        label="Preço médio"
        value={
          <Transition
            before={impact.averagePriceBefore}
            after={impact.averagePriceAfter}
            format={formatBRL}
            better="down"
            sensitive
          />
        }
      />
      {impact.yieldOnCostAfter !== null ? (
        <InsetValueRow
          label="Yield on cost"
          value={
            <Transition
              before={impact.yieldOnCostBefore}
              after={impact.yieldOnCostAfter}
              format={percent}
              better="up"
            />
          }
        />
      ) : null}
      {impact.resultPercentBefore !== null ? (
        <InsetValueRow
          label="L/P"
          value={
            <Transition
              before={impact.resultPercentBefore}
              after={impact.resultPercentAfter}
              format={percent}
              better="up"
            />
          }
        />
      ) : null}
    </InsetGroup>
  );
}

/** O ⓘ do L/P: comprar ao preço atual não muda o resultado em R$, só dilui o %. */
function ResultInfo({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={note}
            className="relative inline-flex align-middle text-muted-foreground after:absolute after:-inset-2"
          />
        }
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {note}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * "Depois desta ordem" na linha expandida (spec por-que-na-tabela §8): a renda primeiro, o preço
 * médio, o YOC e o L/P (com a nota no ⓘ). O peso fica nas colunas da tabela.
 */
export function ImpactList({ impact }: { impact: OrderImpact }) {
  const percent = (value: number) => formatPercent(value, 1);
  const rows: { label: ReactNode; key: string; value: ReactNode }[] = [
    {
      key: "renda",
      label: "Renda/mês a mais",
      value:
        impact.monthlyIncome === null ? (
          "sem dado"
        ) : (
          <span className="text-gain">
            +<Sensitive>{formatBRL(impact.monthlyIncome)}</Sensitive>
          </span>
        ),
    },
    {
      key: "pm",
      label: impact.averagePriceBefore === null ? "Preço médio (posição nova)" : "Preço médio",
      value: (
        <Transition
          before={impact.averagePriceBefore}
          after={impact.averagePriceAfter}
          format={formatBRL}
          better="down"
          sensitive
        />
      ),
    },
  ];
  if (impact.yieldOnCostAfter !== null) {
    rows.push({
      key: "yoc",
      label: "Yield on cost",
      value: (
        <Transition
          before={impact.yieldOnCostBefore}
          after={impact.yieldOnCostAfter}
          format={percent}
          better="up"
        />
      ),
    });
  }
  if (impact.resultPercentBefore !== null) {
    rows.push({
      key: "lp",
      label: (
        <span className="inline-flex items-center gap-1">
          L/P <ResultInfo note={RESULT_NOTE} />
        </span>
      ),
      value: (
        <Transition
          before={impact.resultPercentBefore}
          after={impact.resultPercentAfter}
          format={percent}
          better="up"
        />
      ),
    });
  }
  return (
    <dl className="grid gap-1.5 text-subheadline">
      {rows.map((row) => (
        <div key={row.key} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-right tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
