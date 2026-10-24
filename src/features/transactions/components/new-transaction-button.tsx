"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { TransactionDialog } from "./transaction-dialog";

/** Ação principal da página de transações, no cabeçalho (como o "+" da barra do iOS). */
export function NewTransactionButton() {
  return (
    <TransactionDialog
      trigger={
        <Button>
          <PlusIcon />
          Novo lançamento
        </Button>
      }
    />
  );
}
