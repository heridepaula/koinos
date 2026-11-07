import { TargetIcon } from "lucide-react";
import { reasonHelp } from "@/features/smart-buy/ui";
import { EXCLUSION_LABELS } from "@/features/smart-buy";
import { BIAS_LABELS } from "@/features/strategy";
import { CeilingCheckIcon } from "@/features/strategy/ui";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { AssetOverview, StrategyRow } from "../../domain/types";
import { CardLink } from "./card-link";

const EMPTY = "—";

type Verdict = { text: string; detail: string; tone: "gain" | "loss" | "neutral" };

/** A resposta do card: entra no aporte (e em que lugar da fila) ou o motivo de ficar fora. */
function verdictOf(row: StrategyRow, kind: "FII" | "ACAO"): Verdict {
  if (!row.inStrategy) {
    return {
      text: "Fora da estratégia",
      detail: "Está na Carteira Alvo, mas fora da estratégia: não recebe aporte.",
      tone: "neutral",
    };
  }
  const priority = row.priority;
  if (!priority) return { text: "Sem prioridade", detail: "", tone: "neutral" };
  if (priority.kind === "fila") {
    return {
      text: `${priority.position}º na fila`,
      detail: "Pede compra no próximo aporte, nesta posição da fila.",
      tone: "gain",
    };
  }
  return {
    text: EXCLUSION_LABELS[priority.reason],
    detail: reasonHelp(priority.reason, [{ kind }]),
    tone: priority.reason === "ACIMA_DO_TETO" ? "loss" : "neutral",
  };
}

/**
 * O preço contra o teto, numa barra: cheia até o preço, com o teto no fim. Verde enquanto cabe
 * abaixo do teto; vermelha (e cheia) quando passa dele. Embaixo, a margem que sobra (ou quanto
 * passou) e o teto, com o triângulo de divergência quando o teto calculado discorda.
 */
function CeilingMeter({
  row,
  price,
  ceiling,
}: {
  row: StrategyRow;
  price: number;
  ceiling: number;
}) {
  const within = price <= ceiling;
  const fill = Math.min(price / ceiling, 1);
  return (
    <div className="grid gap-2">
      <div
        role="meter"
        aria-label="Preço em relação ao teto"
        aria-valuemin={0}
        aria-valuemax={ceiling}
        aria-valuenow={price}
        aria-valuetext={`Preço de ${formatBRL(price)} para um teto de ${formatBRL(ceiling)}`}
        className={cn("h-2 overflow-hidden rounded-full", within ? "bg-gain/15" : "bg-loss/15")}
      >
        <div
          className={cn("h-full rounded-full", within ? "bg-gain" : "bg-loss")}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-footnote tabular-nums">
        {within ? (
          <span className="text-muted-foreground">
            {row.marginToCeiling === null
              ? "Abaixo do teto"
              : `Margem de ${formatPercent(row.marginToCeiling, 1)}`}
          </span>
        ) : (
          <span className="text-loss">{formatBRL(price - ceiling)} acima do teto</span>
        )}
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          Teto {formatBRL(ceiling)}
          {row.ceilingCheck ? (
            <CeilingCheckIcon check={row.ceilingCheck} ceiling={ceiling} price={price} />
          ) : null}
        </span>
      </div>
    </div>
  );
}

/**
 * Aporte: a decisão de comprar mais, que é o motivo de abrir o ativo antes de um aporte. A fila (ou
 * o motivo de ficar fora) em destaque, o preço contra o teto e os números da Carteira Alvo.
 */
export function AporteCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const row = overview.strategy;
  if (!row) return null;
  const kind = overview.assetClass === "ACAO" ? "ACAO" : "FII";
  const verdict = verdictOf(row, kind);
  return (
    <MetricCard
      icon={TargetIcon}
      tile="[--tile:var(--tile-orange)]"
      label="Aporte"
      value={
        <span className="flex items-center gap-2 text-title-2">
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              verdict.tone === "gain"
                ? "bg-gain"
                : verdict.tone === "loss"
                  ? "bg-loss"
                  : "bg-muted-foreground",
            )}
          />
          {verdict.text}
        </span>
      }
      className={className}
    >
      {verdict.detail ? (
        <p className="-mt-1 mb-3 text-footnote text-muted-foreground">{verdict.detail}</p>
      ) : null}
      {row.price !== null && row.ceilingPrice !== null ? (
        <CeilingMeter row={row} price={row.price} ceiling={row.ceilingPrice} />
      ) : null}
      <StatList className={row.price !== null && row.ceilingPrice !== null ? "mt-4" : undefined}>
        {row.price === null || row.ceilingPrice === null ? (
          <StatRow
            label="Preço teto"
            value={row.ceilingPrice === null ? EMPTY : formatBRL(row.ceilingPrice)}
          />
        ) : null}
        <StatRow label="Ranking" value={row.rank === null ? EMPTY : `${row.rank}º`} />
        <StatRow label="Viés" value={row.bias ? BIAS_LABELS[row.bias] : EMPTY} />
        <StatRow
          label="Peso na estratégia"
          value={
            row.targetWeight === null ? (
              EMPTY
            ) : (
              <>
                {row.strategyWeight === null ? EMPTY : formatPercent(row.strategyWeight, 1)}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  de {formatPercent(row.targetWeight, 1)}
                </span>
              </>
            )
          }
        />
      </StatList>
      <CardLink href={`/carteira-alvo?classe=${kind === "ACAO" ? "acoes" : "fiis"}`}>
        Abrir na Carteira Alvo
      </CardLink>
    </MetricCard>
  );
}
