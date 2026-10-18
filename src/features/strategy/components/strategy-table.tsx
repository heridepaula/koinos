"use client";

import { PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import type { StrategyRow } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { TickerInput } from "@/features/transactions/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { addTargetAssetAction, removeTargetAssetAction, updateTargetAssetAction } from "../actions";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../domain/categories";

type Patch = {
  inStrategy?: boolean;
  sunoRank?: number | null;
  ceilingPrice?: number | null;
  suggestedPercent?: number | null;
  category?: Category | null;
};

const selectClass =
  "h-8 w-36 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Campo numérico que salva ao sair (ou Enter). Vazio = sem valor. */
function NumberCell({
  value,
  label,
  integer,
  onCommit,
}: {
  value: number | null;
  label: string;
  integer?: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(numberToInput(value));
  const [lastValue, setLastValue] = useState(value);
  // Valor novo vindo do servidor (após salvar): reflete no campo.
  if (value !== lastValue) {
    setLastValue(value);
    setText(numberToInput(value));
  }

  function commit() {
    const parsed = text.trim() === "" ? null : parseNumberInput(text);
    if (parsed !== null && (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)))) {
      toast.error(`${label}: valor inválido.`);
      setText(numberToInput(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="h-8 w-24 text-right tabular-nums"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function StrategyTableRow({ row }: { row: StrategyRow }) {
  const update = useAction(updateTargetAssetAction, {
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const remove = useAction(removeTargetAssetAction, {
    onSuccess: () => toast.success(`${row.ticker} removido da Carteira Alvo.`),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const save = (patch: Patch) => update.execute({ ticker: row.ticker, ...patch });

  return (
    <TableRow className={row.inStrategy ? undefined : "text-muted-foreground"}>
      <TableCell className="sticky left-0 z-10 bg-card pl-6">
        <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${row.ticker} na estratégia`}
          checked={row.inStrategy}
          onCheckedChange={(checked) => save({ inStrategy: checked })}
        />
      </TableCell>
      <TableCell>
        <NumberCell
          label="Rank"
          integer
          value={row.sunoRank}
          onCommit={(value) => save({ sunoRank: value })}
        />
      </TableCell>
      <TableCell>
        <NumberCell
          label="Preço teto"
          value={row.ceilingPrice}
          onCommit={(value) => save({ ceilingPrice: value })}
        />
      </TableCell>
      <TableCell>
        <NumberCell
          label="% sugerida"
          value={row.suggestedPercent}
          onCommit={(value) => save({ suggestedPercent: value })}
        />
      </TableCell>
      <TableCell>
        <select
          aria-label={`Categoria de ${row.ticker}`}
          className={selectClass}
          value={row.category ?? ""}
          onChange={(event) => save({ category: (event.target.value || null) as Category | null })}
        >
          <option value="">
            {row.suggestedCategory
              ? `Sugestão: ${CATEGORY_LABELS[row.suggestedCategory]}`
              : "Sem categoria"}
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.price === null ? "—" : formatBRL(row.price)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="inline-flex items-center gap-1">
          {row.suspiciousCeiling ? (
            <TriangleAlertIcon
              className="size-3.5 text-amber-600 dark:text-amber-400"
              aria-label="Teto suspeito"
            />
          ) : null}
          {row.marginToCeiling === null ? "—" : formatPercent(row.marginToCeiling, 1)}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.strategyWeight === null || row.targetWeight === null
          ? "—"
          : `${formatPercent(row.strategyWeight, 1)} / ${formatPercent(row.targetWeight, 1)}`}
      </TableCell>
      <TableCell>
        <PriorityBadge priority={row.priority} />
      </TableCell>
      <TableCell className="pr-6 text-right">
        {row.configured ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover ${row.ticker} da Carteira Alvo`}
            disabled={remove.isPending}
            onClick={() => remove.execute({ ticker: row.ticker })}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function AddAssetForm() {
  const [ticker, setTicker] = useState("");
  const add = useAction(addTargetAssetAction, {
    onSuccess: () => {
      toast.success(`${ticker} adicionado à estratégia.`);
      setTicker("");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ticker.trim()) add.execute({ ticker });
      }}
    >
      <div className="w-32">
        <TickerInput value={ticker} onChange={setTicker} />
      </div>
      <Button type="submit" disabled={add.isPending || !ticker.trim()}>
        <PlusIcon />
        Adicionar
      </Button>
    </form>
  );
}

export function StrategyTable({
  rows,
  strategyValue,
  sumOfSuggested,
  weightsWarning,
}: {
  rows: StrategyRow[];
  strategyValue: number;
  sumOfSuggested: number;
  weightsWarning: string | null;
}) {
  const members = rows.filter((row) => row.inStrategy);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Carteira Alvo</CardTitle>
          <CardDescription>
            Ranking, preço teto e % sugerida pela Suno. Os campos salvam ao sair. Sem teto, o ativo
            não recebe aporte.
          </CardDescription>
        </div>
        <AddAssetForm />
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card pl-6">Ativo</TableHead>
              <TableHead>Na estratégia</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Preço teto (R$)</TableHead>
              <TableHead>% sugerida</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Preço atual</TableHead>
              <TableHead className="text-right">Margem até o teto</TableHead>
              <TableHead className="text-right">% estratégia / meta</TableHead>
              <TableHead>Prioridade de aporte</TableHead>
              <TableHead className="pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Adicione os ativos da carteira recomendada da Suno.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <StrategyTableRow key={row.ticker} row={row} />)
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t px-6 pt-4 text-sm text-muted-foreground">
          <span>{members.length} ativos na estratégia</span>
          <span>
            Soma das % sugeridas:{" "}
            <span className="text-foreground tabular-nums">
              {formatPercent(sumOfSuggested / 100, 1)}
            </span>
          </span>
          <span>
            Valor da estratégia:{" "}
            <span className="text-foreground tabular-nums">{formatBRL(strategyValue)}</span>
          </span>
          {weightsWarning ? (
            <span className="text-amber-700 dark:text-amber-400">{weightsWarning}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
