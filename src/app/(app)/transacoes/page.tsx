import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Transações" };

export default function Page() {
  return <PageHeader title="Transações" description="Compras e vendas registradas." />;
}
