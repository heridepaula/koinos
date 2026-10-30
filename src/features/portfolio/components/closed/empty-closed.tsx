import { ArchiveIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";

export function EmptyClosedPositions() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArchiveIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma posição encerrada</EmptyTitle>
        <EmptyDescription>
          Quando você vender toda a posição de um ativo, ele aparece aqui com o resultado das vendas
          e o IR estimado.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
