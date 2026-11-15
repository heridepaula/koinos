# Listas paginadas (Recebidos do ativo e Transações) — design

**Data:** 2026-11-14 · **Pedido do dono:** a lista "Recebidos" do card Proventos de `/ativos/[ticker]` passa a ser paginada como a tabela de Transações, e, se possível, com uma peça reutilizável por todas as tabelas que listam dados.

## 1. Objetivo

Recebidos do ativo com páginas na URL (10/50/100 por página, página fora da faixa volta para a última), no mesmo rodapé `Pagination` de Transações.
Uma única peça de paginação (função pura + hook + rodapé) usada pelas duas telas; as demais tabelas ficam para a próxima etapa.

## 2. Decisões

| # | Decisão | Motivo |
| - | ------- | ------ |
| D1 | **Sem componente `DataTable` com colunas.** A peça reutilizável é: a função pura `paginate` (`src/shared/lib/paginate.ts`), o hook `usePagedRows` (`src/shared/hooks/use-paged-rows.ts`) e o rodapé `Pagination` que já existe. Colunas, cabeçalhos ordenáveis e a lista do celular continuam no chamador. | As tabelas diferem demais (cabeçalho `SortableHead`, ações, linha expansível, lista do celular com outra marcação ou sem páginas). E um componente com `renderRow`/colunas recebe funções, que não atravessam a fronteira Server → Client: toda tabela que o usasse teria de virar client inteira. Hook + rodapé custam duas linhas por tabela e não forçam isso. |
| D2 | **`Pagination` é reaproveitada, não absorvida.** Ganha só `className?` (mesclado com `cn`) e exporta o tipo das props, `PaginationProps<Size>`. | O rodapé já é o padrão visual; o card de Proventos tem padding próprio no `CardContent` e precisa tirar o `px-(--card-spacing)` do rodapé (`className="px-0"`). |
| D3 | **Função pura só para fatiar e corrigir a página** (`paginate`). Ordenar continua `sortRows` (`shared/lib/sort.ts`); filtrar continua o `rows.filter` de cada tela. | Ordenar já é puro e testável; um "filtro genérico" não teria regra própria, só repassaria o predicado. O que hoje está inline e sem teste é a conta de páginas (`transactions-table.tsx:72-76`). |
| D4 | **`PAGE_SIZES = [10, 50, 100]` e o padrão 10 vão para `paginate.ts`**, compartilhados. Transações apaga a constante local. | "No padrão da tabela de transações": mesmos tamanhos e padrão. |
| D5 | **Chaves de URL por lista**, pelo `urlKeys` do `useQueryStates` (nuqs 2.10, conferido em `node_modules/nuqs/dist/index.d.ts:487-488`). Padrão `pagina`/`por` (Transações, sem mudança de URL; o `AssetClassControl` continua zerando `pagina`). Recebidos: `recebidos`/`recebidos-por`. | `/ativos/[ticker]` já usa `?periodo=` (`price-chart.tsx:42`) e o card Ordens da mesma página vai ganhar páginas (próxima etapa, `ordens`/`ordens-por`); `pagina` genérico colidiria entre os dois cards. |
| D6 | **Opções do hook:** `history: "replace"` e o `shallow` padrão do nuqs (true), como Transações. `clearOnDefault` é o padrão do nuqs 2 (true): página 1 e 10 por página não ficam na URL. | A página não relê o servidor; o voltar do navegador não deve andar página por página. |
| D7 | **Recebidos vira um client component pequeno** (`received-list.tsx`, `"use client"`), e o `DividendsCard` continua Server Component. A linha `MoneyRow` sai para `money-row.tsx` (sem diretiva, sem hooks) e é usada pelos dois. | nuqs lê a URL com hooks, que exigem client. Só a lista precisa disso; o resto do card (A receber, barras) fica no servidor. Os itens (`paidAt: Date`, `kind`, `amount`, `perShare`) são serializáveis nas props (Date passa pelo RSC). `Sensitive` não tem hooks e funciona nos dois lados. |
| D8 | **O rodapé de Recebidos só aparece com mais de 10 recebidos** (`received.length > PAGE_SIZES[0]`). Com até 10, a lista mostra todos, sem rodapé. Em todas as larguras (é uma lista só, não há tabela + lista do celular). | Um rodapé "1–3 de 3, Página 1 de 1" num card estreito é ruído. Transações não muda (o rodapé continua sempre visível ali). |
| D9 | **Suspense:** nenhum novo. `ReceivedList` renderiza dentro do `<Suspense>` de `AssetContent` (`app/(app)/ativos/[ticker]/page.tsx:36`), como o `PriceChart` que já usa `useQueryState`; `TransactionsTable` já está dentro do Suspense da sua página. | Os hooks do nuqs leem `useSearchParams`, que precisa de Suspense com `cacheComponents`; já existe. |
| D10 | **A lista do celular de Transações continua com "Mostrar mais"** (`transactions-list.tsx`, `STEP = 20`), sem páginas. | Escolha iOS já registrada no componente; fora do pedido. |

