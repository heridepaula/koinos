"use client";

import { CopyIcon, LayersIcon } from "lucide-react";
import { parseAsFloat, parseAsNumberLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { AssetLabel } from "@/shared/components/asset-label";
import { MoneyInput } from "@/shared/components/money-input";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  DEFAULT_MAX_SHARE_PERCENT,
  EXCLUSION_LABELS,
  MAX_SHARE_PERCENTS,
  sunoCascade,
  type CascadeAsset,
  type CascadeOrder,
  type ExclusionReason,
  type MaxSharePercent,
} from "../domain/suno-cascade";

export type AssetMeta = { ticker: string; name: string | null; logoUrl: string | null };

const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  SEM_RANKING: "Sem ranking cadastrado na Carteira Alvo.",
  SEM_COTACAO: "Ainda sem cotação.",
};
const REASON_ORDER: ExclusionReason[] = [
  "SEM_SALDO",
  "NA_META",
  "ACIMA_DO_TETO",
  "SEM_TETO",
  "SEM_RANKING",
  "SEM_COTACAO",
];

const selectClass =
  "h-10 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const limitLabel = (percent: MaxSharePercent) =>
  percent >= 100 ? "Sem limite" : `${percent}% do aporte`;

function explain(order: CascadeOrder, maxSharePercent: number): string {
  const parts = [
    `${order.rank}º do ranking`,
    `${formatPercent(order.marginToCeiling, 1)} abaixo do teto`,
    order.gapBefore > 0 ? `faltavam ${formatBRL(order.gapBefore)} para a meta` : "já na meta",
  ];
  if (order.limited) {
    parts.push(`limite de ${maxSharePercent}% do aporte`);
    // Estimativa: mesmo aporte, mesmo preço e mesmo ranking.
    if (order.aportesLeft !== null) {
      parts.push(
        order.aportesLeft === 1
          ? "falta ≈ 1 aporte como este"
          : `faltam ≈ ${order.aportesLeft} aportes como este`,
      );
    }
  }
  if (order.fromLeftover > 0) parts.push(`${order.fromLeftover} cota(s) da sobra`);
  return parts.join(" · ");
}

export function AporteCalculator({ assets, meta }: { assets: CascadeAsset[]; meta: AssetMeta[] }) {
  const [amount, setAmount] = useQueryState(
    "valor",
    parseAsFloat.withDefault(0).withOptions({ history: "replace" }),
  );
  const [maxShare, setMaxShare] = useQueryState(
    "limite",
    parseAsNumberLiteral(MAX_SHARE_PERCENTS)
      .withDefault(DEFAULT_MAX_SHARE_PERCENT)
      .withOptions({ history: "replace" }),
  );
  const metaByTicker = new Map(meta.map((item) => [item.ticker, item]));

  const result = amount > 0 ? sunoCascade(amount, assets, { maxSharePercent: maxShare }) : null;
  const limitedAny = result?.orders.some((order) => order.limited) ?? false;
  const excludedByReason = new Map<ExclusionReason, string[]>();
  for (const item of result?.excluded ?? []) {
    excludedByReason.set(item.reason, [...(excludedByReason.get(item.reason) ?? []), item.ticker]);
  }

  async function copyOrders() {
    if (!result) return;
    const lines = result.orders.map(
      (order) =>
        `${order.ticker}: comprar ${formatQuantity(order.quantity)} cotas a ~${formatBRL(order.price)} = ${formatBRL(order.total)}`,
    );
    lines.push(`Total: ${formatBRL(result.spent)} · Sobra: ${formatBRL(result.leftover)}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Ordens copiadas.");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Quanto vou aportar hoje?</CardTitle>
          <CardDescription>
            O cálculo usa as cotações atuais e a configuração da Carteira Alvo. O máximo por FII
            monta cada posição aos poucos: o preço médio se forma em várias compras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <MoneyInput
              aria-label="Valor do aporte em reais"
              className="h-10 w-48 text-lg"
              defaultValue={amount > 0 ? amount : null}
              onValueChange={(value) => void setAmount(value !== null && value > 0 ? value : null)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Máximo por FII
              <select
                className={selectClass}
                value={maxShare}
                onChange={(event) =>
                  void setMaxShare(Number(event.target.value) as MaxSharePercent)
                }
              >
                {MAX_SHARE_PERCENTS.map((percent) => (
                  <option key={percent} value={percent}>
                    {limitLabel(percent)}
                  </option>
                ))}
              </select>
            </label>
            {result && result.orders.length > 0 ? (
              <Button type="button" variant="outline" onClick={copyOrders}>
                <CopyIcon />
                Copiar ordens
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card size="sm" className="card-lift">
              <CardHeader>
                <CardDescription>Aporte</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatBRL(result.amount)}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm" className="card-lift">
              <CardHeader>
                <CardDescription>Ordens</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatBRL(result.spent)}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm" className="card-lift">
              <CardHeader>
                <CardDescription>Sobra para o próximo aporte</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatBRL(result.leftover)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ordens de compra</CardTitle>
              <CardDescription>
                Na ordem do ranking. Os preços são de referência: confira na corretora.
              </CardDescription>
              {limitedAny ? (
                <p className="flex items-start gap-2 text-sm">
                  <LayersIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  Entrada aos poucos: nenhum FII leva mais de {result.maxSharePercent}% do aporte, e
                  o resto vai para os outros FIIs. Quem parou no limite volta a receber no próximo
                  aporte, até chegar à meta.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="px-0">
              {result.orders.length === 0 ? (
                <p className="px-(--card-spacing) text-sm text-muted-foreground">
                  Nenhuma compra atende às regras com esse valor. Veja abaixo o motivo de cada
                  ativo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-(--card-spacing)">Ativo</TableHead>
                      <TableHead className="text-right">Cotas</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">% antes → depois</TableHead>
                      <TableHead className="text-right">% meta</TableHead>
                      <TableHead className="pr-(--card-spacing)">Por quê</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.orders.map((order) => {
                      const info = metaByTicker.get(order.ticker);
                      return (
                        <TableRow key={order.ticker}>
                          <TableCell className="pl-(--card-spacing)">
                            <AssetLabel
                              ticker={order.ticker}
                              name={info?.name}
                              logoUrl={info?.logoUrl}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatQuantity(order.quantity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(order.price)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(order.total)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(order.weightBefore, 1)} →{" "}
                            {formatPercent(order.weightAfter, 1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(order.targetWeight, 1)}
                          </TableCell>
                          {/* A explicação quebra linha: a tabela cabe em telas menores. */}
                          <TableCell className="min-w-64 pr-(--card-spacing) text-xs whitespace-normal text-muted-foreground">
                            {explain(order, result.maxSharePercent)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {result.excluded.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Fora deste aporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {REASON_ORDER.filter((reason) => excludedByReason.has(reason)).map((reason) => (
                  <div key={reason} className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{EXCLUSION_LABELS[reason]}</Badge>
                      <span className="text-xs text-muted-foreground">{REASON_HELP[reason]}</span>
                    </div>
                    <p className="text-sm">{excludedByReason.get(reason)!.join(", ")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
