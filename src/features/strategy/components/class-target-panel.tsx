"use client";

import { ChevronRightIcon, PieChartIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { InsetGroup, insetRowClass } from "@/shared/components/inset-list";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/shared/ui/responsive-dialog";
import { setClassTargetAction } from "../actions";
import { NumberField } from "./table/number-field";

const NO_TARGET = "Sem meta: o aporte vai todo para FIIs.";
const EXPLANATION =
  "Quanto do aporte vai para FIIs e quanto para ações. O campo salva ao sair; as ações ficam com o resto.";

const validatePercent = (value: number | null) =>
  value === null || (value >= 0 && value <= 100) ? null : "A % de FIIs fica entre 0 e 100.";

/** Meta entre as classes: a % de FIIs é editável e a de ações é o que sobra (spec aporte por classe). */
export function ClassTargetPanel({
  target,
  values,
}: {
  target: { fiiPercent: number } | null;
  values: { FII: number; ACAO: number };
}) {
  const [open, setOpen] = useState(false);
  const action = useAction(setClassTargetAction, {
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const fii = target?.fiiPercent ?? null;
  const total = values.FII + values.ACAO;
  const todayFii = total > 0 ? values.FII / total : 0;
  const today =
    total > 0
      ? `Hoje: FIIs ${formatPercent(todayFii, 1)} · Ações ${formatPercent(1 - todayFii, 1)}`
      : "Hoje: sem posições";
  const summary = fii === null ? NO_TARGET : `FIIs ${fii}% · Ações ${100 - fii}%`;

  function field(id?: string) {
    return (
      <NumberField
        value={fii}
        label="% de FIIs"
        integer
        validate={validatePercent}
        onCommit={(value) => {
          // Vazio não apaga a meta: o campo volta ao valor salvo.
          if (value === null) {
            toast.error("Informe a % de FIIs, de 0 a 100.");
            return;
          }
          action.execute({ fiiPercent: value });
        }}
        className={id}
      />
    );
  }

  return (
    <>
      <Card size="sm" className="max-md:hidden">
        <CardHeader>
          <CardTitle>Meta entre classes</CardTitle>
          <CardDescription>{EXPLANATION}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">FIIs {field()} %</span>
          <span className="text-muted-foreground tabular-nums">
            {fii === null ? NO_TARGET : `Ações ${100 - fii}%`}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{today}</span>
        </CardContent>
      </Card>
      <InsetGroup surface="page" className="md:hidden">
        <ResponsiveDialog open={open} onOpenChange={setOpen}>
          <ResponsiveDialogTrigger
            render={
              <button type="button" className={insetRowClass()}>
                <span className="tile size-8 rounded-lg [--tile:var(--tile-purple)] [&_svg]:size-4.5">
                  <PieChartIcon aria-hidden="true" />
                </span>
                <span className="grid flex-1">
                  Meta entre classes
                  <span className="text-footnote text-muted-foreground">{summary}</span>
                  <span className="text-footnote text-muted-foreground">{today}</span>
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            }
          />
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Meta entre classes</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>{EXPLANATION}</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              <InsetGroup footer={fii === null ? NO_TARGET : undefined}>
                <div className={insetRowClass(false)}>
                  <span className="flex-1">% de FIIs</span>
                  {field("max-md:text-base")}
                </div>
                <div className={insetRowClass(false)}>
                  <span className="flex-1">% de ações</span>
                  <span className="text-muted-foreground tabular-nums">
                    {fii === null ? "—" : `${100 - fii}%`}
                  </span>
                </div>
              </InsetGroup>
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </InsetGroup>
    </>
  );
}