## 3. Arquivos

### 3.1 `src/shared/lib/paginate.ts` (novo, puro)

```ts
export const PAGE_SIZES = [10, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type PageSlice<T> = {
  /** As linhas da página corrigida. Cópia: a entrada não muda. */
  rows: T[];
  /** A página corrigida, de 1 a pageCount. */
  page: number;
  /** Ao menos 1, mesmo sem linhas. */
  pageCount: number;
  /** Índice (base 0) da primeira linha da página na lista inteira. */
  firstIndex: number;
  total: number;
};

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): PageSlice<T>;
```

Regras de `paginate`:

- `pageSize` que não seja inteiro positivo → `RangeError` (mensagem `"pageSize inválido: <valor>"`).
- `page` não finito (NaN, ±Infinity) conta como 1; fracionário é truncado (`Math.trunc`).
- `pageCount = Math.max(1, Math.ceil(rows.length / pageSize))`.
- `page = Math.min(Math.max(1, page), pageCount)`: abaixo de 1 vai para 1, acima vai para a última.
- `firstIndex = (page - 1) * pageSize`; `rows = rows.slice(firstIndex, firstIndex + pageSize)`; `total = rows.length` da entrada.

### 3.2 `src/shared/components/pagination.tsx` (alterar)

- Exportar `export type PaginationProps<Size extends number> = { …as props de hoje…; className?: string }`.
- `Pagination<Size>(props: PaginationProps<Size>)`; o `div` raiz passa a `className={cn("flex flex-wrap … pt-4 text-sm text-muted-foreground", className)}` com `cn` de `@/shared/lib/utils`. Nada mais muda (texto, botões, select).

### 3.3 `src/shared/hooks/use-paged-rows.ts` (novo, `"use client"`)

```ts
export type PageKeys = { page: string; size: string };
export const DEFAULT_PAGE_KEYS: PageKeys = { page: "pagina", size: "por" };

export function usePagedRows<T>(
  rows: readonly T[],
  keys: PageKeys = DEFAULT_PAGE_KEYS,
): {
  rows: T[];
  /** Espalhar em <Pagination {...pagination} itemLabel="…" />. */
  pagination: Omit<PaginationProps<PageSize>, "itemLabel" | "className">;
  /** Volta à página 1 (filtro ou ordem mudou). */
  resetPage: () => void;
};
```

Corpo:

- `useQueryStates({ page: parseAsInteger.withDefault(1), size: parseAsNumberLiteral(PAGE_SIZES).withDefault(DEFAULT_PAGE_SIZE) }, { history: "replace", urlKeys: { page: keys.page, size: keys.size } })`.
- `const slice = paginate(rows, state.page, state.size)`.
- `pagination = { page: slice.page, pageCount: slice.pageCount, pageSize: state.size, pageSizes: PAGE_SIZES, total: slice.total, firstIndex: slice.firstIndex, shown: slice.rows.length, onPage: (next) => void set({ page: next }), onPageSize: (size) => void set({ size, page: null }) }`.
- `resetPage = () => void set({ page: null })`.
- Retorna `{ rows: slice.rows, pagination, resetPage }`. Sem `useMemo` (fatiar é barato).
- Importa `PaginationProps` como `import type` de `@/shared/components/pagination`.

