import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Recomendações" };

export default function Page() {
  return <PageHeader title="Recomendações" description="Onde aportar hoje, pelo método Suno." />;
}
