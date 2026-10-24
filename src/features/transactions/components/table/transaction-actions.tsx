"use client";

import { LockIcon, PencilIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { DeleteTransactionButton } from "../delete-transaction-button";
import { TransactionDialog } from "../transaction-dialog";
import type { TransactionRow } from "../types";

/**
 * Ações da linha: editar e excluir; num lançamento da B3, só o cadeado, porque a B3 manda e a
 * correção é reenviar o extrato. O cadeado tem o mesmo tamanho de um botão, para a coluna não
 * dançar entre as linhas.
 */
export function TransactionActions({ row }: { row: TransactionRow }) {
  if (row.source === "B3") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground" />
          }
        >
          <LockIcon className="size-3.5" aria-label="Lançamento da B3" />
        </TooltipTrigger>
        <TooltipContent>
          Veio do extrato da B3. Para corrigir, envie os extratos de novo em Atualização B3.
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span className="inline-flex justify-end gap-1">
      <TransactionDialog
        transaction={row}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Editar lançamento">
            <PencilIcon />
          </Button>
        }
      />
      <DeleteTransactionButton transaction={row} />
    </span>
  );
}
