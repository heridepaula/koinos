import { Badge } from "@/shared/ui/badge";
import { EXCLUSION_LABELS, type AportePriority } from "../domain/suno-cascade";

/**
 * "Prioridade de aporte": posição na fila (1º, 2º...) ou o motivo de estar fora. `quiet` é o das
 * listas do celular: só a fila leva o selo azul; o motivo fica em texto secundário, sem cápsula,
 * para a lista não virar uma coluna de selos iguais.
 */
export function PriorityBadge({
  priority,
  quiet = false,
}: {
  priority: AportePriority | null;
  quiet?: boolean;
}) {
  if (!priority) return <span className="text-xs text-muted-foreground">Fora da estratégia</span>;
  if (priority.kind === "fila") {
    return <Badge className="tabular-nums">{priority.position}º na fila</Badge>;
  }
  if (quiet) {
    return (
      <span className="text-footnote whitespace-nowrap text-muted-foreground">
        {EXCLUSION_LABELS[priority.reason]}
      </span>
    );
  }
  return <Badge variant="outline">{EXCLUSION_LABELS[priority.reason]}</Badge>;
}
