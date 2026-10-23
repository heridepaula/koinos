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
          Importe os extratos da B3 (Negociação e Movimentação) ou registre as compras e vendas uma
          a uma.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/transacoes/importar" />}>
          Importar da B3
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/transacoes" />}>
          Registrar uma transação
        </Button>
      </EmptyContent>
    </Empty>
  );
}
