"use client";

import { ChevronDownIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatCompactBRL, formatMonth, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";
import { ChartTooltipRow } from "../chart-tooltip-row";

const GROUPINGS = ["mes", "ano", "papel"] as const;
type Grouping = (typeof GROUPINGS)[number];
const LABELS: Record<Grouping, string> = { mes: "Mês", ano: "Ano", papel: "Papel" };

// Uma série só: o título nomeia o gráfico, sem legenda. Cor validada contra o card nos dois temas.
const config = { amount: { label: "Proventos", color: "var(--chart-2)" } } satisfies ChartConfig;

// Segmento escolhido em azul sólido (--badge, 5,9:1 com o texto branco). O botão com brilho
// (btn-gloss) não serve aqui: no tamanho sm o texto fica sob o brilho e o contraste cai para 3,3:1.
// O dark: repete as classes porque tem a mesma especificidade do aria-pressed: no outline.
const SELECTED =
  "aria-pressed:border-transparent aria-pressed:bg-(--badge) aria-pressed:text-white aria-pressed:hover:bg-(--badge) aria-pressed:hover:text-white dark:aria-pressed:border-transparent dark:aria-pressed:bg-(--badge) dark:aria-pressed:hover:bg-(--badge)";

/** Histórico dos proventos recebidos, agrupado por mês, ano ou papel (a escolha fica na URL). */
export function DividendsHistory({ view }: { view: DividendsView }) {
  const [grouping, setGrouping] = useQueryState(
    "agrupar",
    parseAsStringLiteral(GROUPINGS).withDefault("mes").withOptions({ history: "replace" }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de proventos</CardTitle>
        <CardDescription>
          {view.since
            ? `Recebidos, pelos extratos da B3, desde ${formatMonth(view.since)}.`
            : "Recebidos, pelos extratos da B3."}
        </CardDescription>
        <CardAction>
          <div role="group" aria-label="Agrupar por" className="flex gap-1">
            {GROUPINGS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                className={SELECTED}
                aria-pressed={grouping === key}
                onClick={() => void setGrouping(key)}
              >
                {LABELS[key]}
              </Button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className={cn(grouping !== "mes" && "px-0")}>
        {grouping === "mes" ? <ByMonth view={view} /> : null}
        {grouping === "ano" ? <ByYear rows={view.byYear} /> : null}
        {grouping === "papel" ? <ByTicker rows={view.byTicker} /> : null}
      </CardContent>
    </Card>
  );
}

function ByMonth({ view }: { view: DividendsView }) {
  // Os meses (do mais recente ao mais antigo) ficam agrupados sob o ano, com o total do ano.
  const years = new Map<string, DividendsView["byMonth"]>();
  for (const group of view.byMonth) {
    const year = group.month.slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), group]);
  }
  const yearTotals = new Map(view.byYear.map((row) => [row.year, row.total]));

  return (
    <div className="grid gap-6">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={view.chart} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactBRL(value)}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(month) => formatMonth(String(month))}
                formatter={(value) => (
                  <ChartTooltipRow
                    color="var(--color-amount)"
                    label="Proventos"
                    value={formatBRL(Number(value))}
                  />
                )}
              />
            }
          />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>
      {/* Cada ano recolhe, com o total sempre à vista; só o mais recente começa aberto. O grupo
          do ano tem nome (group/year) para não girar as setas dos meses, que usam o group simples. */}
      <div className="grid gap-3">
        {[...years].map(([year, months], index) => (
          <details key={year} open={index === 0} className="group/year">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold">
              <ChevronDownIcon
                className="size-4 shrink-0 transition-transform group-open/year:rotate-180"
                aria-hidden="true"
              />
              {year}
              <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                {formatBRL(yearTotals.get(year) ?? 0)}
              </span>
            </summary>
            <ul className="mt-1 grid gap-0.5 text-sm">
              {months.map((group) => (
                <li key={group.month}>
                  <details className="group rounded-md px-2 py-1.5 open:bg-muted/40">
                    <summary className="flex cursor-pointer list-none items-center gap-2">
                      <ChevronDownIcon
                        className="size-4 shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{formatMonth(group.month)}</span>
                      <span className="text-muted-foreground">
                        {group.byTicker.length} {group.byTicker.length === 1 ? "FII" : "FIIs"}
                      </span>
                      <span className="ml-auto tabular-nums">{formatBRL(group.total)}</span>
                    </summary>
                    <ul className="mt-2 grid gap-1 pl-6">
                      {group.byTicker.map((item) => (
                        <li key={item.ticker} className="flex text-muted-foreground">
                          <span>{item.ticker}</span>
                          <span className="ml-auto tabular-nums">{formatBRL(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function ByYear({ rows }: { rows: DividendsView["byYear"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Ano</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Meses com provento</TableHead>
          <TableHead className="pr-6 text-right">Média mensal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.year}>
            <TableCell className="pl-6 font-medium">{row.year}</TableCell>
            <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.months}</TableCell>
            <TableCell className="pr-6 text-right tabular-nums">
              {formatBRL(row.monthlyAverage)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ByTicker({ rows }: { rows: DividendsView["byTicker"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">FII</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Pagamentos</TableHead>
          <TableHead className="pr-6 text-right">Último</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.ticker}>
            <TableCell className="pl-6">
              <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.payments}</TableCell>
            <TableCell className="pr-6 text-right tabular-nums">
              {formatTradeDate(row.lastPaidAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
