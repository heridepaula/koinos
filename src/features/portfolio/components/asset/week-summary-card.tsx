import { SparklesIcon } from "lucide-react";
import { marketReadingText } from "@/features/market-data";
import { DeltaChip } from "@/shared/components/delta";
import { GlossaryText } from "@/shared/components/glossary-text";
import { formatDateTime } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { NewsSources } from "./news-sources";

/**
 * O resumo da semana dos ativos da Carteira Alvo (plano 2026-11-13-resumo-semana-carteira-alvo.md,
 * W8): sem resumo do dia, a linha do mercado atual (código) e o resumo das notícias guardadas da
 * semana (Gemini, gerado no cron de notícias). Só mostra o que está guardado; sem resumo, nada.
 */
export function WeekSummaryCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const summary = overview.weekSummary;
  if (!summary) return null;
  const text = summary.status === "ok" ? summary.text : null;
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
          {summary.changePercent !== null ? <DeltaChip pct={summary.changePercent} /> : null}
          <span>Atualizado em {formatDateTime(summary.updatedAt)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {summary.market && summary.changePercent !== null ? (
          <p className="text-subheadline text-pretty">
            {marketReadingText(overview.ticker, summary.changePercent, summary.market)}
          </p>
        ) : null}
        {text ? (
          <p className="text-pretty">
            <GlossaryText text={text} assetClass={overview.assetClass} />
          </p>
        ) : (
          <p className="text-muted-foreground">Sem notícias do ativo nesta semana.</p>
        )}
        <NewsSources sources={summary.sources.slice(0, 5)} />
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
