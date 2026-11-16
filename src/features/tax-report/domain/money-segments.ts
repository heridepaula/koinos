// Corta uma mensagem em texto comum e valores em R$, para a tela mascarar só os valores no modo
// privado. Exige os centavos: limites legais como "R$ 20.000" ficam em claro. Puro.

export type MoneySegment = { text: string; money: boolean };

const MONEY = /R\$\s*\d[\d.]*,\d{2}/g;

export function moneySegments(text: string): MoneySegment[] {
  const segments: MoneySegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MONEY)) {
    if (match.index > cursor)
      segments.push({ text: text.slice(cursor, match.index), money: false });
    segments.push({ text: match[0], money: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), money: false });
  return segments;
}
