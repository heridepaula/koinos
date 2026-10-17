import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Carteira Alvo" };

export default function Page() {
  return (
    <PageHeader
      title="Carteira Alvo"
      description="Ranking, preço teto e % sugerida de cada ativo."
    />
  );
}
