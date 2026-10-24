import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function CardSkeleton({ height = "h-72" }: { height?: string }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`${height} w-full`} />
      </CardContent>
    </Card>
  );
}

/** Esqueleto do dashboard com a mesma geometria do conteúdo: patrimônio, três cards e um gráfico. */
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:gap-6" aria-busy="true" aria-label="Carregando dados da carteira">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return <CardSkeleton height="h-96" />;
}
