import { Delta } from "@/shared/components/delta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { PeriodResult } from "../domain/types";

const SINCE: Record<PeriodResult["key"], string> = {
  semana: "desde o último pregão da semana passada",
  mes: "desde o fechamento do mês passado",
  ano: "desde o fechamento de dezembro",
};

/** L/P da semana, do mês e do ano só pela cotação das posições abertas. */
export function PeriodResults({ results }: { results: PeriodResult[] }) {
  if (results.length === 0) return null;
  const missing = [...new Set(results.flatMap((result) => result.missing))].sort();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variação da cotação</CardTitle>
        <CardDescription>
          Quanto as posições de hoje ganharam ou perderam só com a cotação. Não conta proventos nem
          vendas; uma compra feita no período conta desde o início dele.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container grid gap-3">
        <dl className="grid gap-4 @min-[560px]:grid-cols-3">
          {results.map((result) => (
            <div key={result.key} className="grid gap-1">
              <dt className="text-sm text-muted-foreground">
                {result.label} <span className="text-xs">({SINCE[result.key]})</span>
              </dt>
              <dd className="text-xl font-semibold">
                <Delta value={result.value} pct={result.pct} stacked />
              </dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Fora da conta, sem o fechamento de referência: {missing.join(", ")}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
