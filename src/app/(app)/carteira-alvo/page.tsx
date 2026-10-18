import type { Metadata } from "next";
import { Suspense } from "react";
import { getPortfolioSnapshot } from "@/features/portfolio/server";
import { QuoteRefresher } from "@/features/portfolio/ui";
import { StrategyTable } from "@/features/strategy/ui";
import { PageHeader } from "@/shared/components/page-header";
import { TableSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Carteira Alvo" };

export default function StrategyPage() {
  return (
    <>
      <PageHeader
        title="Carteira Alvo"
        description="Ranking, preço teto e % sugerida de cada ativo."
        actions={
          <Suspense fallback={null}>
            <QuoteStatus />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <StrategyContent />
      </Suspense>
    </>
  );
}

async function QuoteStatus() {
  const { quotes } = await getPortfolioSnapshot();
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function StrategyContent() {
  const { strategy } = await getPortfolioSnapshot();
  return (
    <StrategyTable
      rows={strategy.rows}
      strategyValue={strategy.strategyValue}
      sumOfSuggested={strategy.sumOfSuggested}
      weightsWarning={strategy.weightsWarning}
    />
  );
}
