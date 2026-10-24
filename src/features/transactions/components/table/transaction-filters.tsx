"use client";

import { SearchInput } from "@/shared/components/search-input";
import { NativeSelect } from "@/shared/ui/native-select";
import { SegmentedControl } from "@/shared/ui/segmented-control";

export const TYPES = ["todos", "compra", "venda"] as const;
export type TypeFilter = (typeof TYPES)[number];

const TYPE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "compra", label: "Compras" },
  { value: "venda", label: "Vendas" },
] as const;

/**
 * Filtros: busca por ativo, tipo num controle segmentado e ano num pop-up. Todos com 36 px (44 no
 * toque). No celular, a busca e o ano dividem a primeira linha, e o controle segmentado ocupa a
 * segunda inteira, com os três segmentos da mesma largura.
 */
export function TransactionFilters({
  ticker,
  type,
  year,
  years,
  onChange,
}: {
  ticker: string;
  type: TypeFilter;
  year: string;
  years: string[];
  onChange: (patch: { ativo?: string; tipo?: TypeFilter; ano?: string }) => void;
}) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto] gap-2 @min-[720px]:flex @min-[720px]:w-auto @min-[720px]:items-center">
      <SearchInput
        aria-label="Filtrar por ativo"
        placeholder="Buscar ativo"
        wrapperClassName="@min-[720px]:order-1 @min-[720px]:w-44"
        value={ticker}
        onChange={(event) => onChange({ ativo: event.target.value })}
      />
      <SegmentedControl
        label="Tipo de lançamento"
        value={type}
        options={TYPE_OPTIONS}
        onChange={(next) => onChange({ tipo: next })}
        className="order-3 col-span-2 w-full @min-[720px]:order-2 @min-[720px]:w-fit"
      />
      <NativeSelect
        aria-label="Filtrar por ano"
        wrapperClassName="order-2 @min-[720px]:order-3"
        value={year}
        onChange={(event) => onChange({ ano: event.target.value })}
      >
        <option value="">Todos os anos</option>
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
