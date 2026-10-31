import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getClosedPositionsView } from "@/features/portfolio/server";
import { ClosedTaxCards, ClosedTaxTable, EmptyClosedPositions } from "@/features/portfolio/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { parseClassParam } from "@/shared/lib/class-filter";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "IR estimado" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
export default function ClosedTaxPage({ searchParams }: PageProps<"/encerradas/ir">) {
  return (
    <>
      <PageHeader
        title="IR estimado"
        description="O imposto sobre o lucro de cada posição encerrada, sem compensar os prejuízos."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/encerradas" />}>
            <ArrowLeftIcon />
            Posições encerradas
          </Button>
        }
        mobileActions={false}
      />
      <AssetClassControl className="mb-6" />
      <Suspense fallback={<ClosedTaxSkeleton />}>
        <ClosedTaxContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClosedTaxContent({
  searchParams,
}: Pick<PageProps<"/encerradas/ir">, "searchParams">) {
  const view = await getClosedPositionsView(parseClassParam((await searchParams).classe));
  if (view.rows.length === 0) return <EmptyClosedPositions />;
  return (
    <div className="grid gap-6">
      <ClosedTaxCards totals={view.totals} />
      <ClosedTaxTable rows={view.rows} totals={view.totals} />
    </div>
  );
}

/** No formato da página (cards e tabela), para não pular ao carregar. */
function ClosedTaxSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando o IR estimado">
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
