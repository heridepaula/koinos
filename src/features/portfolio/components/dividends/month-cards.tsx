import { formatBRL, formatMonth } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { DividendMonthSummary } from "../../domain/types";

/**
 * Mês atual: o que já caiu (extrato da B3), o que falta cair (a lista da B3 ou, sem ela, os
 * anúncios do Yahoo) e a soma.
 */
export function DividendMonthCards({
  month,
  forecastAsOf,
}: {
  month: DividendMonthSummary;
  forecastAsOf: Date | null;
}) {
  return (
    // Três colunas só quando cada card tem espaço para o valor sem quebrar a linha.
    <div className="@container">
      <div className="grid gap-4 @min-[720px]:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Recebido em {formatMonth(month.month)}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(month.received)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Pelo extrato da B3.</CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>{forecastAsOf ? "A receber" : "A receber (estimado)"}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(month.upcoming)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {forecastAsOf
              ? "Pela B3 (Proventos a Receber), completado com o Yahoo."
              : "Previsão pelo Yahoo, confirmada quando o extrato da B3 for importado."}
          </CardContent>
        </Card>
        <Card className="metal-ring card-lift brushed">
          <CardHeader>
            <CardDescription>Total do mês</CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatBRL(month.total)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Recebido + a receber.</CardContent>
        </Card>
      </div>
    </div>
  );
}
