import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui/card";
import type { PortfolioAlert } from "../domain/types";

/**
 * Avisos da carteira como as notificações do iOS: azulejo colorido (laranja para atenção, azul
 * para informação), título em Subheadline e o detalhe em texto secundário. Na grade, os cards
 * ficam da mesma altura.
 */
export function AlertsPanel({ alerts }: { alerts: readonly PortfolioAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
      {alerts.map((alert) => {
        const warning = alert.level === "warning";
        const Icon = warning ? TriangleAlertIcon : InfoIcon;
        return (
          <Card key={alert.id} size="sm">
            <CardContent className="flex items-start gap-3">
              <span
                className={cn(
                  "tile size-7 rounded-sm",
                  warning ? "[--tile:var(--tile-orange)]" : "[--tile:var(--tile-blue)]",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="grid gap-1">
                <p className="text-subheadline font-semibold">
                  <span className="sr-only">{warning ? "Atenção: " : "Informação: "}</span>
                  {alert.title}
                </p>
                <p className="text-sm text-muted-foreground">{alert.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
