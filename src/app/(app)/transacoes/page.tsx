import type { Metadata } from "next";
import { Suspense } from "react";
import { getMyTransactions } from "@/features/transactions/server";
import {
  NewTransactionButton,
  TransactionsTable,
  type TransactionRow,
} from "@/features/transactions/ui";
import { PageHeader } from "@/shared/components/page-header";
import { TableSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Transações" };

export default function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transações"
        description="Compras e vendas registradas."
        actions={<NewTransactionButton />}
      />
      <Suspense fallback={<TableSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </>
  );
}

async function TransactionsContent() {
  const transactions = await getMyTransactions();
  // DTO mínimo: só o que a tela usa.
  const rows: TransactionRow[] = transactions.map((transaction) => ({
    id: transaction.id,
    ticker: transaction.ticker,
    type: transaction.type,
    quantity: transaction.quantity,
    unitPrice: transaction.unitPrice,
    fees: transaction.fees,
    date: transaction.date,
    source: transaction.source,
    kind: transaction.kind,
    notes: transaction.notes,
  }));
  return <TransactionsTable rows={rows} />;
}
