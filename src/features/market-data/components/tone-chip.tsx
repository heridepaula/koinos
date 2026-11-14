import type { NewsTone } from "../domain/week-summary";

/** O sentido de uma notícia para quem tem o ativo, em palavras (as fontes mostram o texto). */
export const NEWS_TONE_LABELS: Record<NewsTone, string> = {
  favoravel: "Favorável",
  desfavoravel: "Desfavorável",
  misto: "Misto",
  neutro: "Neutro",
};
