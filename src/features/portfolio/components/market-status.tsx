import { cn } from "@/shared/lib/utils";

/**
 * "Mercado aberto" (ponto verde) ou "Mercado fechado" (ponto cinza): o pregão da B3 agora, das
 * 10:00 às 18:00 em dia útil. Feriados não são tratados.
 */
export function MarketStatus({ open, className }: { open: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-footnote whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", open ? "bg-gain" : "bg-muted-foreground")}
      />
      {open ? "Mercado aberto" : "Mercado fechado"}
    </span>
  );
}
