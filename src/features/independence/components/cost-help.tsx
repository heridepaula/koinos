"use client";

import { CircleHelpIcon } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * O "?" na frente de um custo: explica que tipo de gasto é e dá exemplos. Abre ao passar o mouse
 * ou focar; o toque também abre e fecha, porque o celular não tem hover.
 */
export function CostHelp({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        aria-label={`O que é: ${label}`}
        onClick={() => setOpen((value) => !value)}
        render={
          <button
            type="button"
            className="relative inline-flex shrink-0 text-muted-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
          />
        }
      >
        <CircleHelpIcon className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent className="text-left leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}
