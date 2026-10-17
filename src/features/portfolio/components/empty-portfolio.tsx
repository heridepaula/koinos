import { WalletIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";

export function EmptyPortfolio() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WalletIcon />
        </EmptyMedia>
        <EmptyTitle>Sua carteira ainda está vazia</EmptyTitle>
        <EmptyDescription>
          Registre as compras e vendas, ou importe a planilha com{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run import:planilha</code>.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/transacoes" />}>Registrar uma transação</Button>
      </EmptyContent>
    </Empty>
  );
}
