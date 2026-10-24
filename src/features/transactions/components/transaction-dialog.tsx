"use client";

import { PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { toIsoDate } from "@/shared/lib/time";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/shared/ui/responsive-dialog";
import { SegmentedControl } from "@/shared/ui/segmented-control";
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

const TYPE_OPTIONS = [
  { value: "BUY", label: "Compra" },
  { value: "SELL", label: "Venda" },
] as const;

const toNumber = parseNumberInput;
const toText = (value: number) => numberToInput(value);

const BLANK_DRAFT: Draft = {
  ticker: "",
  type: "BUY",
  date: "",
  quantity: "",
  unitPrice: "",
  fees: "0",
  notes: "",
};

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

/**
 * Formulário de lançamento: a folha macOS na mesa e, no iPhone, a folha de baixo do iOS, com o
 * botão de registrar fixo embaixo (o formulário rola entre o título e ele).
 */
export function TransactionDialog({
  transaction,
  trigger,
  tabBarAction = false,
}: {
  /** Sem `transaction`, cria um lançamento novo. */
  transaction?: TransactionRow;
  trigger: ReactElement;
  /** Também abre pelo botão redondo ao lado da tab bar do iPhone (a ação principal da página). */
  tabBarAction?: boolean;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  // Em branco até abrir (o abrir preenche, com a data de hoje): o botão de novo lançamento fica no
  // cabeçalho, que é pré-renderizado, e lá não pode haver `new Date()`.
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [today, setToday] = useState<string>();
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
      setToday(toIsoDate(new Date()));
      setDraft(transaction ? draftFrom(transaction) : emptyDraft());
      setErrors({});
    }
    setOpen(next);
  }

  useTabBarAction(
    tabBarAction
      ? { label: "Novo lançamento", icon: PlusIcon, onPress: () => handleOpenChange(true) }
      : null,
  );

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
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger render={trigger} />
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {transaction ? "Editar lançamento" : "Novo lançamento"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            O preço médio é recalculado pelo método da Receita. Vendas maiores que a posição na data
            são recusadas.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <form id={formId} onSubmit={submit} className="grid gap-4" noValidate>
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
                <FieldTitle id="tx-type">Tipo</FieldTitle>
                <SegmentedControl
                  label="Tipo"
                  value={draft.type}
                  options={TYPE_OPTIONS}
                  onChange={(next) => set("type", next)}
                  className="w-full"
                />
              </Field>
              <Field data-invalid={Boolean(errors.date) || undefined}>
                <FieldLabel htmlFor="tx-date">Data</FieldLabel>
                <Input
                  id="tx-date"
                  type="date"
                  value={draft.date}
                  max={today}
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
          </form>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Spinner /> : null}
            {transaction ? "Salvar" : "Registrar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
