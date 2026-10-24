"use client";

import { PlusIcon, Trash2Icon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import type { StrategyRow } from "@/features/portfolio";
import { PriorityBadge } from "@/features/smart-buy/ui";
import { TickerInput } from "@/features/transactions/ui";
import { AssetLabel } from "@/shared/components/asset-label";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { NativeSelect } from "@/shared/ui/native-select";
import {
  addTargetAssetAction,
  removeTargetAssetAction,
  setSuggestedPercentsAction,
  updateTargetAssetAction,
} from "../actions";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../domain/categories";
import { suggestPercentFix } from "../domain/weights";

type Patch = {
  inStrategy?: boolean;
  sunoRank?: number | null;
  ceilingPrice?: number | null;
  suggestedPercent?: number | null;
  category?: Category | null;
};

/** Campo numérico que salva ao sair (ou Enter). Vazio = sem valor. */
function NumberCell({
  value,
  label,
  integer,
  className,
  onCommit,
}: {
  value: number | null;
  label: string;
  integer?: boolean;
  className?: string;
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
      className={cn("h-8 w-24 text-right tabular-nums", className)}
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
      <TableCell className="sticky left-0 z-10 bg-card pl-(--card-spacing)">
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
          className="w-14"
          value={row.sunoRank}
          onCommit={(value) => save({ sunoRank: value })}
        />
      </TableCell>
      <TableCell>
        <NumberCell
          label="Preço teto"
          className="w-20"
          value={row.ceilingPrice}
          onCommit={(value) => save({ ceilingPrice: value })}
        />
      </TableCell>
      <TableCell>
        <NumberCell
          label="% sugerida"
          className="w-16"
          value={row.suggestedPercent}
          onCommit={(value) => save({ suggestedPercent: value })}
        />
      </TableCell>
      <TableCell>
        <NativeSelect
          aria-label={`Categoria de ${row.ticker}`}
          wrapperClassName="w-36"
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
        </NativeSelect>
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
      <TableCell className="pr-(--card-spacing) text-right">
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

const percentText = (value: number) => formatPercent(value / 100, 1);

/**
 * Quando as % sugeridas não somam 100%: mostra quanto falta (ou sobra) e o ajuste sugerido, que
 * um clique grava. A conta é a de `suggestPercentFix`.
 */
function PercentFixPanel({ rows }: { rows: StrategyRow[] }) {
  const members = rows.filter((row) => row.inStrategy);
  const fixes = suggestPercentFix(
    members.map((row) => ({ ticker: row.ticker, suggestedPercent: row.suggestedPercent })),
  );
  const apply = useAction(setSuggestedPercentsAction, {
    onSuccess: () => toast.success("% sugeridas ajustadas: a soma fecha 100%."),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  if (!fixes || fixes.length === 0) return null;
  const sum = members.reduce((acc, row) => acc + (row.suggestedPercent ?? 0), 0);
  const rest = 100 - sum;
  const fillsMissing = fixes.every((fix) => fix.from === null);

  return (
    <div className="mx-6 mb-4 grid gap-3 rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
      <p className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>
          As % sugeridas somam <strong className="tabular-nums">{percentText(sum)}</strong>:{" "}
          {rest > 0
            ? `faltam ${percentText(rest)} para 100%.`
            : `passam ${percentText(-rest)} de 100%.`}{" "}
          {fillsMissing
            ? "Sugestão: dividir o que falta igualmente entre os ativos sem %."
            : "Sugestão: ajustar cada % na mesma proporção."}
        </span>
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        {fixes.map((fix) => (
          <li key={fix.ticker}>
            <span className="font-medium">{fix.ticker}</span>{" "}
            <span className="text-muted-foreground">
              {fix.from === null ? "sem %" : percentText(fix.from)} →
            </span>{" "}
            {percentText(fix.to)}
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={apply.isPending}
          onClick={() =>
            apply.execute({
              items: fixes.map((fix) => ({ ticker: fix.ticker, suggestedPercent: fix.to })),
            })
          }
        >
          <WandSparklesIcon />
          Aplicar ajuste
        </Button>
      </div>
    </div>
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
        <PercentFixPanel rows={rows} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card pl-(--card-spacing)">
                Ativo
              </TableHead>
              <TableHead>Estratégia</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Teto (R$)</TableHead>
              <TableHead>% sugerida</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Preço atual</TableHead>
              <TableHead className="text-right" title="Margem até o preço teto">
                Margem
              </TableHead>
              <TableHead className="text-right" title="Peso atual na estratégia / peso-alvo">
                Peso / meta
              </TableHead>
              <TableHead title="Prioridade de aporte pelo método Suno">Prioridade</TableHead>
              <TableHead className="pr-(--card-spacing)" />
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
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t px-(--card-spacing) pt-4 text-sm text-muted-foreground">
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
