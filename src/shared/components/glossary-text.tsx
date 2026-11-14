"use client";

import { Fragment } from "react";
import { glossaryEntry, glossarySegments, type GlossaryClass } from "@/shared/lib/glossary";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Um termo do mercado: sublinhado pontilhado; o significado abre no hover (desktop) ou no toque. */
export function GlossaryTerm({ id, children }: { id: string; children: string }) {
  const entry = glossaryEntry(id);
  if (!entry) return <>{children}</>;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={300}
        render={
          <button
            type="button"
            aria-label={`${entry.term}: ver significado`}
            className="relative inline underline decoration-dotted underline-offset-4 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] pointer-fine:after:hidden"
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-70 gap-1 p-3">
        <p className="text-headline">{entry.term}</p>
        <p className="text-subheadline text-muted-foreground">{entry.definition}</p>
      </PopoverContent>
    </Popover>
  );
}

/** O texto com os termos do glossário (escopo da classe; null aceita todos) marcados. */
export function GlossaryText({
  text,
  assetClass,
  methodTerms = false,
}: {
  text: string;
  assetClass: GlossaryClass | null;
  /** Inclui meta, teto e lista do método: só onde a tela os pede (nunca em texto de IA). */
  methodTerms?: boolean;
}) {
  return (
    <>
      {glossarySegments(text, assetClass, methodTerms ? { method: true } : undefined).map(
        (segment, index) =>
          segment.kind === "term" ? (
            <GlossaryTerm key={index} id={segment.id}>
              {segment.value}
            </GlossaryTerm>
          ) : (
            <Fragment key={index}>{segment.value}</Fragment>
          ),
      )}
    </>
  );
}
