import { HandCoinsIcon } from "lucide-react";
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

export function EmptyDividends() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HandCoinsIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum provento ainda</EmptyTitle>
        <EmptyDescription>
          Os proventos recebidos vêm do extrato de Movimentação da B3. Importe os extratos para ver
          o histórico.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href="/transacoes/importar" />}>
          Importar da B3
        </Button>
      </EmptyContent>
    </Empty>
  );
}
