import { SparklesIcon } from "lucide-react";
import { weekMoveText, type AssetClass } from "@/features/market-data";
import { DeltaChip } from "@/shared/components/delta";
import { GlossaryText } from "@/shared/components/glossary-text";
import { formatDateTime } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { AssetHeatMeter } from "./asset-heat-meter";
import { NewsSources } from "./news-sources";
import { WeekLenses } from "./week-lenses";

/** O veredito: a primeira frase em Headline, o resto em texto normal. */
function Verdict({ text, assetClass }: { text: string; assetClass: AssetClass | null }) {
  const [first, ...rest] = text.split(/(?<=[.!?])\s+/);
  return (
    <div className="grid gap-1.5 text-pretty">
      <p className="text-headline">
        <GlossaryText text={first} assetClass={assetClass} />
      </p>
      {rest.length > 0 ? (
        <p>
          <GlossaryText text={rest.join(" ")} assetClass={assetClass} />
        </p>
      ) : null}
    </div>
  );
}

/**
 * "O que aconteceu nesta semana" (spec 2026-11-13-leitura-da-semana-design.md, parte 8): o chip é a
 * variação em 7 dias; o veredito da leitura da semana vem primeiro e é o que mais aparece; depois a
 * comparação com o índice, o termômetro do momento, as lentes do conselho e as fontes, recolhidas.
 * Sem leitura (ativo fora da Carteira Alvo), o card mostra só o movimento e o termômetro; sem os
 * dois, não aparece.
 */
export function WeekSummaryCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const summary = overview.weekSummary;
  const move = overview.pulse?.move ?? null;
  const heat = overview.pulse?.heat ?? null;
  if (!summary && !heat) return null;
  const text = summary?.status === "ok" ? summary.text : null;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />O que
            aconteceu nesta semana
          </h2>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          {move ? <DeltaChip pct={move.change} suffix="em 7 dias" /> : null}
          {summary ? <span>Atualizado em {formatDateTime(summary.updatedAt)}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {text ? (
          <Verdict text={text} assetClass={overview.assetClass} />
        ) : summary ? (
          <p className="text-muted-foreground">
            Nenhuma notícia específica do {overview.ticker} nesta semana.
          </p>
        ) : null}
        {move?.index ? (
          <p className="-mt-2 text-subheadline text-pretty text-muted-foreground">
            {weekMoveText(overview.ticker, move)}
          </p>
        ) : null}
        {heat ? <AssetHeatMeter heat={heat} /> : null}
        {summary && (summary.lenses.length > 0 || summary.sources.length > 0) ? (
          <div className="grid gap-3">
            <WeekLenses lenses={summary.lenses} assetClass={overview.assetClass} />
            <NewsSources sources={summary.sources} />
          </div>
        ) : null}
        {text ? (
          <p className="text-footnote text-muted-foreground">
            Gerado por IA (Gemini) a partir de notícias públicas. Pode conter erros e não é
            recomendação.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
