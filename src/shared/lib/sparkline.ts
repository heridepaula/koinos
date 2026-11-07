/**
 * Caminho SVG de um minigráfico de linha: os valores esticados na largura, do menor (embaixo) ao
 * maior (em cima), com `inset` de folga para a espessura do traço. Série reta fica no meio. Null
 * com menos de dois valores.
 */
export function sparklinePath(
  values: readonly number[],
  width: number,
  height: number,
  inset = 1,
): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (width - inset * 2) / (values.length - 1);
  const usable = height - inset * 2;
  const y = (value: number) =>
    max === min ? height / 2 : inset + usable * (1 - (value - min) / (max - min));
  return values
    .map((value, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${(inset + index * step).toFixed(2)} ${y(value).toFixed(2)}`;
    })
    .join(" ");
}
