import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { resolveReportYear } from "@/features/tax-report";
import { getTaxReportView } from "@/features/tax-report/server";
import { TaxReportPanel } from "@/features/tax-report/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Imposto de Renda" };

// Cobre a Server Action chamada a partir desta página (`generateTaxNarrativesAction`, prazo de 120 s
// no serviço). O corte de 30 s do cron-job.org não vale aqui: a ação roda a pedido do usuário.
export const maxDuration = 120;

// O cabeçalho vai no shell estático; o relatório (sessão, banco e a data de hoje) chega por streaming.
export default function TaxReportPage({ searchParams }: PageProps<"/imposto-de-renda">) {
  return (
    <>
      <PageHeader
        title="Imposto de Renda"
        description="O que declarar do ano-calendário: bens, proventos e a apuração das vendas."
      />
      <div className="mt-6">
        <Suspense fallback={<CardSkeleton height="h-96" />}>
          <TaxReportContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function TaxReportContent({
  searchParams,
}: Pick<PageProps<"/imposto-de-renda">, "searchParams">) {
  const { ano } = await searchParams;
  // A data de hoje só existe em tempo de requisição: sem `connection()` antes, o prerender recusa
  // o `new Date()` e a página volta para o Dashboard.
  await connection();
  const year = resolveReportYear(ano, new Date());
  const view = await getTaxReportView(year);
  return <TaxReportPanel view={view} />;
}
