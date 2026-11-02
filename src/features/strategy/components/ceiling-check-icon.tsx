"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { CeilingCheck } from "../domain/ceiling";
import { CeilingCheckBody } from "./ceiling-check-body";

/**
 * Triângulo verde (positivo) ou vermelho (negativo): o teto da Suno está a mais de 10% do calculado pela NTN-B (spec
 * divergencia-teto, §4). Fica ao lado do preço teto. O tooltip traz o sinal (positivo ou
 * negativo), os valores, a conta e o preço atual contra o calculado. Com `tooltip={false}` vira só
 * o ícone, para dentro de um botão (a linha do celular), onde o texto sai numa folha.
 */
export function CeilingCheckIcon({
  check,
  ceiling,
  price = null,
  tooltip = true,
}: {
  check: CeilingCheck;
  /** O teto da Suno. */
  ceiling: number;
  /** O preço atual, se o aviso tiver de compará-lo com o teto calculado. */
  price?: number | null;
  tooltip?: boolean;
}) {
  // O triângulo leva a cor do sinal: verde se o calculado está acima do teto da Suno (positivo),
  // vermelho se está abaixo (negativo). Os dois são os tokens AA do projeto sobre o card.
  const positive = check.divergence > 0;
  const icon = (
    <TriangleAlertIcon
      className={positive ? "size-3.5 text-gain" : "size-3.5 text-loss"}
      aria-label={`Teto diverge do calculado: ${positive ? "positivo" : "negativo"}`}
    />
  );
  if (!tooltip) return icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="relative inline-flex pointer-coarse:after:absolute pointer-coarse:after:-inset-4" />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="block w-72 max-w-[calc(100vw-2rem)] px-3.5 py-3 text-xs"
      >
        <CeilingCheckBody check={check} ceiling={ceiling} price={price} surface="inverse" />
      </TooltipContent>
    </Tooltip>
  );
}
