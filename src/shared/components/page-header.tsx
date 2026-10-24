import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Cabeçalho da página no estilo Large Title: no iPhone, o título grande do iOS (34 px) e nada de
 * descrição, que só repetiria o título; na mesa, Title 1 (28 px) com a descrição em Subheadline.
 * O tracking fecha como o do SF Pro Display. `data-page-title` deixa as barras do topo mostrarem o
 * título compacto quando este passa por baixo delas.
 */
export function PageHeader({
  title,
  description,
  actions,
  mobileActions = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * `false` quando, no iPhone, as ações estão em outro lugar: o voltar na barra de navegação, a
   * ação principal ao lado da tab bar ou um atalho no conteúdo. Elas continuam montadas.
   */
  mobileActions?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="grid gap-1">
        <h1 data-page-title className="font-heading text-large-title md:text-title-1">
          {title}
        </h1>
        {description ? (
          <p className="text-subheadline text-muted-foreground max-md:hidden">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn("flex items-center gap-2", !mobileActions && "max-md:hidden")}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
