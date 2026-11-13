import { ArrowUpRightIcon } from "lucide-react";
import type { NewsItem, NewsTone } from "@/features/market-data";
import { Disclosure } from "@/shared/components/disclosure";
import { formatDateTime } from "@/shared/lib/format";
import { NEWS_TONE_LABELS } from "./news-tone";

const shortDate = (date: Date) => formatDateTime(date).slice(0, 5);

/**
 * As fontes de um resumo da IA (resumo do dia e leitura da semana), recolhidas em "Fontes (N)":
 * uma lista compacta em Footnote, sem fundo, para o texto do resumo ser o que mais aparece (pedido
 * do dono, 2026-11-13). Cada fonte abre o portal em nova aba e, na leitura da semana, diz o sentido
 * dela para quem tem o ativo. Sem fontes, nada aparece.
 */
export function NewsSources({
  sources,
}: {
  sources: readonly (NewsItem & { tone?: NewsTone | null })[];
}) {
  if (sources.length === 0) return null;
  return (
    <Disclosure
      summary={`Fontes (${sources.length})`}
      summaryClassName="text-footnote font-normal text-muted-foreground"
    >
      <ul aria-label="Fontes" className="grid gap-1">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/source flex items-start gap-2 rounded-md py-1 text-footnote pointer-coarse:min-h-11"
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="line-clamp-2 group-hover/source:underline">{source.title}</span>
                <span className="text-muted-foreground">
                  {source.publisher} · {shortDate(source.publishedAt)}
                  {source.tone ? ` · ${NEWS_TONE_LABELS[source.tone]}` : ""}
                </span>
              </span>
              <ArrowUpRightIcon
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
