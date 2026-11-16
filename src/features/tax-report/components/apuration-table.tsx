"use client";

import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { darfDueDate } from "../domain/darf-due";
import type { ApurationMonth, FiscalYearReport } from "../domain/types";
import { OpeningLossForm } from "./opening-loss-form";
import { CLASS_LABEL, Money, Seal, dateText, monthText } from "./parts";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={insetRowClass(false)}>
      <span className="flex-1">{label}</span>
      <span className="text-right text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}

function MonthList({ months }: { months: readonly ApurationMonth[] }) {
  return (
    <div className="grid gap-4 px-(--card-spacing) @min-[820px]:hidden">
      {months.map((m) => (
        <InsetGroup
          key={`${m.month}-${m.assetClass}`}
          title={`${monthText(m.month)} · ${CLASS_LABEL[m.assetClass]}`}
        >
          <Row label="Vendido" value={<Money value={m.sold} />} />
          <Row label="Resultado" value={<Money value={m.result} />} />
          <Row
            label="Isenção (ações até R$ 20 mil/mês)"
            value={m.exempt ? "Isento" : "Não se aplica"}
          />
          <Row label="Prejuízo compensado" value={<Money value={m.lossCompensated} />} />
          <Row label="Base de cálculo" value={<Money value={m.taxableBase} />} />
          <Row label="Imposto" value={<Money value={m.tax} />} />
          <Row label="Saldo de prejuízo" value={<Money value={m.lossBalanceAfter} />} />
        </InsetGroup>
      ))}
    </div>
  );
}

function MonthTable({ months }: { months: readonly ApurationMonth[] }) {
  return (
    <Table className="hidden @min-[820px]:table">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Mês</TableHead>
          <TableHead>Classe</TableHead>
          <TableHead className="text-right">Vendido</TableHead>
          <TableHead className="text-right">Resultado</TableHead>
          <TableHead className="text-right whitespace-normal">Prejuízo compensado</TableHead>
          <TableHead className="text-right">Base</TableHead>
          <TableHead className="text-right">Imposto</TableHead>
          <TableHead className="pr-(--card-spacing) text-right">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => (
          <TableRow key={`${m.month}-${m.assetClass}`}>
            <TableCell className="pl-(--card-spacing)">{monthText(m.month)}</TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5">
                {CLASS_LABEL[m.assetClass]}
                {m.exempt ? <Seal>Isento</Seal> : null}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Money value={m.sold} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Money value={m.result} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Money value={m.lossCompensated} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Money value={m.taxableBase} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Money value={m.tax} />
            </TableCell>
            <TableCell className="pr-(--card-spacing) text-right tabular-nums">
              <Money value={m.lossBalanceAfter} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DarfSection({ darf }: { darf: FiscalYearReport["apuration"]["darf"] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1 px-(--card-spacing)">
        <h3 className="text-headline">DARF (código 6015)</h3>
        <p className="text-footnote text-muted-foreground">
          Vence no último dia útil do mês seguinte. O Koinos não considera feriados: num feriado, o
          prazo pode ser o dia útil anterior. Imposto abaixo de R$ 10,00 não se paga e soma ao mês
          seguinte.
        </p>
      </div>
      <div className="grid gap-4 px-(--card-spacing) @min-[640px]:hidden">
        {darf.map((d) => (
          <InsetGroup key={d.month} title={monthText(d.month)}>
            <Row label="Imposto do mês" value={<Money value={d.tax} />} />
            <Row
              label="DARF a pagar"
              value={d.due > 0 ? <Money value={d.due} /> : "Nada a pagar"}
            />
            <Row label="Vencimento" value={dateText(darfDueDate(d.month))} />
            {d.carriedOut > 0 ? (
              <Row label="Segue para o mês seguinte" value={<Money value={d.carriedOut} />} />
            ) : null}
          </InsetGroup>
        ))}
      </div>
      <Table className="hidden @min-[640px]:table">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-(--card-spacing)">Mês</TableHead>
            <TableHead className="text-right">Imposto do mês</TableHead>
            <TableHead className="text-right">DARF a pagar</TableHead>
            <TableHead className="text-right whitespace-normal">
              Segue para o mês seguinte
            </TableHead>
            <TableHead className="pr-(--card-spacing) text-right">Vencimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {darf.map((d) => (
            <TableRow key={d.month}>
              <TableCell className="pl-(--card-spacing)">{monthText(d.month)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={d.tax} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.due > 0 ? <Money value={d.due} /> : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {d.carriedOut > 0 ? <Money value={d.carriedOut} /> : "—"}
              </TableCell>
              <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                {dateText(darfDueDate(d.month))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Aba "Vendas e apuração": o aviso do que o passo 1 não apura, a tabela mês × classe, o DARF de
 * cada mês e o saldo de prejuízo anterior ao livro-razão.
 */
export function ApurationTab({ report }: { report: FiscalYearReport }) {
  const { months, darf, openingLoss } = report.apuration;
  return (
    <div className="grid gap-4 md:gap-6">
      <Alert>
        <InfoIcon />
        <AlertTitle>Day trade e IRRF ainda não são apurados</AlertTitle>
        <AlertDescription>
          Só as vendas comuns (swing trade) entram, sem o IRRF de 0,005% que a corretora retém. Uma
          venda no mesmo dia da compra (day trade) muda o resultado do mês e do saldo de prejuízo:
          confira com a nota de corretagem. Tudo aqui é estimativa.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Apuração mensal</CardTitle>
          <CardDescription>
            Resultado das vendas de cada classe, com a compensação do saldo de prejuízo.
          </CardDescription>
        </CardHeader>
        <CardContent className="@container grid gap-6 px-0">
          {months.length === 0 ? (
            <p className="px-(--card-spacing) text-muted-foreground">Nenhuma venda neste ano.</p>
          ) : (
            <>
              <MonthList months={months} />
              <MonthTable months={months} />
              <DarfSection darf={darf} />
            </>
          )}
          <div className="grid gap-1 px-(--card-spacing)">
            <p className="text-footnote text-muted-foreground">Saldo de prejuízo ao fim do ano:</p>
            <p className="tabular-nums">
              FIIs <Money value={report.closingLoss.FII} /> · Ações{" "}
              <Money value={report.closingLoss.ACAO} />
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Saldo inicial de prejuízo</CardTitle>
          <CardDescription>
            O Koinos só conhece as vendas a partir do primeiro extrato. Se havia prejuízo a
            compensar antes, informe aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpeningLossForm initial={openingLoss} />
        </CardContent>
      </Card>
    </div>
  );
}
