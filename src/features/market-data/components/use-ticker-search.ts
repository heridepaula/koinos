"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type TickerSuggestion = {
  ticker: string;
  name: string;
  subType: string | null;
  logoUrl: string | null;
};

async function search(query: string): Promise<TickerSuggestion[]> {
  const response = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`);
  return response.ok ? response.json() : [];
}

/** FII (FIIs e Fiagros) ou ação, pelo subtipo do catálogo da brapi. */
export const isFiiSubType = (subType: string | null) => subType === "fii" || subType === "fi-agro";

/**
 * Busca no catálogo da B3 (`/api/tickers`) 300 ms depois da última tecla, a partir de 2 letras.
 * Só o catálogo: nenhum dado de mercado é buscado aqui.
 */
export function useTickerSearch(query: string) {
  const term = query.trim().toUpperCase();
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const enabled = debounced.length >= 2;
  const result = useQuery({
    queryKey: ["tickers", debounced],
    queryFn: () => search(debounced),
    enabled,
    staleTime: 5 * 60_000,
  });
  return {
    results: enabled ? (result.data ?? []) : [],
    /** Ainda esperando a pausa da digitação ou a resposta do catálogo. */
    pending: term.length >= 2 && (term !== debounced || result.isFetching),
  };
}
