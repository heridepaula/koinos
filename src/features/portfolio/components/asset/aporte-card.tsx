import type { ReactNode } from "react";
import { TargetIcon } from "lucide-react";
import { CouncilLenses } from "@/features/market-data/ui";
import { reasonHelp } from "@/features/smart-buy/ui";
import { EXCLUSION_LABELS } from "@/features/smart-buy";
import { BIAS_LABELS, marginToCeiling } from "@/features/strategy";
import { CeilingCheckIcon } from "@/features/strategy/ui";
import { Disclosure } from "@/shared/components/disclosure";
import { GlossaryText } from "@/shared/components/glossary-text";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { formatBRL, formatPercent, formatTradeDate } from "@/shared/lib/format";
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
 * abaixo do teto; vermelha (e cheia) quando passa dele. As margens ficam nas linhas abaixo.
 */
function CeilingMeter({ price, ceiling }: { price: number; ceiling: number }) {
  const within = price <= ceiling;
  const fill = Math.min(price / ceiling, 1);
  return (
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
  );
}

/**
 * Um teto com a margem do preço atual até ele: (teto − preço) ÷ teto, a mesma da Carteira Alvo.
 * Abaixo do teto, "margem de X%"; acima, quanto passou, em vermelho.
 */
function CeilingValue({
  ceiling,
  price,
  icon,
}: {
  ceiling: number | null;
  price: number | null;
  icon?: ReactNode;
}) {
  if (ceiling === null) return EMPTY;
  const margin = marginToCeiling(ceiling, price);
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {formatBRL(ceiling)}
      {margin === null ? null : margin >= 0 ? (
        <span className="font-normal text-muted-foreground">
          {" "}
          · margem de {formatPercent(margin, 1)}
        </span>
      ) : (
        <span className="font-normal text-loss"> · {formatPercent(-margin, 1)} acima</span>
      )}
    </span>
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
  const radar = overview.radar;
  const thesis = radar?.thesis ?? null;
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
      {radar && thesis ? (
        <div className="mb-3 grid gap-2">
          <p className="text-subheadline text-pretty">
            <GlossaryText text={thesis.verdict} assetClass={radar.kind} />
          </p>
          <Disclosure summary="Lentes e indicadores" summaryClassName="text-subheadline">
            <div className="grid gap-3">
              {thesis.sentences.map((sentence) => (
                <p key={sentence} className="text-subheadline text-pretty">
                  <GlossaryText text={sentence} assetClass={radar.kind} />
                </p>
              ))}
              <CouncilLenses lenses={thesis.lenses} assetClass={radar.kind} />
              {radar.chips.length > 0 ? (
                <p className="text-footnote text-muted-foreground tabular-nums">
                  {radar.chips.map((chip) => `${chip.label} ${chip.value}`).join(" · ")}
                </p>
              ) : null}
              <p className="text-footnote text-pretty text-muted-foreground">
                Texto gerado por IA (Gemini) em {formatTradeDate(thesis.generatedAt)} a partir dos
                sinais do método da sua Carteira Alvo e dos indicadores públicos. Pode conter erros
                e não é recomendação. Fonte: Fundamentus.
              </p>
            </div>
          </Disclosure>
        </div>
      ) : null}
      {row.price !== null && row.ceilingPrice !== null ? (
        <CeilingMeter price={row.price} ceiling={row.ceilingPrice} />
      ) : null}
      <StatList className={row.price !== null && row.ceilingPrice !== null ? "mt-4" : undefined}>
        <StatRow
          label="Teto cadastrado"
          value={<CeilingValue ceiling={row.ceilingPrice} price={row.price} />}
        />
        {kind === "FII" ? (
          <StatRow
            label="Teto calculado"
            value={
              <CeilingValue
                ceiling={row.calculatedCeiling?.calculated ?? null}
                price={row.price}
                icon={
                  row.ceilingCheck && row.ceilingPrice !== null ? (
                    <CeilingCheckIcon
                      check={row.ceilingCheck}
                      ceiling={row.ceilingPrice}
                      price={row.price}
                    />
                  ) : undefined
                }
              />
            }
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
