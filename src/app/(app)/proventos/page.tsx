import { ChevronRightIcon, RepeatIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseKindParam } from "@/features/portfolio";
import { getDividendsView } from "@/features/portfolio/server";
import {
  DividendKindSelect,
  DividendMonthCards,
  DividendsHistory,
  EmptyDividends,
  UpcomingDividends,
} from "@/features/portfolio/ui";
import { AssetClassControl } from "@/shared/components/asset-class-control";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { parseClassParam } from "@/shared/lib/class-filter";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Proventos" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
export default function DividendsPage({ searchParams }: PageProps<"/proventos">) {
  return (
    <>
      <PageHeader
        title="Proventos"
        description="Recebidos, a receber e o histórico."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/proventos/reinvestimento" />}
          >
            <RepeatIcon />
            Reinvestimento
          </Button>
        }
        mobileActions={false}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AssetClassControl />
        <DividendKindSelect />
      </div>
      <Suspense fallback={<DividendsSkeleton />}>
        <DividendsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DividendsContent({ searchParams }: Pick<PageProps<"/proventos">, "searchParams">) {
  const params = await searchParams;
  const view = await getDividendsView(parseClassParam(params.classe), parseKindParam(params.tipo));
  if (!view.imported) return <EmptyDividends />;
  return (
    <div className="grid gap-6">
      <DividendMonthCards month={view.month} forecastAsOf={view.forecastAsOf} />
      {/* No iPhone, a subpágina é uma célula com chevron, como nos Ajustes: o botão do
          cabeçalho fica só na mesa. */}
      <InsetGroup surface="page" className="md:hidden">
        <Link href="/proventos/reinvestimento" className={insetRowClass()}>
          <span className="tile size-8 rounded-lg [--tile:var(--tile-purple)] [&_svg]:size-4.5">
            <RepeatIcon aria-hidden="true" />
          </span>
          <span className="grid flex-1">
            Reinvestimento
            <span className="text-footnote text-muted-foreground">
              Quanto do aporte veio de proventos
            </span>
          </span>
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </InsetGroup>
      <UpcomingDividends
        rows={view.upcoming}
        undisclosed={view.undisclosed}
        forecastAsOf={view.forecastAsOf}
      />
      <DividendsHistory
        since={view.since}
        chart={view.chart}
        byMonth={view.byMonth}
        byYear={view.byYear}
        byTicker={view.byTicker}
      />
    </div>
  );
}

function DividendsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando os proventos">
      {/* Mesma quebra dos cards de verdade (container de 720 px), para a tela não pular. */}
      <div className="@container">
        <div className="grid gap-4 @min-[720px]:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
      <CardSkeleton height="h-40" />
      <CardSkeleton height="h-96" />
    </div>
  );
}