### 3.4 `src/features/transactions/components/transactions-table.tsx` (alterar, comportamento igual)

- Tirar `pagina` e `por` do `useQueryStates` de filtros (fica `ativo`, `tipo`, `ano`, `classe`; remover `parseAsInteger` e `parseAsNumberLiteral` do import) e apagar `const PAGE_SIZES`.
- Depois de `const sorted = …`: `const paged = usePagedRows(sorted);` (chaves padrão `pagina`/`por`, a URL não muda).
- Apagar as linhas de `pageCount`, `page`, `firstIndex`, `pageRows` (72-76); o `TableBody` mapeia `paged.rows`.
- `sortBy`: `toggle(key); paged.resetPage();`.
- `TransactionFilters onChange`: `(patch) => { void setFilters(patch); paged.resetPage(); }` (o nuqs junta as duas escritas numa atualização da URL).
- Rodapé: `<Pagination {...paged.pagination} itemLabel="Lançamentos" />`, ainda dentro do `div hidden @min-[640px]:block`.
- Hook chamado antes de qualquer `return` condicional (o componente não tem nenhum; manter assim).

### 3.5 `src/features/portfolio/components/asset/money-row.tsx` (novo, sem diretiva)

- Mover `MoneyRow` de `dividends-card.tsx` sem mudança e exportá-lo: `export function MoneyRow({ date, detail, amount, perShare, unit }: { date: string; detail: string; amount: number; perShare: number | null; unit: string })`.

### 3.6 `src/features/portfolio/components/asset/received-list.tsx` (novo, `"use client"`)

```ts
type Received = AssetOverview["received"][number];
export function ReceivedList({ items, unit }: { items: Received[]; unit: string }): JSX.Element;
```

- `const paged = usePagedRows(items, { page: "recebidos", size: "recebidos-por" });`
- `<ul className="divide-y divide-border/70">` com `paged.rows.map((item, index) => <MoneyRow key={`${item.paidAt.toISOString()}-${item.kind}-${paged.pagination.firstIndex + index}`} date={formatTradeDate(item.paidAt)} detail={DIVIDEND_KIND_LABELS[item.kind]} amount={item.amount} perShare={item.perShare} unit={unit} />)`.
- Depois da lista, só quando `items.length > PAGE_SIZES[0]`: `<Pagination {...paged.pagination} itemLabel="Recebidos" className="px-0" />`.
- Retorna um fragmento (o `section` e o `h3` ficam no card).

### 3.7 `src/features/portfolio/components/asset/dividends-card.tsx` (alterar)

- Apagar `VISIBLE`, `visible`, `rest`, `ReceivedRows`, o `MoneyRow` local, o tipo `Received` e o import de `Disclosure`; importar `MoneyRow` de `./money-row` e `ReceivedList` de `./received-list`.
- A seção Recebidos passa a depender de `received.length > 0` e contém o `h3` "Recebidos" e `<ReceivedList items={received} unit={unit} />`.
- O card continua sem `"use client"`.

### 3.8 `CLAUDE.md` (alterar uma linha)

- Na lista de testes cobertos, junto de `nice-scale`/`sparkline`: "`shared/lib/paginate.test.ts` (a página corrigida para a faixa, a última parcial, sem linhas, o `pageSize` inválido)".
- Em Rendering, na lista do que vive na URL por `nuqs`: acrescentar "as páginas das listas (`usePagedRows`: `?pagina=&por=` por padrão, `?recebidos=&recebidos-por=` nos Recebidos do ativo)".

## 4. Testes

`src/shared/lib/paginate.test.ts` (Vitest, `import { describe, expect, it } from "vitest"`), com `const rows = Array.from({ length: 25 }, (_, i) => i)`:

