import type { Metadata } from "next";
import { Suspense } from "react";
import { getPortfolioSnapshot } from "@/features/portfolio/server";
import { QuoteRefresher } from "@/features/portfolio/ui";
import { AporteCalculator, PrinciplesBanner } from "@/features/smart-buy/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Recomendações" };

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="Recomendações"
        description="Onde aportar hoje, pelo método Suno."
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
  const { cascadeInput, strategy } = await getPortfolioSnapshot();
  const meta = strategy.rows.map((row) => ({
    ticker: row.ticker,
    name: row.name,
    logoUrl: row.logoUrl,
  }));
  return <AporteCalculator assets={cascadeInput} meta={meta} />;
}
