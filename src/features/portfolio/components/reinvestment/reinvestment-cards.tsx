"use client";

import { HandCoinsIcon, RepeatIcon, WalletIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useId, useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { Button } from "@/shared/ui/button";
import { MetricCard, StatList, StatRow } from "@/shared/components/metric";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { setReinvestmentPercentAction } from "../../actions";
import { DEFAULT_REINVESTMENT_PERCENT, roundPercent, splitAporte } from "../../domain/reinvestment";
import type { ReinvestmentMonth } from "../../domain/types";

/** Cards do mês: aporte, proventos, a % reinvestida (editável) e a divisão do aporte. */
export function ReinvestmentCards({ current }: { current: ReinvestmentMonth }) {
  const labelId = useId();
  const hintId = useId();
  const [text, setText] = useState(numberToInput(current.percent));
  const typed = parseNumberInput(text);
  const valid = Number.isFinite(typed) && typed >= 0 && typed <= 100;
  // A prévia usa a % como ela será gravada (uma casa decimal), para não mostrar uma divisão
  // que o salvo não reproduz. Inválido mostra a % que está valendo.
  const percent = valid ? roundPercent(typed) : current.percent;
  const split = splitAporte(current.aporte, current.dividends, percent);
  const changed = valid && percent !== current.percent;
  const save = useAction(setReinvestmentPercentAction, {
    onSuccess: ({ input }) => {
      if (input.percent === null) {
        setText(numberToInput(DEFAULT_REINVESTMENT_PERCENT));
        toast.success(`O mês voltou ao padrão (${DEFAULT_REINVESTMENT_PERCENT}%).`);
      } else {
        setText(numberToInput(input.percent));
        toast.success("% do mês salva.");
      }
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  // As duas partes somam 100% também depois do arredondamento da tela.
  const dividendsShare = Math.round((split.dividendsShare ?? 0) * 1000) / 1000;

  return (
    <div className="@container grid gap-4 md:gap-6">
      <div className="grid gap-4 md:gap-6 @min-[720px]:grid-cols-3">
        <MetricCard
          icon={WalletIcon}
          tile="[--tile:var(--tile-blue)]"
          label="Aporte no mês"
          value={formatBRL(current.aporte)}
        >
          <StatList>
            <StatRow label="Compras" value={formatQuantity(current.purchaseCount)} />
          </StatList>
        </MetricCard>
        <MetricCard
          icon={HandCoinsIcon}
          tile="[--tile:var(--tile-teal)]"
          label="Proventos recebidos no mês"
          value={formatBRL(current.dividends)}
        >
          <StatList>
            <StatRow label="Origem" value="extrato da B3" />
          </StatList>
        </MetricCard>
        {/* O valor grande acompanha o que é digitado (já arredondado como será gravado). */}
        <MetricCard
          icon={RepeatIcon}
          tile="[--tile:var(--tile-purple)]"
          label={<span id={labelId}>% dos proventos reinvestida</span>}
          value={formatPercent(percent / 100, Number.isInteger(percent) ? 0 : 1)}
        >
          <div className="grid gap-2 border-t border-border/70 pt-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (changed && !save.isPending) save.execute({ month: current.month, percent });
              }}
            >
              <Input
                aria-labelledby={labelId}
                aria-describedby={hintId}
                inputMode="decimal"
                className="w-24 tabular-nums"
                value={text}
                aria-invalid={!valid}
                onChange={(event) => setText(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button type="submit" size="sm" disabled={!changed || save.isPending}>
                Salvar
              </Button>
            </form>
            <div id={hintId} className="grid gap-1 text-footnote text-muted-foreground">
              {valid ? null : <p className="text-loss">Use um número de 0 a 100.</p>}
              {current.isDefault ? (
                <p>Padrão ({DEFAULT_REINVESTMENT_PERCENT}%): este mês ainda não tem % salva.</p>
              ) : (
                <p>
                  {/* Outline, não link: o azul do link fica abaixo de 4,5:1 sobre o card. */}
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={save.isPending}
                    onClick={() => save.execute({ month: current.month, percent: null })}
                  >
                    Voltar ao padrão ({DEFAULT_REINVESTMENT_PERCENT}%)
                  </Button>
                </p>
              )}
            </div>
          </div>
        </MetricCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>De onde veio o aporte</CardTitle>
          <CardDescription>Proventos reinvestidos e dinheiro do bolso no mês.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {current.aporte <= 0 ? (
            <p className="text-muted-foreground">Nenhuma compra no mês.</p>
          ) : (
            <>
              <SplitBar fromDividends={split.fromDividends} fromPocket={split.fromPocket} />
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px] bg-(--chart-2)" aria-hidden="true" />
                  Proventos{" "}
                  <strong className="tabular-nums">{formatBRL(split.fromDividends)}</strong>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(dividendsShare, 1)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px] bg-(--chart-1)" aria-hidden="true" />
                  Bolso <strong className="tabular-nums">{formatBRL(split.fromPocket)}</strong>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(1 - dividendsShare, 1)}
                  </span>
                </span>
              </div>
            </>
          )}
          {split.unspent > 0.005 ? (
            <p className="text-muted-foreground">
              {formatBRL(split.unspent)} dos proventos ficaram sem compra no mês.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Barra de duas partes: proventos (laranja) e bolso (azul), proporcionais ao aporte. */
function SplitBar({ fromDividends, fromPocket }: { fromDividends: number; fromPocket: number }) {
  const total = fromDividends + fromPocket;
  const dividendsWidth = total > 0 ? (fromDividends / total) * 100 : 0;
  return (
    <div
      className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={`Proventos ${formatBRL(fromDividends)}, bolso ${formatBRL(fromPocket)}`}
    >
      {fromDividends > 0 ? (
        <div className="h-full bg-(--chart-2)" style={{ width: `${dividendsWidth}%` }} />
      ) : null}
      {fromPocket > 0 ? <div className="h-full flex-1 bg-(--chart-1)" /> : null}
    </div>
  );
}
