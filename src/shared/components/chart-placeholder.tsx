import { cn } from "@/shared/lib/utils";

/**
 * O lugar do gráfico enquanto o recharts carrega: os gráficos vêm por `next/dynamic` (o recharts
 * é o maior pacote do app), e a caixa vazia com a mesma altura evita o salto do layout.
 */
export function ChartPlaceholder({ className }: { className?: string }) {
  return <div aria-hidden className={cn("w-full", className)} />;
}
