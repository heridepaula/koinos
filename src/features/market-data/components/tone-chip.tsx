import type { NewsTone } from "../domain/week-summary";
import { cn } from "@/shared/lib/utils";

export const NEWS_TONE_LABELS: Record<NewsTone, string> = {
  favoravel: "Favorável",
  desfavoravel: "Desfavorável",
  misto: "Misto",
  neutro: "Neutro",
};

// A mesma tinta leve das cápsulas de variação (6% no claro, 8% no escuro), que mantém 4,5:1.
const TONE_CLASSES: Record<NewsTone, string> = {
  favoravel: "bg-gain/6 text-gain dark:bg-gain/8",
  desfavoravel: "bg-loss/6 text-loss dark:bg-loss/8",
  misto: "bg-warn/8 text-warn dark:bg-warn/10",
  neutro: "bg-muted text-muted-foreground",
};

/** O sentido de uma notícia ou lente para quem tem o ativo, em cápsula (o texto diz, não só a cor). */
export function NewsToneChip({ tone, className }: { tone: NewsTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center rounded-full px-2.5 text-caption font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {NEWS_TONE_LABELS[tone]}
    </span>
  );
}
