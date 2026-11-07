"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { DIVIDEND_KIND_LABELS } from "@/features/transactions";
import { Sensitive } from "@/shared/components/sensitive";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { AssetOverview } from "../../domain/types";
import { PriceChart } from "./price-chart";

const TABS = ["proventos", "ordens", "cotacao"] as const;

const SOURCE_LABEL = { B3: "B3", FUNDAMENTUS: "Anunciado", YAHOO: "Estimado" } as const;

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Proventos, ordens e cotação do ativo. A aba aberta fica na URL (`?aba=`). */
export function AssetTabs({ overview }: { overview: AssetOverview }) {
  const [tab, setTab] = useQueryState(
    "aba",
    parseAsStringLiteral(TABS).withDefault("proventos").withOptions({ history: "replace" }),
  );
  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="sr-only">Detalhes do ativo</CardTitle>
        <SegmentedControl
          label="Seção"
          value={tab}
          onChange={(value) => void setTab(value)}
          options={[
            { value: "proventos", label: "Proventos" },
            { value: "ordens", label: "Ordens" },
            { value: "cotacao", label: "Cotação" },
          ]}
        />
      </CardHeader>
      <CardContent>
        {tab === "proventos" ? <Dividends overview={overview} /> : null}
        {tab === "ordens" ? <Orders overview={overview} /> : null}
        {tab === "cotacao" ? (
          <PriceChart
            closes={overview.closes}
            averagePrice={overview.position?.averagePrice ?? null}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Dividends({ overview }: { overview: AssetOverview }) {
  const { upcoming, received } = overview;
  if (upcoming.length === 0 && received.length === 0) {
    return <Empty>Nenhum provento deste ativo.</Empty>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Por cota</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {upcoming.map((item, index) => (
          <TableRow key={`up-${index}`}>
            <TableCell>{item.payBy ? formatTradeDate(item.payBy) : "—"}</TableCell>
            <TableCell>{DIVIDEND_KIND_LABELS[item.kind]}</TableCell>
            <TableCell className="text-right tabular-nums">
              {item.perShare === null ? "—" : formatBRL(item.perShare)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Sensitive>{formatBRL(item.amount)}</Sensitive>
            </TableCell>
            <TableCell>A receber · {SOURCE_LABEL[item.source]}</TableCell>
          </TableRow>
        ))}
        {received.map((item, index) => (
          <TableRow key={`rec-${index}`}>
            <TableCell>{formatTradeDate(item.paidAt)}</TableCell>
            <TableCell>{DIVIDEND_KIND_LABELS[item.kind]}</TableCell>
            <TableCell className="text-right tabular-nums">
              {item.perShare === null ? "—" : formatBRL(item.perShare)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Sensitive>{formatBRL(item.amount)}</Sensitive>
            </TableCell>
            <TableCell>Recebido</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Orders({ overview }: { overview: AssetOverview }) {
  if (overview.orders.length === 0) return <Empty>Nenhuma ordem deste ativo.</Empty>;
  return (
    <div className="grid gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Taxas</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overview.orders.map((order, index) => {
            const gross = order.quantity * order.unitPrice;
            const total = order.type === "BUY" ? gross + order.fees : gross - order.fees;
            return (
              <TableRow key={index}>
                <TableCell>{formatTradeDate(order.date)}</TableCell>
                <TableCell>{order.type === "BUY" ? "Compra" : "Venda"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Sensitive mask="•••">{formatQuantity(order.quantity)}</Sensitive>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(order.unitPrice)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(order.fees)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Sensitive>{formatBRL(total)}</Sensitive>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-footnote text-muted-foreground">Para editar uma ordem, use Transações.</p>
    </div>
  );
}
