import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import type { PortfolioAlert } from "../domain/types";

export function AlertsPanel({ alerts }: { alerts: readonly PortfolioAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {alerts.map((alert) => (
        <Alert key={alert.id}>
          {alert.level === "warning" ? (
            <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />
          ) : (
            <InfoIcon />
          )}
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.detail}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
