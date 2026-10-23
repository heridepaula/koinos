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
  if (!view.hasAny) return <EmptyDividends />;
  return (
    <div className="grid gap-6">
      <DividendMonthCards month={view.month} />
      <UpcomingDividends rows={view.upcoming} />
      <DividendsHistory view={view} />
    </div>
  );
}

function DividendsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando os proventos">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <CardSkeleton height="h-40" />
      <CardSkeleton height="h-96" />
    </div>
  );
}
