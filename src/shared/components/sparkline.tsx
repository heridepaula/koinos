import { sparklinePath } from "@/shared/lib/sparkline";
import { cn } from "@/shared/lib/utils";

/**
 * Minigráfico de linha, decorativo (a lista já traz o preço e a variação em texto). Fica na cor do
 * texto em que está: cinza, para não contradizer a variação do dia, que é de outro período.
 * Sem dados, guarda o espaço, para as colunas da lista continuarem alinhadas.
 */
export function Sparkline({
  values,
  width = 64,
  height = 28,
  className,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const path = sparklinePath(values, width, height, 1.5);
  if (!path) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block", className)}
        style={{ width, height }}
      />
    );
  }
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
