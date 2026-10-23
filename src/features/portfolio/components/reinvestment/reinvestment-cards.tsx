"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { setReinvestmentPercentAction } from "../../actions";
import { splitAporte } from "../../domain/reinvestment";
import type { ReinvestmentMonth } from "../../domain/types";

/** Cards do mês: aporte, proventos, a % reinvestida (editável) e a divisão do aporte. */
export function ReinvestmentCards({ current }: { current: ReinvestmentMonth }) {
  const [text, setText] = useState(numberToInput(current.percent));
  const typed = parseNumberInput(text);
  const valid = Number.isFinite(typed) && typed >= 0 && typed <= 100;
  // A divisão acompanha o que se digita; inválido mostra a % que está valendo.
  const split = splitAporte(current.aporte, current.dividends, valid ? typed : current.percent);
  const save = useAction(setReinvestmentPercentAction, {
    onSuccess: () => toast.success("% do mês salva."),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const reset = useAction(setReinvestmentPercentAction, {
    onSuccess: () => {
      setText(numberToInput(100));
      toast.success("O mês voltou ao padrão (100%).");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const busy = save.isPending || reset.isPending;
  const changed = valid && Math.round(typed * 10) / 10 !== current.percent;

  return (
    <div className="@container">
      <div className="grid gap-4 @min-[720px]:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Aporte no mês</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(current.aporte)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {current.purchaseCount === 1
              ? "1 compra"
              : `${formatQuantity(current.purchaseCount)} compras`}
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Proventos recebidos no mês</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatBRL(current.dividends)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Pelo extrato da B3.</CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>% dos proventos reinvestida</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid) save.execute({ month: current.month, percent: typed });
              }}
            >
              <Input
                aria-label="% reinvestida"
                inputMode="decimal"
                className="w-24 tabular-nums"
                value={text}
                aria-invalid={!valid}
                onChange={(event) => setText(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button type="submit" size="sm" disabled={!changed || busy}>
                Salvar
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              {!valid ? (
                "Use um número de 0 a 100."
              ) : current.isDefault ? (
                "Padrão (100%): este mês ainda não tem % salva."
              ) : (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={busy}
                  onClick={() => reset.execute({ month: current.month, percent: null })}
                >
                  Voltar ao padrão (100%)
                </Button>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
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
                    {formatPercent(split.dividendsShare ?? 0, 1)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px] bg-(--chart-1)" aria-hidden="true" />
                  Bolso <strong className="tabular-nums">{formatBRL(split.fromPocket)}</strong>
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(1 - (split.dividendsShare ?? 0), 1)}
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
