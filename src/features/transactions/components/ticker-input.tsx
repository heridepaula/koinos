"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useId } from "react";
import { Input } from "@/shared/ui/input";

type TickerSuggestion = { ticker: string; name: string; subType: string | null };

async function searchTickers(query: string): Promise<TickerSuggestion[]> {
  const response = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  return response.json();
}

/** Campo de ticker com sugestões do catálogo da B3 (datalist nativo: acessível e funciona no celular). */
export function TickerInput({
  value,
  onChange,
  id,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const query = useDeferredValue(value.trim().toUpperCase());
  const { data = [] } = useQuery({
    queryKey: ["tickers", query],
    queryFn: () => searchTickers(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
  });

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        placeholder="BTLG11"
        autoComplete="off"
        maxLength={6}
        aria-invalid={invalid || undefined}
      />
      <datalist id={listId}>
        {data.map((item) => (
          <option key={item.ticker} value={item.ticker}>
            {item.name !== item.ticker ? item.name : (item.subType ?? "")}
          </option>
        ))}
      </datalist>
    </>
  );
}
