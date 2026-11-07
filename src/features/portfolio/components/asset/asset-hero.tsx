import { DeltaChip } from "@/shared/components/delta";
import { formatBRL, formatDateTime, formatPercent, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/ui/card";
import type { AssetOverview } from "../../domain/types";
import { PriceChart } from "./price-chart";

const EMPTY = "—";

/**
 * O card principal, como a tela de um papel no app Bolsa: o preço grande com a variação do dia, o
 * gráfico da cotação e, embaixo, os números de mercado que o app guarda.
 */
export function AssetHero({
  overview,
  className,
}: {
  overview: AssetOverview;
  className?: string;
}) {
  const { ticker, price, dailyChange, market, assetClass, pricePeriods, position } = overview;
  const stats = [
    { label: "DY 12 meses", value: market.dy12m === null ? EMPTY : formatPercent(market.dy12m) },
    {
      label: "Proventos em 12 meses",
      value:
        market.dividends12m === null ? (
          EMPTY
        ) : (
          <>
            {formatBRL(market.dividends12m)}
            <span className="ml-1.5 text-footnote font-normal text-muted-foreground">
              {assetClass === "ACAO" ? "por ação" : "por cota"}
            </span>
          </>
        ),
    },
    {
      label: "Último provento",
      value: market.lastDividend ? (
        <>
          {formatBRL(market.lastDividend.amount)}
          <span className="ml-1.5 text-footnote font-normal text-muted-foreground">
            ex {formatTradeDate(market.lastDividend.exDate).slice(0, 5)}
          </span>
        </>
      ) : (
        EMPTY
      ),
    },
    // O P/VP vem da usebolsai, que só cobre FIIs: numa ação ficaria sempre vazio.
    ...(assetClass !== "ACAO" || market.priceToBook !== null
      ? [
          {
            label: "P/VP",
            value:
              market.priceToBook === null
                ? EMPTY
                : market.priceToBook.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
          },
        ]
      : []),
  ];
  const odd = stats.length % 2 === 1;

  return (
    <Card className={className}>
      <CardContent className="@container/hero grid gap-5">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-large-title">{price === null ? "Sem cotação" : formatBRL(price)}</p>
            {dailyChange ? <DeltaChip pct={dailyChange.percent / 100} suffix="hoje" /> : null}
          </div>
          {market.quoteFetchedAt ? (
            <p className="text-footnote text-muted-foreground">
              Cotação de {formatDateTime(market.quoteFetchedAt)}
            </p>
          ) : null}
        </div>

        {pricePeriods.length > 0 ? (
          <PriceChart
            ticker={ticker}
            periods={pricePeriods}
            averagePrice={position?.averagePrice ?? null}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            O histórico da cotação aparece para os ativos da carteira e da Carteira Alvo.
          </p>
        )}

        <dl
          className={cn(
            "grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-4",
            stats.length === 4 ? "@min-[560px]/hero:grid-cols-4" : "@min-[560px]/hero:grid-cols-3",
          )}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "grid content-start gap-1",
                odd && index === stats.length - 1 && "col-span-2 @min-[560px]/hero:col-span-1",
              )}
            >
              <dt className="text-footnote text-muted-foreground">{stat.label}</dt>
              <dd className="text-headline tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
