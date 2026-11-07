import { cn } from "@/shared/lib/utils";

/** Barra de progresso da meta: para em 100%, mesmo quando o patrimônio já passou dela. */
export function ProgressBar({
  value,
  label,
  className,
}: {
  /** Fração (0,42 = 42%); acima de 1 enche a barra. */
  value: number;
  label: string;
  className?: string;
}) {
  const filled = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      className={cn("h-2.5 overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-smooth motion-reduce:transition-none"
        style={{ width: `${filled * 100}%` }}
      />
    </div>
  );
}
