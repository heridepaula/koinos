import type { Metadata } from "next";
import { Suspense } from "react";
import { getAssetWatchlist } from "@/features/portfolio/server";
import { AssetFinder, AssetFinderSkeleton } from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Ativos" };

// O cabeçalho vai no shell estático; a busca e a lista dependem da sessão e chegam por streaming.
export default function AssetsPage() {
  return (
    <>
      <PageHeader title="Ativos" description="Os seus FIIs e ações, e a busca no catálogo da B3." />
      <Suspense fallback={<AssetFinderSkeleton />}>
        <AssetsContent />
      </Suspense>
    </>
  );
}

async function AssetsContent() {
  return <AssetFinder watchlist={await getAssetWatchlist()} />;
}
