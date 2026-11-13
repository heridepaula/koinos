import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { marketReadingText } from "@/features/market-data";
import { DeltaChip } from "@/shared/components/delta";
import { formatDateTime } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { TypedText } from "./typed-text";

const shortDate = (date: Date) => formatDateTime(date).slice(0, 5);

/**
 * O resumo da IA da variação forte do pregão (spec 2026-11-12-resumo-ia-variacao-design.md):
 * gerado em segundo plano a partir de notícias públicas; aqui só se mostra o que está guardado.
 * Sem resumo, o card não aparece. Com notícia do pregão é o "Resumo do dia"; sem ela, "O que
 * aconteceu nesta semana" (plano 2026-11-13-resumo-dia-sem-noticia-antiga.md, R8). A linha do
 * mercado (contra o IFIX ou o Ibovespa) é calculada pelo código, não pela IA.
 */
export function DayInsightCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const insight = overview.dayInsight;
  if (!insight) return null;
  const at = insight.generatedAt ?? insight.attemptedAt;
  const week = insight.kind === "week";
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {week ? "O que aconteceu nesta semana" : "Resumo do dia"}
          </h2>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <DeltaChip pct={insight.changePercent} />
          <span>
            {insight.status === "ok" ? "Gerado em" : "Verificado em"} {formatDateTime(at)}
          </span>
          {week ? <span>Nenhuma notícia do pregão explica o movimento.</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {insight.market ? (
          <p className="text-subheadline text-pretty">
            {marketReadingText(overview.ticker, insight.changePercent, insight.market)}
          </p>
        ) : null}
        {insight.status === "ok" && insight.text ? (
          <TypedText
            text={insight.text}
            className="text-pretty"
            glossaryClass={overview.assetClass}
          />
        ) : (
          <p className="text-muted-foreground">
            {week
              ? "Sem notícias do ativo nesta semana."
              : "Nenhuma notícia recente explica o movimento deste pregão."}
          </p>
        )}
        {insight.sources.length > 0 ? (
          <section aria-label="Fontes" className="grid gap-2">
            <h3 className="text-footnote font-medium text-muted-foreground">Fontes</h3>
            <ul className="divide-y divide-border/70 rounded-xl bg-foreground/4 px-3">
              {insight.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center gap-3 py-2 hover:text-primary"
                  >
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="line-clamp-2 text-subheadline">{source.title}</span>
                      <span className="text-footnote text-muted-foreground">
                        {source.publisher} · {shortDate(source.publishedAt)}
                      </span>
                    </span>
                    <ArrowUpRightIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="text-footnote text-muted-foreground">
          Gerado por IA (Gemini) a partir de notícias públicas. Pode conter erros e não é
          recomendação.
        </p>
      </CardContent>
    </Card>
  );
}
