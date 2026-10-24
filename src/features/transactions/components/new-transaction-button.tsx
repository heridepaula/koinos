"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { TransactionDialog } from "./transaction-dialog";

/**
 * Ação principal da página de transações: no cabeçalho, na mesa; no iPhone, o "+" redondo ao lado
 * da tab bar, ao alcance do polegar (o botão do cabeçalho some, mas o diálogo segue montado).
 */
export function NewTransactionButton() {
  return (
    <TransactionDialog
      tabBarAction
      trigger={
        <Button className="max-md:hidden">
          <PlusIcon />
          Novo lançamento
        </Button>
      }
    />
  );
}
