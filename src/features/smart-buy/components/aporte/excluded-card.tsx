import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { EXCLUSION_LABELS, type ExclusionReason } from "../../domain/fii-cascade";
import { REASON_ORDER, reasonHelp, type ExcludedAsset } from "./explain";

/**
 * Quem ficou fora do aporte, nas duas carteiras, agrupado pelo motivo: o selo e a explicação numa
 * linha (o texto fala dos FIIs, das ações ou das duas classes, conforme quem está no motivo), os
 * ativos embaixo. Os grupos se separam por fios de cabelo, como uma lista do iOS.
 */
export function ExcludedCard({
  byReason,
}: {
  byReason: ReadonlyMap<ExclusionReason, readonly ExcludedAsset[]>;
}) {
  const reasons = REASON_ORDER.filter((reason) => byReason.has(reason));
  if (reasons.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fora deste aporte</CardTitle>
        <CardDescription>
          Os ativos da estratégia que não recebem nada agora, e por quê.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid divide-y divide-border">
          {reasons.map((reason) => {
            const assets = byReason.get(reason)!;
            return (
              <li key={reason} className="grid gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge variant="outline">{EXCLUSION_LABELS[reason]}</Badge>
                  <span className="text-footnote text-muted-foreground">
                    {reasonHelp(reason, assets)}
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {assets.map((asset) => asset.ticker).join(", ")}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
