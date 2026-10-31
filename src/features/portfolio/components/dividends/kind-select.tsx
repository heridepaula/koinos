"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense } from "react";
import { DIVIDEND_KIND_LABELS, DIVIDEND_KINDS } from "@/features/transactions";
import { NativeSelect } from "@/shared/ui/native-select";

const KIND_PARAMS = DIVIDEND_KINDS.map((kind) => kind.toLowerCase()) as Lowercase<
  (typeof DIVIDEND_KINDS)[number]
>[];

/** Tipo de provento da página, em `?tipo=` (spec etapa 2, §6.2). O servidor relê a página. */
export function DividendKindSelect() {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="h-9 w-44 rounded-lg bg-secondary pointer-coarse:h-11" />
      }
    >
      <KindSelect />
    </Suspense>
  );
}

function KindSelect() {
  const [kind, setKind] = useQueryState(
    "tipo",
    parseAsStringLiteral(KIND_PARAMS).withOptions({ history: "replace", shallow: false }),
  );
  return (
    <NativeSelect
      aria-label="Tipo de provento"
      value={kind ?? ""}
      onChange={(event) =>
        void setKind(
          event.target.value === "" ? null : (event.target.value as (typeof KIND_PARAMS)[number]),
        )
      }
      wrapperClassName="max-md:w-full"
      className="max-md:w-full"
    >
      <option value="">Todos os tipos</option>
      {DIVIDEND_KINDS.map((item) => (
        <option key={item} value={item.toLowerCase()}>
          {DIVIDEND_KIND_LABELS[item]}
        </option>
      ))}
    </NativeSelect>
  );
}
