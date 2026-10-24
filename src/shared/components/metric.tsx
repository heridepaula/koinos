import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";

/**
 * Card de número, no espírito dos cards do app Saúde: rótulo com azulejo colorido, o valor em
 * Title 1 e, logo abaixo, a lista de detalhes. Numa grade, o cabeçalho tem a mesma altura em
 * todos os cards, então as listas começam na mesma linha e as linhas se alinham de card a card.
 */
export function MetricCard({
  icon: Icon,
  tile,
  label,
  value,
  children,
  className,
}: {
  icon?: LucideIcon;
  /** Gradiente do azulejo, como `[--tile:var(--tile-teal)]`. */
  tile?: string;
  label: ReactNode;
  value: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("card-lift", className)}>
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2 text-subheadline text-muted-foreground">
          {Icon ? (
            <span className={cn("tile size-6 rounded-sm", tile)}>
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
          {label}
        </div>
        {/* Altura fixa na entrelinha do Title 1: com ou sem a seta do Delta, o fio de baixo fica
            na mesma linha em todos os cards. */}
        <div className="flex h-[2.125rem] items-center text-title-1 tabular-nums">{value}</div>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

/** Lista de detalhes de um card de número: separada do valor por um fio de cabelo. */
export function StatList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid border-t border-border/70 pt-3", className)}>{children}</dl>;
}

/** Linha "rótulo ······ valor", com 28 px de altura e o valor alinhado à direita. */
export function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Par vertical "rótulo / valor" para cabeçalhos, como os números do topo do app Bolsa. */
export function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-footnote text-muted-foreground">{label}</dt>
      <dd className="text-headline tabular-nums">{value}</dd>
    </div>
  );
}

/** Nota de rodapé de um card de número, separada do valor pelo mesmo fio de cabelo da lista. */
export function MetricNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-border/70 pt-3 text-footnote text-muted-foreground">{children}</p>
  );
}
