import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <PageHeader title="Dashboard" description="Visão geral da carteira." />;
}
