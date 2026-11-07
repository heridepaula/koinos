"use client";

import { useEffect } from "react";

/*
 * Houve navegação dentro do app desde que a página carregou? Com ela, "voltar" é o `router.back()`
 * do iOS (a tela anterior, com a rolagem); sem ela (link aberto de fora, recarga), voltar para a
 * página-mãe evita sair do app. Vive no módulo: dura até a próxima carga da página.
 */
let lastPathname: string | null = null;
let navigated = false;

/** Registra cada troca de página. Use uma vez, num componente do layout que não desmonta. */
export function useTrackInAppNavigation(pathname: string) {
  useEffect(() => {
    if (lastPathname !== null && lastPathname !== pathname) navigated = true;
    lastPathname = pathname;
  }, [pathname]);
}

/** Leia no evento (clique), não na renderização. */
export function hasInAppHistory() {
  return navigated;
}
