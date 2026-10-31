import { ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getClosedPositionsView } from "@/features/portfolio/server";
import {
  ClosedPositionsCards,
  ClosedPositionsTable,
  EmptyClosedPositions,
} from "@/features/portfolio/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { parseClassParam } from "@/shared/lib/class-filter";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Posições encerradas" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
export default function ClosedPositionsPage({ searchParams }: PageProps<"/encerradas">) {
  return (
    <>
      <PageHeader
        title="Posições encerradas"
        description="Os ativos com posição zerada: o custo, o vendido e o resultado das vendas."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/encerradas/ir" />}>
            <ReceiptTextIcon />
            IR estimado
          </Button>
        }
        mobileActions={false}
      />
      <AssetClassControl className="mb-6" />
      <Suspense fallback={<ClosedPositionsSkeleton />}>
        <ClosedPositionsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClosedPositionsContent({
  searchParams,
}: Pick<PageProps<"/encerradas">, "searchParams">) {
  const view = await getClosedPositionsView(parseClassParam((await searchParams).classe));
  if (view.rows.length === 0) return <EmptyClosedPositions />;
  return (
    <div className="grid gap-6">
      <ClosedPositionsCards totals={view.totals} />
      <ClosedPositionsTable rows={view.rows} totals={view.totals} />
    </div>
  );
}

/** No formato da página (cards e tabela), para não pular ao carregar. */
function ClosedPositionsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando as posições encerradas">
      <div className="@container">
        <div className="grid gap-4 @min-[720px]:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
      <CardSkeleton height="h-96" />
    </div>
  );
}
