import type { Metadata } from "next";
import { B3ImportWizard } from "@/features/transactions/ui";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Atualização da B3" };

export default function B3UpdatePage() {
  return (
    <>
      <PageHeader
        title="Atualização da B3"
        description="Envie os três extratos da Área do Investidor: o que for novo entra, e o que a B3 mostrar diferente substitui o que está gravado."
      />
      <B3ImportWizard />
    </>
  );
}
