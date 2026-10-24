"use client";

import { Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatQuantity, formatTradeDate } from "@/shared/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { deleteTransactionAction } from "../actions";
import type { TransactionRow } from "./types";

/**
 * Excluir com confirmação: o ícone de lixeira na linha da tabela ou, na folha de edição do
 * celular, o botão largo vermelho no rodapé. A confirmação é o alerta do iOS, centrado.
 */
export function DeleteTransactionButton({
  transaction,
  variant = "icon",
}: {
  transaction: TransactionRow;
  variant?: "icon" | "sheet";
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(deleteTransactionAction, {
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {variant === "sheet" ? (
        <AlertDialogTrigger render={<Button variant="ghost" className="text-loss" />}>
          <Trash2Icon />
          Excluir lançamento
        </AlertDialogTrigger>
      ) : (
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Excluir lançamento" />}
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction.type === "BUY" ? "Compra" : "Venda"} de{" "}
            {formatQuantity(transaction.quantity)} {transaction.ticker} em{" "}
            {formatTradeDate(transaction.date)}. Se for uma compra que cobre vendas posteriores, a
            exclusão é recusada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => execute({ id: transaction.id })}
          >
            {isPending ? <Spinner /> : null}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
