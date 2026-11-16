"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";

/**
 * Copia um texto para a área de transferência e mostra "Copiado" por 2 s. Sem permissão do
 * navegador, abre o texto selecionável embaixo do botão para copiar à mão.
 * `text` pode ser uma função, para montar o texto só no clique.
 */
export function CopyButton({
  text,
  label,
  iconOnly = false,
  size = "sm",
  onCopied,
}: {
  text: string | (() => string);
  label: string;
  iconOnly?: boolean;
  size?: "sm" | "default";
  /** Roda depois de uma cópia bem-sucedida (o aviso de que o texto leva valores). */
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    area.current?.select();
  }, [fallback]);

  async function copy() {
    const value = typeof text === "function" ? text() : text;
    try {
      await navigator.clipboard.writeText(value);
      setFallback(null);
      setCopied(true);
      onCopied?.();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(value);
      toast.error("O navegador não deixou copiar. Selecione o texto abaixo e copie.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? (size === "sm" ? "icon-sm" : "icon") : size}
        onClick={copy}
        aria-label={iconOnly ? (copied ? "Copiado" : label) : undefined}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {iconOnly ? null : copied ? "Copiado" : label}
      </Button>
      {fallback ? (
        <textarea
          ref={area}
          readOnly
          value={fallback}
          aria-label="Texto para copiar"
          className="mt-2 block h-40 w-full rounded-lg border border-input bg-transparent p-2 text-base md:text-sm"
        />
      ) : null}
    </>
  );
}
