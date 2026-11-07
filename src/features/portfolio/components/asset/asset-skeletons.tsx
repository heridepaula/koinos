import { Skeleton } from "@/shared/ui/skeleton";

/** O esqueleto da página do ativo, na geometria dela: cabeçalho, cotação e a coluna da direita. */
export function AssetPageSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando o ativo">
      <div className="flex items-center gap-3 md:gap-4">
        <Skeleton className="size-12 rounded-[12px] md:size-14 md:rounded-[14px]" />
        <div className="grid gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="@container">
        <div className="grid gap-4 md:gap-6 @min-[1000px]:grid-cols-[minmax(0,1fr)_22.5rem]">
          <Skeleton className="h-[30rem] rounded-2xl" />
          <div className="grid content-start gap-4 md:gap-6 @min-[720px]:grid-cols-2 @min-[1000px]:grid-cols-1">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** O esqueleto da busca: o campo e algumas linhas da lista. */
export function AssetFinderSkeleton() {
  return (
    <div className="@container grid gap-6" aria-busy="true" aria-label="Carregando os ativos">
      <Skeleton className="h-11 w-full rounded-full @min-[720px]:max-w-md" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-x-1 gap-y-2 rounded-2xl p-1.5 card-surface @min-[720px]:grid-cols-2 @min-[1180px]:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
