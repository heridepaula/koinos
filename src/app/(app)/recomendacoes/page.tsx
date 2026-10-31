import type { Metadata } from "next";
import { Suspense } from "react";
import { getPortfolioSnapshot } from "@/features/portfolio/server";
import { QuoteRefresher } from "@/features/portfolio/ui";
import { AporteCalculator, PrinciplesBanner, type AssetMeta } from "@/features/smart-buy/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Recomendações" };

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="Recomendações"
        description="Onde aportar hoje: FIIs pelo método Suno e ações pela margem de segurança."
        actions={
          <Suspense fallback={null}>
            <QuoteStatus />
          </Suspense>
        }
      />
      <PrinciplesBanner />
      <Suspense fallback={<CardSkeleton height="h-40" />}>
        <RecommendationsContent />
      </Suspense>
    </>
  );
}

async function QuoteStatus() {
  const { quotes } = await getPortfolioSnapshot();
  return <QuoteRefresher staleCount={quotes.staleCount} lastFetchedAt={quotes.lastFetchedAt} />;
}

async function RecommendationsContent() {
  const { cascadeInput, stockBuyInput, stockMeta, classValues, strategy, positions } =
    await getPortfolioSnapshot();
  const meta = new Map<string, AssetMeta>();
  for (const row of [...strategy.rows, ...stockMeta, ...positions]) {
    if (!meta.has(row.ticker)) {
      meta.set(row.ticker, { ticker: row.ticker, name: row.name, logoUrl: row.logoUrl });
    }
  }
  return (
    <AporteCalculator
      fiiAssets={cascadeInput}
      stockAssets={stockBuyInput}
      values={classValues}
      meta={[...meta.values()]}
    />
  );
}
