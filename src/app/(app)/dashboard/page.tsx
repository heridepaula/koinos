import type { Metadata } from "next";
import { Suspense } from "react";
import { getEvolution, getPeriodResults, getPortfolioSnapshot } from "@/features/portfolio/server";
import {
  AlertsPanel,
  AllocationCharts,
  ClosedPositions,
  ContributionsChart,
  EmptyPortfolio,
  EvolutionChart,
  PeriodResults,
  PositionsTable,
  QuoteRefresher,
  SummaryCards,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton, DashboardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Dashboard" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da carteira."
        actions={
          <Suspense fallback={null}>
            <QuoteStatus />
          </Suspense>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function QuoteStatus() {
  const { quotes } = await getPortfolioSnapshot();
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function DashboardContent() {
  const snapshot = await getPortfolioSnapshot();
  if (snapshot.positions.length === 0 && snapshot.closed.length === 0) return <EmptyPortfolio />;

  return (
    <div className="grid gap-4 md:gap-6">
      <SummaryCards summary={snapshot.summary} />
      <Suspense fallback={<CardSkeleton />}>
        <PeriodSection />
      </Suspense>
      <AlertsPanel alerts={snapshot.alerts} />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <EvolutionSection />
        </Suspense>
        <ContributionsChart data={snapshot.contributions} />
      </div>
      <AllocationCharts
        byCategory={snapshot.allocation.byCategory}
        byAsset={snapshot.allocation.byAsset}
      />
      <PositionsTable rows={snapshot.positions} />
      <ClosedPositions rows={snapshot.closed} />
    </div>
  );
}

// Pode buscar histórico no Yahoo na primeira vez: fica no próprio Suspense para não segurar o resto.
async function EvolutionSection() {
  return <EvolutionChart points={await getEvolution()} />;
}

// Pode buscar fechamentos no Yahoo (no máximo a cada 12 h): também fica no próprio Suspense.
async function PeriodSection() {
  return <PeriodResults results={await getPeriodResults()} />;
}
