"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Input } from "@/shared/ui/input";

type Suggestion = { ticker: string; name: string; subType: string | null };

async function search(query: string): Promise<Suggestion[]> {
  const response = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`);
  return response.ok ? response.json() : [];
}

const kindOf = (subType: string | null) =>
  subType === "fii" || subType === "fi-agro" ? "FII" : "Ação";

/** Busca de ativos do catálogo, com prévia. Não busca dados de mercado: só leva à página. */
export function AssetSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim().toUpperCase()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const { data = [] } = useQuery({
    queryKey: ["tickers", debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  function go(ticker: string) {
    setOpen(false);
    router.push(`/ativos/${ticker}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, data.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter") {
      const typed = text.trim().toUpperCase();
      if (active >= 0 && data[active]) go(data[active].ticker);
      else if (/^[A-Z0-9]{5,6}$/.test(typed)) go(typed);
    }
  }

  const showList = open && data.length > 0;
  return (
    <div className="relative w-full max-w-xl">
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Buscar ativo"
        placeholder="Buscar ativo (ticker ou nome)"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-popover p-1 shadow-lg"
        >
          {data.map((item, index) => (
            <li
              key={item.ticker}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown dispara antes do blur do campo, que fecharia a lista.
              onMouseDown={() => go(item.ticker)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-accent aria-selected:bg-accent"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{item.ticker}</span>
                {item.name !== item.ticker ? (
                  <span className="ml-2 text-footnote text-muted-foreground">{item.name}</span>
                ) : null}
              </span>
              <span className="text-caption text-muted-foreground">{kindOf(item.subType)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
