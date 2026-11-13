import { ArrowUpRightIcon } from "lucide-react";
import type { NewsItem } from "@/features/market-data";
import { formatDateTime } from "@/shared/lib/format";

const shortDate = (date: Date) => formatDateTime(date).slice(0, 5);

/**
 * As fontes de um resumo da IA (resumo do dia e resumo da semana): título, portal e data, cada uma
 * abrindo o portal em nova aba. Sem fontes, nada aparece.
 */
export function NewsSources({ sources }: { sources: readonly NewsItem[] }) {
  if (sources.length === 0) return null;
  return (
    <section aria-label="Fontes" className="grid gap-2">
      <h3 className="text-footnote font-medium text-muted-foreground">Fontes</h3>
      <ul className="divide-y divide-border/70 rounded-xl bg-foreground/4 px-3">
        {sources.map((source) => (
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
  );
}
