"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ceilingCheckMessage, type CeilingCheck } from "../domain/ceiling";

const LABEL = "Teto diverge do calculado";

/**
 * Triângulo âmbar: o teto da Suno está a mais de 10% do calculado pela NTN-B (spec
 * divergencia-teto, §4). Com `tooltip={false}` vira só o ícone, para dentro de um botão (a linha
 * do celular), onde o texto sai numa folha.
 */
export function CeilingCheckIcon({
  check,
  ceiling,
  tooltip = true,
}: {
  check: CeilingCheck;
  /** O teto da Suno. */
  ceiling: number;
  tooltip?: boolean;
}) {
  const icon = <TriangleAlertIcon className="size-3.5 text-warn" aria-label={LABEL} />;
  if (!tooltip) return icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="relative inline-flex pointer-coarse:after:absolute pointer-coarse:after:-inset-3" />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{ceilingCheckMessage(check, ceiling)}</TooltipContent>
    </Tooltip>
  );
}
