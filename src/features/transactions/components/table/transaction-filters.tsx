"use client";

import { CheckIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { SearchInput } from "@/shared/components/search-input";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import { NativeSelect } from "@/shared/ui/native-select";
import { SegmentedControl } from "@/shared/ui/segmented-control";

export const TYPES = ["todos", "compra", "venda"] as const;
export type TypeFilter = (typeof TYPES)[number];

const TYPE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "compra", label: "Compras" },
  { value: "venda", label: "Vendas" },
] as const;

type FilterProps = {
  ticker: string;
  type: TypeFilter;
  year: string;
  years: string[];
  /** Quantos lançamentos passam nos filtros (o botão da folha do celular mostra). */
  resultCount: number;
  onChange: (patch: { ativo?: string; tipo?: TypeFilter; ano?: string }) => void;
};

/**
 * Filtros: busca por ativo, tipo num controle segmentado e ano num pop-up, todos com 36 px (44 no
 * toque). No card estreito (o celular), só a busca fica à vista: o tipo e o ano vão para uma folha
 * de filtros, atrás de um botão que se acende quando algum está ligado.
 */
export function TransactionFilters(props: FilterProps) {
  const { ticker, type, year, years, onChange } = props;
  return (
    <>
      <div className="flex w-full items-center gap-2 @min-[640px]:hidden">
        <SearchInput
          aria-label="Filtrar por ativo"
          placeholder="Buscar ativo"
          wrapperClassName="flex-1"
          value={ticker}
          onChange={(event) => onChange({ ativo: event.target.value })}
        />
        <FiltersSheet {...props} />
      </div>
      <div className="hidden w-full grid-cols-[1fr_auto] gap-2 @min-[640px]:grid @min-[720px]:flex @min-[720px]:w-auto @min-[720px]:items-center">
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
    </>
  );
}

/** A folha de filtros do celular: o tipo no controle segmentado e o ano numa lista com check. */
function FiltersSheet({ type, year, years, resultCount, onChange }: FilterProps) {
  const [open, setOpen] = useState(false);
  const active = (type !== "todos" ? 1 : 0) + (year ? 1 : 0);
  const yearOptions = [
    { value: "", label: "Todos os anos" },
    ...years.map((y) => ({ value: y, label: y })),
  ];
  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        aria-label={active ? `Filtros (${active} ligados)` : "Filtros"}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("relative", active && "bg-info/12 text-info dark:bg-info/20")}
      >
        <SlidersHorizontalIcon />
        {active ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full bg-(--badge) text-[0.625rem] font-semibold text-white"
          >
            {active}
          </span>
        ) : null}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription className="sr-only">Tipo e ano dos lançamentos.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="grid content-start gap-6 pb-2">
            <section className="grid gap-1.5">
              <h3 className="px-4 text-footnote font-medium text-muted-foreground">Tipo</h3>
              <SegmentedControl
                label="Tipo de lançamento"
                value={type}
                options={TYPE_OPTIONS}
                onChange={(next) => onChange({ tipo: next })}
                className="w-full"
              />
            </section>
            <InsetGroup title="Ano" listRole="radiogroup">
              {yearOptions.map((option) => {
                const selected = option.value === year;
                return (
                  <button
                    key={option.value || "todos"}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ ano: option.value })}
                    className={insetRowClass()}
                  >
                    <span className="flex-1">{option.label}</span>
                    {selected ? (
                      <CheckIcon className="size-5 text-info" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </InsetGroup>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={() => setOpen(false)}>
              Mostrar {resultCount} {resultCount === 1 ? "lançamento" : "lançamentos"}
            </Button>
            {active ? (
              <Button variant="ghost" onClick={() => onChange({ tipo: "todos", ano: "" })}>
                Limpar filtros
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
