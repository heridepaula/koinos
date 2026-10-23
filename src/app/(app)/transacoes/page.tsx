import { UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMyTransactions } from "@/features/transactions/server";
import { TransactionsTable, type TransactionRow } from "@/features/transactions/ui";
import { PageHeader } from "@/shared/components/page-header";
import { TableSkeleton } from "@/shared/components/skeletons";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = { title: "Transações" };

export default function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transações"
        description="Compras e vendas registradas."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/transacoes/importar" />}
          >
            <UploadIcon />
            Importar da B3
          </Button>
        }
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