1. `paginate(rows, 1, 10)` → `rows` 0..9, `page` 1, `pageCount` 3, `firstIndex` 0, `total` 25.
2. `paginate(rows, 3, 10)` → `rows` 20..24 (5 itens), `firstIndex` 20.
3. Página acima da faixa: `paginate(rows, 9, 10).page` é 3 e as linhas são 20..24.
4. Página 0 e −2 → `page` 1.
5. `NaN` e `Infinity` → `page` 1; `2.7` → `page` 2.
6. Lista vazia: `paginate([], 4, 10)` → `rows` [], `page` 1, `pageCount` 1, `firstIndex` 0, `total` 0.
7. Múltiplo exato: 20 linhas, tamanho 10 → `pageCount` 2; página 2 tem 10 linhas.
8. Tamanho maior que a lista: `paginate(rows, 1, 50)` → 25 linhas, `pageCount` 1.
9. `pageSize` 0, −1 e 1.5 → `toThrow(RangeError)`.
10. Não muda a entrada e devolve outro array (`result.rows !== rows` quando o tamanho cobre tudo; `rows` intacto).
11. `PAGE_SIZES` é `[10, 50, 100]` e `DEFAULT_PAGE_SIZE` é 10.

O hook e os componentes não ganham teste (a suíte cobre só código puro).

## 5. Ordem dos passos

1. `paginate.ts` + `paginate.test.ts` (3.1, §4), test-first.
2. `pagination.tsx`: `className` e `PaginationProps` (3.2).
3. `use-paged-rows.ts` (3.3). Depende de 1 e 2.
4. `transactions-table.tsx` com `usePagedRows` (3.4). Depende de 3.
5. `money-row.tsx` + `received-list.tsx` + `dividends-card.tsx` (3.5–3.7), um só agente (mesmos arquivos do card). Depende de 3; pode correr em paralelo com 4.
6. `CLAUDE.md` (3.8).
7. Checks: `format:check`, `lint`, `typecheck`, `test`, `build`. Conferência visual com o chrome-devtools: `/ativos/<ticker com mais de 10 recebidos>` (mudar página, mudar para 50, `?recebidos=999` cai na última, `?periodo=` junto não interfere) e `/transacoes` (página, tamanho, filtro volta à página 1, trocar a classe volta à página 1).

## 6. Próxima etapa (listadas, sem mudança agora)

Levantamento por `rg "Pagination|Mostrar mais|VISIBLE =|<Table"` em `src/`:

- `portfolio/components/asset/orders-card.tsx` — `Disclosure` "Mostrar mais", `VISIBLE = 5`, Server Component. Mesmo caminho dos Recebidos: `OrderList` client com chaves `ordens`/`ordens-por`.
- `transactions/components/table/transactions-list.tsx` — lista do celular com "Mostrar mais" (`STEP = 20`); fica (D10) a menos que o dono peça páginas também no celular.
- `transactions/components/b3-import/preview-sections.tsx` — `Disclosure` "Ver os N ativos ok" no preview da atualização B3 (lista transitória, não é histórico).
- Tabelas que mostram todas as linhas, sem página hoje: `portfolio/components/positions-table.tsx` (client), `portfolio/components/closed/closed-table.tsx`, `portfolio/components/closed/tax-table.tsx`, `portfolio/components/closed-positions.tsx` (card do Dashboard), `portfolio/components/reinvestment/purchases-table.tsx`, `portfolio/components/dividends/dividends-history.tsx` (client), `portfolio/components/dividends/upcoming-list.tsx`, `strategy/components/strategy-table.tsx` (client), `smart-buy/components/aporte/orders.tsx` (client). As de posições, Carteira Alvo e ordens do aporte são limitadas pelo número de ativos (~50); as que crescem com o tempo são as encerradas, o IR e o histórico de proventos. As Server Components precisariam do mesmo corte do D7 (só a lista vira client).

## 7. Fora do escopo

- Componente `DataTable`/colunas declarativas (D1), filtro genérico, paginação no servidor (todas as listas já chegam inteiras ao cliente).
- Mudar o rodapé de Transações para sumir com poucas linhas.
- Páginas na lista do celular de Transações.
- Qualquer tabela da seção 6.
