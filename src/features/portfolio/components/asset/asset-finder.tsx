"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { isFiiSubType, useTickerSearch } from "@/features/market-data/ui";
import { SearchInput } from "@/shared/components/search-input";
import { useTabBarAction } from "@/shared/components/tab-bar-action";
import type { AssetWatchlist, WatchlistRow } from "../../domain/types";
import { CatalogRow, WatchRow } from "./watch-row";

/** Os ativos do dono que batem com a busca: ticker que começa com o termo primeiro. */
function matchMine(rows: readonly WatchlistRow[], term: string): WatchlistRow[] {
  const starts = rows.filter((row) => row.ticker.startsWith(term));
  const contains = rows.filter(
    (row) =>
      !row.ticker.startsWith(term) &&
      (row.ticker.includes(term) || (row.name ?? "").toUpperCase().includes(term)),
  );
  return [...starts, ...contains];
}

/** Um grupo da lista: título pequeno e as linhas num bloco, em 1, 2 ou 3 colunas. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="px-1 text-footnote font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-x-1 rounded-2xl p-1.5 card-surface @min-[720px]:grid-cols-2 @min-[1180px]:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl px-4 py-6 text-sm text-muted-foreground card-surface">{children}</p>
  );
}

/**
 * A tela de busca, como a do app Bolsa: o campo no topo e, embaixo, os ativos do dono (as posições,
 * da maior para a menor, e a Carteira Alvo sem posição, na ordem do ranking). Ao digitar, a lista
 * vira o resultado: primeiro os ativos do dono, na hora, e depois o catálogo da B3. O termo fica na
 * URL (`?q=`): voltar de um ativo devolve a busca como estava.
 */
export function AssetFinder({ watchlist }: { watchlist: AssetWatchlist }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ history: "replace", throttleMs: 300 }),
  );
  const term = query.trim().toUpperCase();
  const { results, pending } = useTickerSearch(term);

  // No iPhone, o botão ao lado da tab bar põe o cursor na busca (no toque, o teclado sobe).
  useTabBarAction({
    label: "Buscar ativo",
    icon: SearchIcon,
    onPress: () => input.current?.focus(),
  });

  // Na mesa, a busca abre com o cursor no campo; no iPhone, o teclado cobriria a lista.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
  }, []);

  const mine = [...watchlist.held, ...watchlist.target];
  const mineByTicker = new Map(mine.map((row) => [row.ticker, row]));
  const searching = term.length > 0;
  const localMatches = searching ? matchMine(mine, term) : [];
  const localTickers = new Set(localMatches.map((row) => row.ticker));
  // Um ativo do dono que só o catálogo achou (pelo nome) entra no grupo dele, com a cotação.
  const mineMatches = [
    ...localMatches,
    ...results
      .map((item) => mineByTicker.get(item.ticker))
      .filter((row): row is WatchlistRow => row !== undefined && !localTickers.has(row.ticker)),
  ];
  const catalogMatches = results.filter((item) => !mineByTicker.has(item.ticker));
  const found = mineMatches.length + catalogMatches.length;

  const links = () => [
    ...(list.current?.querySelectorAll<HTMLElement>("[data-finder-item]") ?? []),
  ];

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      links()[0]?.focus();
    } else if (event.key === "Enter") {
      const first = links()[0]?.getAttribute("href");
      if (searching && first) {
        event.preventDefault();
        router.push(first);
      }
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = links();
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && index === 0) input.current?.focus();
    else
      items[
        Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)
      ]?.focus();
  }

  return (
    <div className="@container grid gap-6">
      <SearchInput
        ref={input}
        id="asset-search"
        value={query}
        onChange={(event) => void setQuery(event.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="Ticker ou nome"
        aria-label="Buscar ativo por ticker ou nome"
        aria-controls={listId}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="search"
        wrapperClassName="w-full @min-[720px]:max-w-md"
        className="h-11"
      />

      <p className="sr-only" aria-live="polite">
        {searching && !pending
          ? `${found} ${found === 1 ? "ativo encontrado" : "ativos encontrados"}`
          : ""}
      </p>

      <div id={listId} ref={list} onKeyDown={onListKeyDown} className="grid gap-6">
        {searching ? (
          <>
            {mineMatches.length > 0 ? (
              <Group title="Seus ativos">
                {mineMatches.map((row) => (
                  <WatchRow key={row.ticker} row={row} />
                ))}
              </Group>
            ) : null}
            {catalogMatches.length > 0 ? (
              <Group title="Catálogo da B3">
                {catalogMatches.map((item) => (
                  <CatalogRow
                    key={item.ticker}
                    ticker={item.ticker}
                    name={item.name}
                    logoUrl={item.logoUrl}
                    kind={isFiiSubType(item.subType) ? "FII" : "Ação"}
                  />
                ))}
              </Group>
            ) : null}
            {found === 0 ? (
              <Note>
                {pending
                  ? "Buscando no catálogo da B3…"
                  : term.length < 2
                    ? "Digite mais uma letra para buscar no catálogo da B3."
                    : `Nenhum ativo encontrado para “${query.trim()}”.`}
              </Note>
            ) : null}
          </>
        ) : mine.length === 0 ? (
          <Note>
            Sua carteira e a Carteira Alvo ainda estão vazias. Busque um ticker para ver o que o app
            sabe dele.
          </Note>
        ) : (
          <>
            {watchlist.held.length > 0 ? (
              <Group title={`Na carteira · ${watchlist.held.length}`}>
                {watchlist.held.map((row) => (
                  <WatchRow key={row.ticker} row={row} />
                ))}
              </Group>
            ) : null}
            {watchlist.target.length > 0 ? (
              <Group title={`Na Carteira Alvo, sem posição · ${watchlist.target.length}`}>
                {watchlist.target.map((row) => (
                  <WatchRow key={row.ticker} row={row} />
                ))}
              </Group>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
