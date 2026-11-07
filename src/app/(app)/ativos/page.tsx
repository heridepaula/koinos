import type { Metadata } from "next";
import { AssetSearch } from "@/features/market-data/ui";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Ativos" };

export default function AssetsPage() {
  return (
    <>
      <PageHeader
        title="Ativos"
        description="Busque um FII ou uma ação para ver mercado, estratégia, posição e proventos."
      />
      <div className="flex justify-center pt-8 md:pt-16">
        <AssetSearch autoFocus />
      </div>
    </>
  );
}
