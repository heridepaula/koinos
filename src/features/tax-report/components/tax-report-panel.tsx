"use client";

import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, type ReactNode } from "react";
import { NativeSelect } from "@/shared/ui/native-select";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { cn } from "@/shared/lib/utils";
import { TAX_DISCLAIMER } from "../domain/export";
import type { TaxReportView } from "../domain/types";
import { ApurationTab } from "./apuration-table";
import { AuditList } from "./audit-list";
import { BensTable } from "./bens-table";
import { ExportBar } from "./export-bar";
import { ExclusiveTab, ExemptTab } from "./proventos-tables";

const TABS = [
  { value: "resumo", label: "Resumo e auditoria" },
  { value: "bens", label: "Bens e Direitos" },
  { value: "isentos", label: "Rendimentos isentos" },
  { value: "exclusiva", label: "Tributação exclusiva" },
  { value: "vendas", label: "Vendas e apuração" },
] as const;

type TabId = (typeof TABS)[number]["value"];
const TAB_IDS = TABS.map((tab) => tab.value) as [TabId, ...TabId[]];

/**
 * A tela do relatório de IR: o seletor de ano, a barra de exportação e as cinco abas. Todas as
 * abas estão no HTML (só a ativa aparece na tela), para a impressão levar o relatório completo
 * pela área `data-print-area`. A aba fica em `?aba=` e o ano em `?ano=` (o servidor lê o ano).
 */
export function TaxReportPanel({ view }: { view: TaxReportView }) {
  const [tab, setTab] = useQueryState(
    "aba",
    parseAsStringLiteral(TAB_IDS).withDefault("resumo").withOptions({ history: "replace" }),
  );
  const [, setYear] = useQueryState("ano", parseAsInteger.withOptions({ shallow: false }));
  const { report } = view;
  const identities = useMemo(
    () => new Map(view.identities.map((identity) => [identity.ticker, identity])),
    [view.identities],
  );
  const years = useMemo(
    () => [...new Set([view.year, ...view.years])].sort((a, b) => b - a),
    [view.year, view.years],
  );

  const sections: Record<TabId, ReactNode> = {
    resumo: <AuditList report={report} narratives={view.narratives} />,
    bens: (
      <BensTable
        year={view.year}
        positions={report.positions}
        identities={identities}
        narratives={view.narratives.positions}
      />
    ),
    isentos: <ExemptTab report={report} />,
    exclusiva: <ExclusiveTab report={report} />,
    vendas: <ApurationTab report={report} />,
  };

  return (
    <div className="grid gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4" data-print-hide>
        <label className="flex items-center gap-2 text-subheadline">
          Ano-calendário
          <NativeSelect
            value={view.year}
            onChange={(event) => void setYear(Number(event.target.value))}
            wrapperClassName="w-28"
            aria-label="Ano-calendário do relatório"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </NativeSelect>
        </label>
        <ExportBar report={report} />
      </div>

      <div data-print-hide>
        <SegmentedControl
          value={tab}
          onChange={(next) => void setTab(next)}
          options={TABS}
          label="Seção do relatório"
          className="max-xl:hidden"
        />
        <NativeSelect
          value={tab}
          onChange={(event) => void setTab(event.target.value as TabId)}
          wrapperClassName="w-full xl:hidden"
          aria-label="Seção do relatório"
        >
          {TABS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div data-print-area className="grid gap-4 md:gap-6">
        <h2 className="hidden text-title-1 print:block">
          Relatório de IR · ano-calendário {view.year}
        </h2>
        {TABS.map((item) => (
          <section
            key={item.value}
            data-print-section
            aria-label={item.label}
            className={cn("grid gap-4", tab !== item.value && "hidden print:grid")}
          >
            <h3 className="hidden text-title-2 print:block">{item.label}</h3>
            {sections[item.value]}
          </section>
        ))}
        <p className="text-footnote text-muted-foreground">{TAX_DISCLAIMER}</p>
      </div>
    </div>
  );
}
