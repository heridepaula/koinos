"use client";

import { useAction } from "next-safe-action/hooks";
import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { toIsoDate } from "@/shared/lib/time";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { createTransactionAction, updateTransactionAction } from "../actions";
import { transactionFormSchema } from "../schemas";
import { TickerInput } from "./ticker-input";
import type { TransactionRow } from "./types";

type Draft = {
  ticker: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: string;
  unitPrice: string;
  fees: string;
  notes: string;
};

const toNumber = parseNumberInput;
const toText = (value: number) => numberToInput(value);

function emptyDraft(): Draft {
  return {
    ticker: "",
    type: "BUY",
    date: toIsoDate(new Date()),
    quantity: "",
    unitPrice: "",
    fees: "0",
    notes: "",
  };
}

function draftFrom(row: TransactionRow): Draft {
  return {
    ticker: row.ticker,
    type: row.type,
    date: toIsoDate(row.date),
    quantity: toText(row.quantity),
    unitPrice: toText(row.unitPrice),
    fees: toText(row.fees),
    notes: row.notes ?? "",
  };
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransactionDialog({
  transaction,
  trigger,
}: {
  /** Sem `transaction`, cria um lançamento novo. */
  transaction?: TransactionRow;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const onSuccess = () => {
    toast.success(transaction ? "Lançamento atualizado." : "Lançamento registrado.");
    setOpen(false);
  };
  const onError = ({ error }: { error: Parameters<typeof actionErrorMessage>[0] }) =>
    toast.error(actionErrorMessage(error));
  const create = useAction(createTransactionAction, { onSuccess, onError });
  const update = useAction(updateTransactionAction, { onSuccess, onError });
  const pending = create.isPending || update.isPending;

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(transaction ? draftFrom(transaction) : emptyDraft());
      setErrors({});
    }
    setOpen(next);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = transactionFormSchema.safeParse({
      ticker: draft.ticker,
      type: draft.type,
      date: draft.date,
      quantity: toNumber(draft.quantity),
      unitPrice: toNumber(draft.unitPrice),
      fees: draft.fees.trim() === "" ? 0 : toNumber(draft.fees),
      notes: draft.notes.trim() || null,
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof Draft, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Draft;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (transaction) update.execute({ ...parsed.data, id: transaction.id });
    else create.execute(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            O preço médio é recalculado pelo método da Receita. Vendas maiores que a posição na data
            são recusadas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field data-invalid={Boolean(errors.ticker) || undefined}>
              <FieldLabel htmlFor="tx-ticker">Ativo</FieldLabel>
              <TickerInput
                id="tx-ticker"
                value={draft.ticker}
                onChange={(value) => set("ticker", value)}
                invalid={Boolean(errors.ticker)}
              />
              <FieldError>{errors.ticker}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="tx-type">Tipo</FieldLabel>
              <select
                id="tx-type"
                className={selectClass}
                value={draft.type}
                onChange={(event) => set("type", event.target.value as Draft["type"])}
              >
                <option value="BUY">Compra</option>
                <option value="SELL">Venda</option>
              </select>
            </Field>
            <Field data-invalid={Boolean(errors.date) || undefined}>
              <FieldLabel htmlFor="tx-date">Data</FieldLabel>
              <Input
                id="tx-date"
                type="date"
                value={draft.date}
                max={toIsoDate(new Date())}
                onChange={(event) => set("date", event.target.value)}
              />
              <FieldError>{errors.date}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.quantity) || undefined}>
              <FieldLabel htmlFor="tx-quantity">Quantidade</FieldLabel>
              <Input
                id="tx-quantity"
                inputMode="decimal"
                value={draft.quantity}
                onChange={(event) => set("quantity", event.target.value)}
                placeholder="10"
              />
              <FieldError>{errors.quantity}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.unitPrice) || undefined}>
              <FieldLabel htmlFor="tx-price">Preço unitário (R$)</FieldLabel>
              <Input
                id="tx-price"
                inputMode="decimal"
                value={draft.unitPrice}
                onChange={(event) => set("unitPrice", event.target.value)}
                placeholder="98,50"
              />
              <FieldError>{errors.unitPrice}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.fees) || undefined}>
              <FieldLabel htmlFor="tx-fees">Taxas (R$)</FieldLabel>
              <Input
                id="tx-fees"
                inputMode="decimal"
                value={draft.fees}
                onChange={(event) => set("fees", event.target.value)}
              />
              <FieldError>{errors.fees}</FieldError>
            </Field>
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor="tx-notes">Observação (opcional)</FieldLabel>
            <Input
              id="tx-notes"
              value={draft.notes}
              maxLength={500}
              onChange={(event) => set("notes", event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              {transaction ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
