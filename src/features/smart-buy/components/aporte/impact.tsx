"use client";

import type { ReactNode } from "react";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
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

const pct = (value: number | null) => (value === null ? "—" : formatPercent(value, 1));

/** As três linhas antes ➔ depois, para a dica da tabela. */
export function impactText(impact: OrderImpact): string {
  const pm =
    impact.averagePriceBefore === null
      ? `posição nova, PM ${formatBRL(impact.averagePriceAfter)}`
      : `PM ${formatBRL(impact.averagePriceBefore)} ➔ ${formatBRL(impact.averagePriceAfter)}`;
  const parts = [pm];
  if (impact.yieldOnCostAfter !== null) {
    parts.push(`YOC ${pct(impact.yieldOnCostBefore)} ➔ ${pct(impact.yieldOnCostAfter)}`);
  }
  if (impact.resultPercentBefore !== null) {
    parts.push(`L/P ${pct(impact.resultPercentBefore)} ➔ ${pct(impact.resultPercentAfter)}`);
  }
  return `Depois desta ordem: ${parts.join(" · ")}.`;
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

/** "Depois desta ordem" no desktop (linha expandida): renda primeiro, o peso com a meta, e os do PM. */
export function ImpactList({
  impact,
  weightBefore,
  weightAfter,
  targetWeight,
}: {
  impact: OrderImpact | undefined;
  weightBefore: number;
  weightAfter: number;
  targetWeight: number;
}) {
  const percent = (value: number) => formatPercent(value, 1);
  const rows: { label: string; value: ReactNode }[] = [];
  if (impact) {
    rows.push({
      label: "Renda/mês a mais",
      value:
        impact.monthlyIncome === null ? (
          "sem dado"
        ) : (
          <span className="text-gain">
            +<Sensitive>{formatBRL(impact.monthlyIncome)}</Sensitive>
          </span>
        ),
    });
  }
  rows.push({
    label: "Peso na carteira",
    value: (
      <>
        {percent(weightBefore)} ➔ {percent(weightAfter)}
        <span className="text-muted-foreground"> (meta {percent(targetWeight)})</span>
      </>
    ),
  });
  if (impact) {
    rows.push({
      label: "Preço médio",
      value: (
        <Transition
          before={impact.averagePriceBefore}
          after={impact.averagePriceAfter}
          format={formatBRL}
          better="down"
          sensitive
        />
      ),
    });
    if (impact.yieldOnCostAfter !== null) {
      rows.push({
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
        label: "L/P",
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
  }
  return (
    <div className="grid gap-2">
      <p className="text-footnote font-semibold">Depois desta ordem</p>
      <dl className="grid gap-1.5 text-subheadline">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {impact ? (
        <p className="text-footnote text-muted-foreground">
          {impact.averagePriceBefore === null ? "Posição nova." : RESULT_NOTE}
        </p>
      ) : null}
    </div>
  );
}
