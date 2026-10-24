import type { ReactNode } from "react";

/**
 * Cabeçalho da página no estilo Large Title: título 28/34 em negrito, com o tracking fechado do
 * SF Pro Display, e a descrição no estilo Subheadline. `data-page-title` deixa a barra do topo
 * mostrar o título compacto quando este sai da tela.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="grid gap-1">
        <h1 data-page-title className="font-heading text-title-1">
          {title}
        </h1>
        {description ? (
          <p className="text-subheadline text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
