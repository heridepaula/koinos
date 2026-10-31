import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { EXCLUSION_LABELS, type ExclusionReason } from "../../domain/suno-cascade";
import { reasonHelp, REASON_ORDER, type OrderClass } from "./explain";

/**
 * Quem ficou fora do aporte, agrupado pelo motivo: o selo e a explicação numa linha, os FIIs
 * embaixo. Os grupos se separam por fios de cabelo, como uma lista do iOS.
 */
export function ExcludedCard({
  byReason,
  kind = "FII",
}: {
  byReason: ReadonlyMap<ExclusionReason, string[]>;
  kind?: OrderClass;
}) {
  const help = reasonHelp(kind);
  const reasons = REASON_ORDER.filter((reason) => byReason.has(reason));
  if (reasons.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === "ACAO" ? "Ações fora deste aporte" : "Fora deste aporte"}</CardTitle>
        <CardDescription>
          {kind === "ACAO"
            ? "As ações da estratégia que não recebem nada agora, e por quê."
            : "Os FIIs da estratégia que não recebem nada agora, e por quê."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid divide-y divide-border">
          {reasons.map((reason) => (
            <li key={reason} className="grid gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant="outline">{EXCLUSION_LABELS[reason]}</Badge>
                <span className="text-footnote text-muted-foreground">{help[reason]}</span>
              </div>
              <p className="text-sm font-medium">{byReason.get(reason)!.join(", ")}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
