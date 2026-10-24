"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
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

/** Só o que o histórico usa: o "a receber" e o mês atual ficam fora do componente do cliente. */
type HistoryData = Pick<DividendsView, "since" | "chart" | "byMonth" | "byYear" | "byTicker">;

/** Histórico dos proventos recebidos, agrupado por mês, ano ou papel (a escolha fica na URL). */
export function DividendsHistory(view: HistoryData) {
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

function ByMonth({ view }: { view: HistoryData }) {
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
      <MonthMatrix view={view} />
    </div>
  );
}

const MONTH_HEADERS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const longMonth = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const monthName = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return longMonth.format(new Date(Date.UTC(year, month - 1, 1)));
};

/**
 * Matriz ano × mês: uma linha por ano (do mais recente ao mais antigo), os 12 meses e o total.
 * A cor da célula cresce com o valor (laranja dos proventos, até 40% sobre o card, para o texto
 * manter o contraste). Clicar num mês mostra os FIIs dele abaixo; o mês escolhido fica na URL.
 * A tabela rola dentro do card nas telas estreitas, com o ano fixo à esquerda.
 */
function MonthMatrix({ view }: { view: HistoryData }) {
  const byMonth = new Map(view.byMonth.map((group) => [group.month, group]));
  const max = Math.max(0, ...view.byMonth.map((group) => group.total));
  const [requested, setMonth] = useQueryState(
    "mes",
    parseAsString.withOptions({ history: "replace", scroll: false }),
  );
  const selected = (requested ? byMonth.get(requested) : undefined) ?? view.byMonth[0];

  return (
    <div className="grid gap-4">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card">Ano</TableHead>
            {MONTH_HEADERS.map((label) => (
              <TableHead key={label} className="px-1 text-center capitalize">
                {label}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.byYear.map((year) => (
            <TableRow key={year.year} className="hover:bg-transparent">
              <TableCell className="sticky left-0 z-10 bg-card font-semibold">
                {year.year}
              </TableCell>
              {MONTH_HEADERS.map((label, index) => {
                const key = `${year.year}-${String(index + 1).padStart(2, "0")}`;
                const group = byMonth.get(key);
                if (!group) {
                  return (
                    <TableCell key={key} className="px-1 text-center text-muted-foreground">
                      <span aria-label={`${monthName(key)}: sem provento`}>—</span>
                    </TableCell>
                  );
                }
                const strength = max > 0 ? Math.round(8 + 32 * (group.total / max)) : 8;
                const active = selected?.month === key;
                return (
                  <TableCell key={key} className="p-0.5">
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={`${monthName(key)}: ${formatBRL(group.total)}`}
                      onClick={() => void setMonth(key)}
                      className={cn(
                        "w-full min-w-22 cursor-pointer rounded-md px-1.5 py-1.5 text-center whitespace-nowrap tabular-nums outline-none hover:ring-2 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                        active && "font-semibold ring-2 ring-ring",
                      )}
                      style={{
                        backgroundColor: `color-mix(in oklab, var(--chart-2) ${strength}%, transparent)`,
                      }}
                    >
                      {formatBRL(group.total)}
                    </button>
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {formatBRL(year.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Cor mais forte, mês maior. Clique num mês para ver os FIIs.
      </p>
      {selected ? (
        <section aria-live="polite" className="grid gap-3 rounded-lg border p-4">
          <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
            <span>{capitalize(monthName(selected.month))}</span>
            <span className="font-normal text-muted-foreground">
              {selected.byTicker.length} {selected.byTicker.length === 1 ? "FII" : "FIIs"}
            </span>
            <span className="ml-auto tabular-nums">{formatBRL(selected.total)}</span>
          </h3>
          <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {selected.byTicker.map((item) => (
              <li key={item.ticker} className="flex gap-2">
                <span>{item.ticker}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {formatBRL(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
