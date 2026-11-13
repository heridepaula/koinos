// Regras de texto das respostas do Gemini, compartilhadas pela leitura da semana e pela tese do
// ativo. Puras.

/**
 * Frases que serviriam para qualquer ativo, nomes de investidores, recomendação e texto sem
 * acentos (o Flash-Lite às vezes devolve "gestao", "noticias"; medido em 2026-11-13).
 */
export const BANNED: readonly RegExp[] = [
  /nada mudou/i,
  /isso significa/i,
  /\b(barsi|buffett|baroni|tiago reis)\b/i,
  // A recomendação nossa; relatar que uma corretora mudou a recomendação é fato da notícia.
  /\b(recomendamos|recomenda-se|recomendável|recomendo)\b/i,
  /hora de (comprar|vender)/i,
  /vale a pena/i,
  /oportunidade/i,
  /bom momento para/i,
  /\b(nao|noticias?|gestao|preco|periodo|dividas?|pressao|expansao|balanco|distribuicao|reducao|acoes|cotacao|tambem|apos|projecoes|provisoes)\b/i,
];

const NUMBER = /\d+(?:[.,]\d+)*/g;
/** O número sem separadores nem zeros à esquerda: "0,63" e "63" valem o mesmo. */
const numberKey = (token: string) => token.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
export const numbersIn = (text: string) =>
  new Set([...text.matchAll(NUMBER)].map((m) => numberKey(m[0])));

export const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Os números do bloco `<dados>` do prompt: os únicos que o texto pode usar. */
export function allowedNumbers(prompt: string): Set<string> {
  const start = prompt.indexOf("<dados>");
  const end = prompt.indexOf("</dados>");
  return numbersIn(start >= 0 && end > start ? prompt.slice(start, end) : "");
}
