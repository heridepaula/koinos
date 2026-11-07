import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAssetOverview } from "@/features/portfolio/server";
import {
  AssetHero,
  AssetTabs,
  MarketCard,
  PositionCard,
  StrategyCard,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = { title: "Ativo" };

// O cabeçalho vai no shell estático; o ativo chega por streaming, porque depende da sessão.
export default function AssetPage({ params }: PageProps<"/ativos/[ticker]">) {
  return (
    <>
      <PageHeader
        title="Ativo"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/ativos" />}>
            <ArrowLeftIcon />
            Ativos
          </Button>
        }
        mobileActions={false}
      />
      <Suspense fallback={<CardSkeleton height="h-96" />}>
        <AssetContent params={params} />
      </Suspense>
    </>
  );
}

async function AssetContent({ params }: Pick<PageProps<"/ativos/[ticker]">, "params">) {
  const overview = await getAssetOverview((await params).ticker);
  return (
    <div className="grid gap-6">
      <AssetHero overview={overview} />
      <div className="grid gap-6 md:grid-cols-2">
        <MarketCard overview={overview} />
        {overview.strategy ? <StrategyCard overview={overview} /> : null}
        {overview.position || overview.closed ? <PositionCard overview={overview} /> : null}
      </div>
      <AssetTabs overview={overview} />
    </div>
  );
}
