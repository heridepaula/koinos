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
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton, DashboardSkeleton } from "@/shared/components/skeletons";
import { parseClassParam, type ClassFilter } from "@/shared/lib/class-filter";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/empty";

export const metadata: Metadata = { title: "Dashboard" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
type SearchParams = PageProps<"/dashboard">["searchParams"];

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
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
      <AssetClassControl className="mb-4 md:mb-6" />
      {/* searchParams é dado da requisição: fica dentro de <Suspense>. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function filterOf(searchParams: SearchParams): Promise<ClassFilter> {
  return parseClassParam((await searchParams).classe);
}

// Sempre a carteira toda: o atualizador renova todas as cotações, seja qual for a classe aberta.
async function QuoteStatus() {
  const { quotes } = await getPortfolioSnapshot();
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const filter = await filterOf(searchParams);
  const snapshot = await getPortfolioSnapshot(filter);
  if (snapshot.positions.length === 0 && snapshot.closed.length === 0) {
    if (filter === "TODOS") return <EmptyPortfolio />;
    // A página vazia depende da carteira toda, não só da classe filtrada.
    const whole = await getPortfolioSnapshot();
    if (whole.positions.length === 0 && whole.closed.length === 0) return <EmptyPortfolio />;
    return <EmptyClass filter={filter} />;
  }

  return (
    <div className="grid gap-4 md:gap-6">
      <SummaryCards
        summary={snapshot.summary}
        byCategory={filter === "ACAO" ? [] : snapshot.allocation.byCategory}
      />
      <Suspense fallback={<CardSkeleton />}>
        <PeriodSection filter={filter} />
      </Suspense>
      {filter === "ACAO" ? null : <AlertsPanel alerts={snapshot.alerts} />}
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <EvolutionSection filter={filter} />
        </Suspense>
        <ContributionsChart data={snapshot.contributions} />
      </div>
      <AllocationCharts
        byCategory={snapshot.allocation.byCategory}
        byAsset={snapshot.allocation.byAsset}
        showCategory={filter !== "ACAO"}
      />
      <PositionsTable rows={snapshot.positions} />
      <ClosedPositions rows={snapshot.closed} />
    </div>
  );
}

/** Visão de uma classe sem nenhum ativo, aberto ou encerrado. */
function EmptyClass({ filter }: { filter: Exclude<ClassFilter, "TODOS"> }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>
          {filter === "FII" ? "Nenhum FII na carteira" : "Nenhuma ação na carteira"}
        </EmptyTitle>
        <EmptyDescription>Escolha Geral para ver a carteira toda.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// Pode buscar histórico no Yahoo na primeira vez: fica no próprio Suspense para não segurar o resto.
async function EvolutionSection({ filter }: { filter: ClassFilter }) {
  return <EvolutionChart points={await getEvolution(filter)} />;
}

// Pode buscar fechamentos no Yahoo (no máximo a cada 12 h): também fica no próprio Suspense.
async function PeriodSection({ filter }: { filter: ClassFilter }) {
  return <PeriodResults results={await getPeriodResults(filter)} />;
}
