import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getReinvestmentView } from "@/features/portfolio/server";
import {
  MonthPicker,
  PurchasesTable,
  ReinvestmentCards,
  ReinvestmentHistory,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = { title: "Reinvestimento" };

export default function ReinvestmentPage({ searchParams }: PageProps<"/proventos/reinvestimento">) {
  return (
    <>
      <PageHeader
        title="Reinvestimento"
        description="Quanto do aporte do mês veio de proventos e quanto saiu do bolso."
        actions={
          <Button variant="outline" render={<Link href="/proventos" />}>
            <ArrowLeftIcon />
            Proventos
          </Button>
        }
      />
      {/* searchParams é dado da requisição: fica dentro de <Suspense>, como no login. */}
      <Suspense fallback={<CardSkeleton height="h-40" />}>
        <ReinvestmentContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReinvestmentContent({
  searchParams,
}: Pick<PageProps<"/proventos/reinvestimento">, "searchParams">) {
  const params = await searchParams;
  const view = await getReinvestmentView(typeof params.mes === "string" ? params.mes : null);
  return (
    <div className="grid gap-6">
      <MonthPicker month={view.month} months={view.months} />
      <ReinvestmentCards key={view.month} current={view.current} />
      <PurchasesTable rows={view.purchases} />
      <ReinvestmentHistory history={view.history} last12={view.last12} />
    </div>
  );
}
