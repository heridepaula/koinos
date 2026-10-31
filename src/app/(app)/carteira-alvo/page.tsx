import type { Metadata } from "next";
import { Suspense } from "react";
import { getPortfolioSnapshot } from "@/features/portfolio/server";
import { QuoteRefresher } from "@/features/portfolio/ui";
import { getMyClassTarget } from "@/features/strategy/server";
import { ClassTargetPanel, StrategyTable } from "@/features/strategy/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { PageHeader } from "@/shared/components/page-header";
import { TableSkeleton } from "@/shared/components/skeletons";
import { parseClassParam } from "@/shared/lib/class-filter";

export const metadata: Metadata = { title: "Carteira Alvo" };

export default function StrategyPage({ searchParams }: PageProps<"/carteira-alvo">) {
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
      <AssetClassControl includeAll={false} className="mb-6" />
      <Suspense fallback={<TableSkeleton />}>
        <StrategyContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function QuoteStatus() {
  const { quotes } = await getPortfolioSnapshot();
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function StrategyContent({
  searchParams,
}: Pick<PageProps<"/carteira-alvo">, "searchParams">) {
  // Cada classe tem os seus 100%: sem Geral, FIIs é o padrão.
  const assetClass = parseClassParam((await searchParams).classe) === "ACAO" ? "ACAO" : "FII";
  const [{ strategy }, { classValues }, target] = await Promise.all([
    getPortfolioSnapshot(assetClass),
    getPortfolioSnapshot(),
    getMyClassTarget(),
  ]);
  return (
    <div className="grid gap-4 md:gap-6">
      <ClassTargetPanel target={target} values={classValues} />
      <StrategyTable
        assetClass={assetClass}
        rows={strategy.rows}
        strategyValue={strategy.strategyValue}
        sumOfSuggested={strategy.sumOfSuggested}
        weightsWarning={strategy.weightsWarning}
      />
    </div>
  );
}
