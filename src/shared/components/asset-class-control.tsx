"use client";

import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Suspense } from "react";
import { CLASS_PARAMS } from "@/shared/lib/class-filter";
import { cn } from "@/shared/lib/utils";
import { SegmentedControl } from "@/shared/ui/segmented-control";

const OPTIONS = [
  { value: "geral", label: "Geral" },
  { value: "fiis", label: "FIIs" },
  { value: "acoes", label: "Ações" },
] as const;

type Props = {
  /** true: só o cliente filtra (Transações). Por padrão o servidor relê a página. */
  shallow?: boolean;
  /** false: só FIIs | Ações, com FIIs como padrão (a Carteira Alvo). */
  includeAll?: boolean;
  className?: string;
};

/**
 * Visão Geral, FIIs ou Ações da página, em `?classe=` (spec etapa 2 das ações, §4). Cada página
 * tem a sua: abrir outra pelo menu começa em Geral. Trocar a classe volta as tabelas à página 1.
 */
export function AssetClassControl(props: Props) {
  return (
    // A URL só existe no navegador: fora do shell estático, com o mesmo tamanho reservado.
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={cn(
            "h-9 w-full rounded-full bg-secondary md:w-64 pointer-coarse:h-11",
            props.className,
          )}
        />
      }
    >
      <Control {...props} />
    </Suspense>
  );
}

function Control({ shallow = false, includeAll = true, className }: Props) {
  const [{ classe }, setParams] = useQueryStates(
    { classe: parseAsStringLiteral(CLASS_PARAMS), pagina: parseAsInteger },
    { history: "replace", shallow },
  );
  return (
    <SegmentedControl
      label="Classe de ativo"
      value={classe ?? (includeAll ? "geral" : "fiis")}
      options={includeAll ? OPTIONS : OPTIONS.slice(1)}
      onChange={(next) => {
        // Sem Geral, FIIs é o padrão: não precisa ficar na URL.
        const isDefault = next === "geral" || (!includeAll && next === "fiis");
        void setParams({ classe: isDefault ? null : next, pagina: null });
      }}
      className={cn("max-md:w-full md:min-w-64", className)}
    />
  );
}
