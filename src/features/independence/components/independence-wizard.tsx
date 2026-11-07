"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Sensitive } from "@/shared/components/sensitive";
import { StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { saveIndependencePlanAction } from "../actions";
import {
  HEALTH_OPTIONS,
  LIVING_OPTIONS,
  PEOPLE_MAX,
  PEOPLE_OPTIONS,
  PLAN_AMOUNT_MAX,
  RETENTION_LABELS,
  RETENTION_OPTIONS,
  TRAVEL_OPTIONS,
} from "../domain/catalog";
import { independenceSummary } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";
import { ChoiceList } from "./choice-list";
import { forecastLine } from "./format";

const STEPS = [
  {
    title: "Custo de vida",
    question:
      "Quanto a casa gasta por mês com moradia, alimentação, contas, lazer de rotina e cartão?",
  },
  { title: "Família", question: "Quantas pessoas fazem parte do seu orçamento?" },
  { title: "Plano de saúde", question: "Que cobertura médica você quer ter, por pessoa?" },
  { title: "Viagens", question: "Quantas viagens de lazer você pretende fazer por ano?" },
  {
    title: "Proteção contra a inflação",
    question: "Quanto dos proventos você vai reinvestir todo mês para não perder poder de compra?",
  },
  { title: "Resumo", question: "Confira a conta antes de salvar." },
] as const;

const clampAmount = (value: number | null) => Math.min(PLAN_AMOUNT_MAX, Math.max(0, value ?? 0));

/**
 * O questionário da meta: um passo por vez, cada resposta preenche um valor sugerido que o dono
 * pode ajustar, e o resumo final refaz a conta com as mesmas funções puras da página.
 */
export function IndependenceWizard({
  initial,
  patrimony,
  monthlyDividends,
  monthlyAporte,
  currentMonth,
  onCancel,
  onSaved,
}: {
  initial: IndependencePlan;
  patrimony: number;
  monthlyDividends: number;
  monthlyAporte: number;
  currentMonth: string;
  /** Com plano salvo: volta aos cards sem salvar. */
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [step, setStep] = useState(0);
  const amountId = useId();
  const save = useAction(saveIndependencePlanAction, {
    onSuccess: () => {
      toast.success("Meta salva.");
      onSaved?.();
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const last = STEPS.length - 1;
  const current = STEPS[step]!;
  const answer = <K extends keyof IndependencePlan["answers"]>(
    key: K,
    value: IndependencePlan["answers"][K],
    patch: Partial<IndependencePlan>,
  ) => setPlan((old) => ({ ...old, ...patch, answers: { ...old.answers, [key]: value } }));

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Passo {step + 1} de {STEPS.length} · {current.title}
        </CardDescription>
        <CardTitle>{current.question}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {step === 0 ? (
          <>
            <ChoiceList
              label={current.title}
              value={plan.answers.living}
              options={LIVING_OPTIONS}
              onChange={(key) =>
                answer("living", key, {
                  livingCost: LIVING_OPTIONS.find((o) => o.key === key)!.value,
                })
              }
            />
            <AmountField
              id={amountId}
              label="Custo de vida por mês"
              value={plan.livingCost}
              onChange={(livingCost) => setPlan((old) => ({ ...old, livingCost }))}
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <ChoiceList
              label={current.title}
              value={plan.answers.people}
              options={PEOPLE_OPTIONS}
              onChange={(key) =>
                answer("people", key, { people: PEOPLE_OPTIONS.find((o) => o.key === key)!.value })
              }
            />
            <div className="grid max-w-60 gap-2">
              <Label htmlFor={amountId}>Pessoas no orçamento</Label>
              <Input
                id={amountId}
                type="number"
                inputMode="numeric"
                min={1}
                max={PEOPLE_MAX}
                step={1}
                value={plan.people}
                className="max-md:text-base"
                onChange={(event) => {
                  const people = Math.trunc(Number(event.target.value));
                  if (Number.isFinite(people)) {
                    setPlan((old) => ({
                      ...old,
                      people: Math.min(PEOPLE_MAX, Math.max(1, people)),
                    }));
                  }
                }}
              />
              <p className="text-footnote text-muted-foreground">
                Só multiplica o plano de saúde: o custo de vida já é o da casa.
              </p>
            </div>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <ChoiceList
              label={current.title}
              value={plan.answers.health}
              options={HEALTH_OPTIONS}
              onChange={(key) =>
                answer("health", key, {
                  healthPerPerson: HEALTH_OPTIONS.find((o) => o.key === key)!.value,
                })
              }
            />
            <AmountField
              id={amountId}
              label="Plano de saúde por pessoa, por mês"
              value={plan.healthPerPerson}
              onChange={(healthPerPerson) => setPlan((old) => ({ ...old, healthPerPerson }))}
              hint={`× ${plan.people} ${plan.people === 1 ? "pessoa" : "pessoas"} = ${formatBRL(plan.healthPerPerson * plan.people)} por mês`}
            />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <ChoiceList
              label={current.title}
              value={plan.answers.travel}
              options={TRAVEL_OPTIONS}
              onChange={(key) =>
                answer("travel", key, {
                  travelPerYear: TRAVEL_OPTIONS.find((o) => o.key === key)!.value,
                })
              }
            />
            <AmountField
              id={amountId}
              label="Viagens por ano"
              value={plan.travelPerYear}
              onChange={(travelPerYear) => setPlan((old) => ({ ...old, travelPerYear }))}
              hint={`${formatBRL(plan.travelPerYear / 12)} por mês`}
            />
          </>
        ) : null}
        {step === 4 ? (
          <ChoiceList
            label={current.title}
            value={String(plan.retention)}
            options={RETENTION_OPTIONS.map((retention) => ({
              key: String(retention),
              label: formatPercent(retention, 0),
              detail: RETENTION_LABELS[retention],
            }))}
            onChange={(key) => setPlan((old) => ({ ...old, retention: Number(key) }))}
          />
        ) : null}
        {step === last ? (
          <WizardSummary
            plan={plan}
            patrimony={patrimony}
            monthlyDividends={monthlyDividends}
            monthlyAporte={monthlyAporte}
            currentMonth={currentMonth}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeftIcon />
                Voltar
              </Button>
            ) : null}
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
          </div>
          {step < last ? (
            <Button onClick={() => setStep(step + 1)}>
              Avançar
              <ArrowRightIcon />
            </Button>
          ) : (
            <Button disabled={save.isPending} onClick={() => save.execute(plan)}>
              {save.isPending ? "Salvando…" : "Salvar meta"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="grid max-w-80 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput
        id={id}
        defaultValue={value}
        className="max-md:text-base"
        onValueChange={(next) => onChange(clampAmount(next))}
      />
      <p className="text-footnote text-muted-foreground">
        {hint ? `${hint}. ` : null}Valor sugerido pela resposta; ajuste se quiser.
      </p>
    </div>
  );
}

function WizardSummary(props: {
  plan: IndependencePlan;
  patrimony: number;
  monthlyDividends: number;
  monthlyAporte: number;
  currentMonth: string;
}) {
  const summary = independenceSummary(props);
  const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;
  return (
    <StatList>
      <StatRow label="Renda líquida por mês" value={money(summary.need)} />
      <StatRow
        label={`Renda bruta (${formatPercent(props.plan.retention, 0)} reinvestidos)`}
        value={money(summary.gross)}
      />
      <StatRow
        label={`Yield ${summary.yieldSource === "carteira" ? "da carteira" : "padrão"}`}
        value={`${formatPercent(summary.monthlyYield)} a.m.`}
      />
      <StatRow label="Patrimônio necessário" value={money(summary.target)} />
      <StatRow label="Prazo no ritmo atual" value={forecastLine(summary)} />
    </StatList>
  );
}
