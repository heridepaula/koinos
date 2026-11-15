import { CalendarClockIcon } from "lucide-react";
import { DIVIDEND_KIND_LABELS } from "@/features/transactions";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { DividendBars } from "./dividend-bars";
import { MoneyRow } from "./money-row";
import { ReceivedList } from "./received-list";

const SOURCE_LABEL = { B3: "B3", FUNDAMENTUS: "anunciado", YAHOO: "estimado" } as const;

/**
 * Proventos do ativo: o que está para cair (em destaque, no topo), os 12 meses fechados em barras
 * com o total e a média, e os recebidos, dos mais recentes aos mais antigos.
 */
export function DividendsCard({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const { upcoming, received, dividendMonths } = overview;
  const unit = overview.assetClass === "ACAO" ? "por ação" : "por cota";
  if (upcoming.length === 0 && received.length === 0) return null;
  const first = received.at(-1);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2>Proventos</h2>
        </CardTitle>
        <CardDescription>
          {received.length > 0 && first
            ? `${received.length} ${received.length === 1 ? "pagamento recebido" : "pagamentos recebidos"} desde ${formatTradeDate(first.paidAt)}`
            : "Nenhum pagamento recebido ainda"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {upcoming.length > 0 ? (
          <section aria-label="A receber" className="grid gap-2">
            <h3 className="flex items-center gap-1.5 text-footnote font-medium text-muted-foreground">
              <CalendarClockIcon className="size-3.5" aria-hidden="true" />A receber
            </h3>
            <ul className="divide-y divide-border/70 rounded-xl bg-foreground/4 px-3">
              {upcoming.map((item, index) => (
                <MoneyRow
                  key={`${item.source}-${(item.payBy ?? item.exDate)?.toISOString() ?? index}-${index}`}
                  date={item.payBy ? `Paga em ${formatTradeDate(item.payBy)}` : "Data a definir"}
                  detail={`${DIVIDEND_KIND_LABELS[item.kind]} · ${SOURCE_LABEL[item.source]}`}
                  amount={item.amount}
                  perShare={item.perShare}
                  unit={unit}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {dividendMonths.total > 0 ? (
          <section aria-label="Últimos 12 meses" className="grid gap-3">
            <dl className="grid grid-cols-2 gap-x-6">
              <div className="grid gap-1">
                <dt className="text-footnote text-muted-foreground">Últimos 12 meses</dt>
                <dd className="text-headline tabular-nums">
                  <Sensitive>{formatBRL(dividendMonths.total)}</Sensitive>
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-footnote text-muted-foreground">Média por mês</dt>
                <dd className="text-headline tabular-nums">
                  <Sensitive>{formatBRL(dividendMonths.monthlyAverage)}</Sensitive>
                </dd>
              </div>
            </dl>
            <DividendBars months={dividendMonths} />
          </section>
        ) : null}

        {received.length > 0 ? (
          <section aria-label="Recebidos" className="grid gap-1">
            <h3 className="text-footnote font-medium text-muted-foreground">Recebidos</h3>
            <ReceivedList items={received} unit={unit} />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
