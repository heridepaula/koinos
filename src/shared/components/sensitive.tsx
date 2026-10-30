import type { ReactNode } from "react";

/**
 * Valor que o olho da barra esconde (patrimônio, resultados, proventos, cotas…). As duas versões
 * vão no HTML, e o CSS (`globals.css`) mostra uma ou outra pelo `data-privacy` do <html>: a troca
 * é instantânea, vale em Server Components e não pisca ao carregar. Sem o atributo, fica oculto.
 */
export function Sensitive({ children, mask = "R$ •••••" }: { children: ReactNode; mask?: string }) {
  return (
    <>
      <span data-sensitive-value="">{children}</span>
      <span data-sensitive-mask="" role="img" aria-label="Valor oculto">
        {mask}
      </span>
    </>
  );
}

/** Máscara de quantidades e números sem moeda. */
export const QUANTITY_MASK = "•••";
