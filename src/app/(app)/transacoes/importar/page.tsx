import type { Metadata } from "next";
import { B3ImportWizard } from "@/features/transactions/ui";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Importar da B3" };

export default function ImportB3Page() {
  return (
    <>
      <PageHeader
        title="Importar da B3"
        description="Envie os extratos da Área do Investidor. No período deles, os lançamentos de FIIs passam a ser os da B3."
      />
      <B3ImportWizard />
    </>
  );
}
