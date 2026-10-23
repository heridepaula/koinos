import type { Metadata } from "next";
import { Suspense } from "react";
import { getDividendsView } from "@/features/portfolio/server";
import {
  DividendMonthCards,
  DividendsHistory,
  EmptyDividends,
  UpcomingDividends,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Proventos" };

// O cabeçalho vai no shell estático; tudo o que depende da sessão chega por streaming.
export default function DividendsPage() {
  return (
    <>
      <PageHeader title="Proventos" description="Recebidos, a receber e o histórico." />
      <Suspense fallback={<DividendsSkeleton />}>
        <DividendsContent />
      </Suspense>
    </>
  );
}

async function DividendsContent() {
  const view = await getDividendsView();
  if (!view.imported) return <EmptyDividends />;
  return (
    <div className="grid gap-6">
      <DividendMonthCards month={view.month} />
      <UpcomingDividends rows={view.upcoming} />
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
