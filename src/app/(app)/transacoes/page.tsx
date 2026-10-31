import type { Metadata } from "next";
import { Suspense } from "react";
import { getAssetClasses } from "@/features/market-data/server";
import { getMyTransactions } from "@/features/transactions/server";
import {
  NewTransactionButton,
  TransactionsTable,
  type TransactionRow,
} from "@/features/transactions/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
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
        mobileActions={false}
      />
      <AssetClassControl shallow className="mb-6" />
      <Suspense fallback={<TableSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </>
  );
}

async function TransactionsContent() {
  const transactions = await getMyTransactions();
  const classes = await getAssetClasses(transactions.map((transaction) => transaction.ticker));
  // DTO mínimo: só o que a tela usa.
  const rows: TransactionRow[] = transactions.map((transaction) => ({
    id: transaction.id,
    assetClass: classes.get(transaction.ticker) ?? null,
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
