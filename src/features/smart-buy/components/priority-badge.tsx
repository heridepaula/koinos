import { Badge } from "@/shared/ui/badge";
import { EXCLUSION_LABELS, type AportePriority } from "../domain/suno-cascade";

/** "Prioridade de aporte": posição na fila (1º, 2º...) ou o motivo de estar fora. */
export function PriorityBadge({ priority }: { priority: AportePriority | null }) {
  if (!priority) return <span className="text-xs text-muted-foreground">Fora da estratégia</span>;
  if (priority.kind === "fila") {
    return <Badge className="tabular-nums">{priority.position}º na fila</Badge>;
  }
  return <Badge variant="outline">{EXCLUSION_LABELS[priority.reason]}</Badge>;
}
