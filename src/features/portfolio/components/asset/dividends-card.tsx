import { CalendarClockIcon } from "lucide-react";
import { DIVIDEND_KIND_LABELS } from "@/features/transactions";
import { Disclosure } from "@/shared/components/disclosure";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { DividendBars } from "./dividend-bars";

/** Quantos recebidos aparecem antes do "Mostrar todos". */
const VISIBLE = 5;
const SOURCE_LABEL = { B3: "B3", FUNDAMENTUS: "anunciado", YAHOO: "estimado" } as const;

type Received = AssetOverview["received"][number];

/** Uma linha de dinheiro: a data e o tipo à esquerda, o valor (e o por cota) à direita. */
function MoneyRow({
  date,
  detail,
  amount,
  perShare,
  unit,
}: {
  date: string;
  detail: string;
  amount: number;
  perShare: number | null;
  /** "por cota" ou "por ação". */
  unit: string;
}) {
  return (
    <li className="flex min-h-13 items-center justify-between gap-4 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="font-medium">{date}</span>
        <span className="truncate text-footnote text-muted-foreground">{detail}</span>
      </div>
      <div className="grid justify-items-end gap-0.5 text-right tabular-nums">
        <span className="font-medium">
          <Sensitive>{formatBRL(amount)}</Sensitive>
        </span>
        {perShare !== null ? (
          <span className="text-footnote text-muted-foreground">
            {formatBRL(perShare)} {unit}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function ReceivedRows({ items, unit }: { items: Received[]; unit: string }) {
  return (
    <ul className="divide-y divide-border/70">
      {items.map((item, index) => (
        <MoneyRow
          key={`${item.paidAt.toISOString()}-${item.kind}-${index}`}
          date={formatTradeDate(item.paidAt)}
          detail={DIVIDEND_KIND_LABELS[item.kind]}
          amount={item.amount}
          perShare={item.perShare}
          unit={unit}
        />
      ))}
    </ul>
  );
}

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
  const visible = received.slice(0, VISIBLE);
  const rest = received.slice(VISIBLE);

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

        {visible.length > 0 ? (
          <section aria-label="Recebidos" className="grid gap-1">
            <h3 className="text-footnote font-medium text-muted-foreground">Recebidos</h3>
            <ReceivedRows items={visible} unit={unit} />
            {rest.length > 0 ? (
              <Disclosure
                summary={`Mostrar mais ${rest.length}`}
                className="border-t border-border/70 pt-3"
              >
                <ReceivedRows items={rest} unit={unit} />
              </Disclosure>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
