"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useState, type ReactNode } from "react";
import { ChartPlaceholder } from "@/shared/components/chart-placeholder";
import { AssetLabel } from "@/shared/components/asset-label";
import { InsetGroup, InsetValueRow } from "@/shared/components/inset-list";
import { formatBRL, formatCompactNumber, formatMonth, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";

const GROUPINGS = ["mes", "ano", "papel"] as const;
type Grouping = (typeof GROUPINGS)[number];
const GROUPING_OPTIONS = [
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
  { value: "papel", label: "Papel" },
] as const satisfies readonly { value: Grouping; label: string }[];

const PLOT_SIZE = "aspect-auto h-52 w-full md:h-64";

// O recharts fica fora do bundle inicial: chega depois da hidratação, no lugar da caixa vazia.
const DividendsPlot = dynamic(() => import("./dividends-plot").then((mod) => mod.DividendsPlot), {
  ssr: false,
  loading: () => <ChartPlaceholder className={PLOT_SIZE} />,
});

/** Só o que o histórico usa: o "a receber" e o mês atual ficam fora do componente do cliente. */
type HistoryData = Pick<DividendsView, "since" | "chart" | "byMonth" | "byYear" | "byTicker">;

/** Histórico dos proventos recebidos, agrupado por mês, ano ou papel (a escolha fica na URL). */
export function DividendsHistory(view: HistoryData) {
  const [grouping, setGrouping] = useQueryState(
    "agrupar",
    parseAsStringLiteral(GROUPINGS).withDefault("mes").withOptions({ history: "replace" }),
  );

  return (
    <Card className="@container">
      {/* O controle segmentado fica à direita do título; em card estreito, desce para a linha de baixo. */}
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="grid gap-1">
          <CardTitle>Histórico de proventos</CardTitle>
          <CardDescription>
            {view.since
              ? `Recebidos, pelos extratos da B3, desde ${formatMonth(view.since)}.`
              : "Recebidos, pelos extratos da B3."}
          </CardDescription>
        </div>
        <SegmentedControl
          label="Agrupar por"
          value={grouping}
          options={GROUPING_OPTIONS}
          onChange={(next) => void setGrouping(next)}
          className="max-md:w-full"
        />
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
      <DividendsPlot chart={view.chart} className={PLOT_SIZE} />
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
    <>
      <MonthCalendar view={view} max={max} onSelect={(key) => void setMonth(key)} />
      <div className="hidden gap-4 @min-[640px]:grid">
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
        <p className="text-caption text-muted-foreground">
          Cor mais forte, mês maior. Clique num mês para ver os FIIs.
        </p>
        {selected ? (
          <section aria-live="polite" className="grid gap-3 rounded-xl bg-secondary/60 p-4">
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
    </>
  );
}

/**
 * Celular (card abaixo de 640 px): o ano num calendário de 4 × 3, como a visão de ano do app
 * Calendário. Cada mês é um bloco tingido pelo valor (o mesmo laranja da matriz), com o valor
 * compacto; o ano muda pelas setas. Tocar num mês abre os FIIs dele numa folha de baixo.
 */
function MonthCalendar({
  view,
  max,
  onSelect,
}: {
  view: HistoryData;
  max: number;
  onSelect: (monthKey: string) => void;
}) {
  const byMonth = new Map(view.byMonth.map((group) => [group.month, group]));
  const [yearIndex, setYearIndex] = useState(0);
  const [opened, setOpened] = useState<string | null>(null);
  const year = view.byYear[yearIndex];
  if (!year) return null;
  const group = opened ? byMonth.get(opened) : undefined;

  return (
    <div className="grid gap-3 @min-[640px]:hidden">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ano anterior"
          disabled={yearIndex >= view.byYear.length - 1}
          onClick={() => setYearIndex((index) => index + 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <p className="grid text-center" aria-live="polite">
          <span className="text-headline">{year.year}</span>
          <span className="text-footnote text-muted-foreground tabular-nums">
            {formatBRL(year.total)}
          </span>
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo ano"
          disabled={yearIndex === 0}
          onClick={() => setYearIndex((index) => index - 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {MONTH_HEADERS.map((label, index) => {
          const key = `${year.year}-${String(index + 1).padStart(2, "0")}`;
          const item = byMonth.get(key);
          if (!item) {
            return (
              <li
                key={key}
                aria-label={`${monthName(key)}: sem provento`}
                className="grid h-14 place-content-center rounded-xl bg-secondary/40 text-center"
              >
                <span className="text-caption text-muted-foreground capitalize">{label}</span>
                <span className="text-footnote text-muted-foreground">—</span>
              </li>
            );
          }
          const strength = max > 0 ? Math.round(8 + 32 * (item.total / max)) : 8;
          return (
            <li key={key}>
              <button
                type="button"
                aria-label={`${monthName(key)}: ${formatBRL(item.total)}`}
                aria-haspopup="dialog"
                onClick={() => {
                  onSelect(key);
                  setOpened(key);
                }}
                className="grid h-14 w-full press-spring place-content-center rounded-xl text-center outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--chart-2) ${strength}%, transparent)`,
                }}
              >
                <span className="text-caption capitalize">{label}</span>
                <span className="text-footnote font-semibold tabular-nums">
                  {formatCompactNumber(item.total)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-caption text-muted-foreground">
        Cor mais forte, mês maior. Toque num mês para ver os FIIs.
      </p>
      <Drawer open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        <DrawerContent>
          {group ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{capitalize(monthName(group.month))}</DrawerTitle>
              </DrawerHeader>
              <DrawerBody className="grid content-start gap-5">
                <div className="grid justify-items-center gap-1">
                  <p className="text-title-1 tabular-nums">{formatBRL(group.total)}</p>
                  <p className="text-footnote text-muted-foreground">
                    {group.byTicker.length} {group.byTicker.length === 1 ? "FII" : "FIIs"}
                  </p>
                </div>
                <InsetGroup>
                  {group.byTicker.map((item) => (
                    <InsetValueRow
                      key={item.ticker}
                      label={item.ticker}
                      value={formatBRL(item.amount)}
                    />
                  ))}
                </InsetGroup>
              </DrawerBody>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * Célula das listas do celular: o nome e o valor na primeira linha, o detalhe na de baixo, em
 * texto secundário, com a largura toda (não disputa espaço com o nome).
 */
function PhoneRow({ lead, value, detail }: { lead: ReactNode; value: string; detail: string }) {
  return (
    <li className="grid gap-1 px-(--card-spacing) py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">{lead}</div>
        <span className="text-headline font-normal whitespace-nowrap tabular-nums">{value}</span>
      </div>
      <p className="truncate text-footnote text-muted-foreground tabular-nums">{detail}</p>
    </li>
  );
}

function ByYear({ rows }: { rows: DividendsView["byYear"] }) {
  return (
    <>
      <ul className="divide-y divide-border @min-[640px]:hidden">
        {rows.map((row) => (
          <PhoneRow
            key={row.year}
            lead={<span className="text-headline">{row.year}</span>}
            value={formatBRL(row.total)}
            detail={`${row.months} ${row.months === 1 ? "mês" : "meses"} · média ${formatBRL(row.monthlyAverage)}`}
          />
        ))}
      </ul>
      <Table className="hidden @min-[640px]:table">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-(--card-spacing)">Ano</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Meses com provento</TableHead>
            <TableHead className="pr-(--card-spacing) text-right">Média mensal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.year}>
              <TableCell className="pl-(--card-spacing) font-medium">{row.year}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.months}</TableCell>
              <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                {formatBRL(row.monthlyAverage)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function ByTicker({ rows }: { rows: DividendsView["byTicker"] }) {
  return (
    <>
      <ul className="divide-y divide-border @min-[640px]:hidden">
        {rows.map((row) => (
          <PhoneRow
            key={row.ticker}
            lead={<AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />}
            value={formatBRL(row.total)}
            detail={`${row.payments} ${row.payments === 1 ? "pagamento" : "pagamentos"} · último ${formatTradeDate(row.lastPaidAt)}`}
          />
        ))}
      </ul>
      <Table className="hidden @min-[640px]:table">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-(--card-spacing)">FII</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Pagamentos</TableHead>
            <TableHead className="pr-(--card-spacing) text-right">Último</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.ticker}>
              <TableCell className="pl-(--card-spacing)">
                <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.payments}</TableCell>
              <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                {formatTradeDate(row.lastPaidAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
