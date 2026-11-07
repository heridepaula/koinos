"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StatList, StatRow } from "@/shared/components/metric";
import { MoneyInput } from "@/shared/components/money-input";
import { Sensitive } from "@/shared/components/sensitive";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { saveIndependencePlanAction } from "../actions";
import { HEALTH_LEVEL_LABELS } from "../domain/catalog";
import {
  CURRENT_AGE_RANGE,
  DEPENDENTS_MAX,
  EXTERNAL_WEALTH_MAX,
  PLAN_AMOUNT_MAX,
  SPOUSE_AGE_RANGE,
  TARGET_AGE_MAX,
  YOUNGEST_AGE_MAX,
  type EducationUntil,
} from "../domain/constants";
import { HEALTH_LEVELS, healthCost, type HealthLevel } from "../domain/health";
import { independenceSummary } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";
import { ChoiceList } from "./choice-list";
import { forecastLine } from "./format";

type StepKey =
  "perfil" | "essencial" | "sazonal" | "familia" | "educacao" | "saude" | "viagens" | "resumo";

const STEP_TEXT: Record<StepKey, { title: string; question: string }> = {
  perfil: { title: "Perfil", question: "De onde você parte e quando quer parar?" },
  essencial: {
    title: "Custo de vida essencial",
    question: "Quanto você gasta por mês com moradia, contas, mercado e cartões?",
  },
  sazonal: {
    title: "Bens e sazonalidades",
    question: "Quanto vão por ano em IPVA, IPTU, seguros e manutenção?",
  },
  familia: { title: "Família", question: "Quem mais depende do seu orçamento?" },
  educacao: {
    title: "Educação",
    question: "Quanto custam hoje a escola, os cursos e a van dos dependentes?",
  },
  saude: {
    title: "Plano de saúde",
    question: "Que cobertura médica você quer ter na independência?",
  },
  viagens: {
    title: "Estilo de vida",
    question: "Quanto você quer gastar por ano com viagens e lazer extra?",
  },
  resumo: { title: "Resumo", question: "Confira a conta antes de salvar." },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const YES_NO = [
  { value: "nao", label: "Não" },
  { value: "sim", label: "Sim" },
] as const;

/**
 * O questionário da meta (spec v2 §3): um passo por vez, valores exatos, e o resumo final refaz a
 * conta com as mesmas funções puras da página. Sem dependentes, o passo da educação é pulado.
 */
export function IndependenceWizard({
  initial,
  koinosWealth,
  monthlyAporte,
  currentMonth,
  notice,
  onCancel,
  onSaved,
}: {
  initial: IndependencePlan;
  koinosWealth: number;
  monthlyAporte: number;
  currentMonth: string;
  /** Aviso no topo (o plano da v1 que ganhou perguntas novas). */
  notice?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [position, setPosition] = useState(0);
  const save = useAction(saveIndependencePlanAction, {
    onSuccess: () => {
      toast.success("Meta salva.");
      onSaved?.();
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const steps: StepKey[] = [
    "perfil",
    "essencial",
    "sazonal",
    "familia",
    ...(plan.dependents > 0 ? (["educacao"] as const) : []),
    "saude",
    "viagens",
    "resumo",
  ];
  const index = Math.min(position, steps.length - 1);
  const step = steps[index]!;
  const last = steps.length - 1;
  const set = (patch: Partial<IndependencePlan>) => setPlan((old) => ({ ...old, ...patch }));
  const yearsToTarget = Math.max(0, plan.targetAge - plan.currentAge);

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Passo {index + 1} de {steps.length} · {STEP_TEXT[step].title}
        </CardDescription>
        <CardTitle>{STEP_TEXT[step].question}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {notice && index === 0 ? (
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm">{notice}</p>
        ) : null}
        {step === "perfil" ? (
          <div className="@container grid gap-4">
            <div className="grid gap-4 @min-[480px]:grid-cols-2">
              <NumberField
                label="Idade atual"
                value={plan.currentAge}
                min={CURRENT_AGE_RANGE.min}
                max={CURRENT_AGE_RANGE.max}
                onChange={(currentAge) =>
                  set({ currentAge, targetAge: Math.max(plan.targetAge, currentAge) })
                }
              />
              <NumberField
                label="Idade alvo para parar"
                value={plan.targetAge}
                min={plan.currentAge}
                max={TARGET_AGE_MAX}
                onChange={(targetAge) => set({ targetAge })}
              />
            </div>
            <MoneyField
              label="Patrimônio fora do Koinos (opcional)"
              hint="Somado ao da carteira para o progresso e o prazo."
              value={plan.externalWealth}
              max={EXTERNAL_WEALTH_MAX}
              onChange={(externalWealth) => set({ externalWealth })}
            />
          </div>
        ) : null}
        {step === "essencial" ? (
          <MoneyField
            label="Gasto mensal fixo"
            value={plan.essentialMonthly}
            onChange={(essentialMonthly) => set({ essentialMonthly })}
          />
        ) : null}
        {step === "sazonal" ? (
          <MoneyField
            label="Estimativa por ano"
            hint={`${formatBRL(plan.seasonalYearly / 12)} por mês na conta.`}
            value={plan.seasonalYearly}
            onChange={(seasonalYearly) => set({ seasonalYearly })}
          />
        ) : null}
        {step === "familia" ? (
          <div className="grid gap-5">
            <YesNo
              label="Cônjuge no orçamento?"
              value={plan.spouseAge !== null}
              onChange={(yes) => set({ spouseAge: yes ? plan.currentAge : null })}
            >
              {plan.spouseAge !== null ? (
                <NumberField
                  label="Idade do cônjuge"
                  value={plan.spouseAge}
                  min={SPOUSE_AGE_RANGE.min}
                  max={SPOUSE_AGE_RANGE.max}
                  onChange={(spouseAge) => set({ spouseAge })}
                />
              ) : null}
            </YesNo>
            <YesNo
              label="Possui dependentes financeiros?"
              value={plan.dependents > 0}
              onChange={(yes) =>
                set(yes ? { dependents: 1, youngestAge: 5 } : { dependents: 0, youngestAge: null })
              }
            >
              {plan.dependents > 0 ? (
                <div className="@container grid gap-4">
                  <div className="grid gap-4 @min-[480px]:grid-cols-2">
                    <NumberField
                      label="Quantos dependentes"
                      value={plan.dependents}
                      min={1}
                      max={DEPENDENTS_MAX}
                      onChange={(dependents) => set({ dependents })}
                    />
                    <NumberField
                      label="Idade do mais novo hoje"
                      value={plan.youngestAge ?? 0}
                      min={0}
                      max={YOUNGEST_AGE_MAX}
                      onChange={(youngestAge) => set({ youngestAge })}
                    />
                  </div>
                </div>
              ) : null}
            </YesNo>
          </div>
        ) : null}
        {step === "educacao" ? (
          <div className="grid gap-5">
            <MoneyField
              label="Custo mensal atual com educação"
              hint="Somado de todos os dependentes. A conta corrige 8% ao ano e cobra 13 mensalidades por ano."
              value={plan.educationMonthly}
              onChange={(educationMonthly) => set({ educationMonthly })}
            />
            <div className="grid gap-2">
              <span className="text-sm font-medium">Até qual idade o mais novo será custeado?</span>
              <ChoiceList
                label="Idade final do custeio"
                value={String(plan.educationUntil)}
                options={[
                  { key: "18", label: "18 anos", detail: "Fim do ensino médio" },
                  { key: "24", label: "24 anos", detail: "Fim da faculdade" },
                ]}
                onChange={(key) => set({ educationUntil: Number(key) as EducationUntil })}
              />
            </div>
          </div>
        ) : null}
        {step === "saude" ? (
          <ChoiceList
            label={STEP_TEXT.saude.title}
            value={plan.healthLevel}
            options={HEALTH_LEVELS.map((level) => ({
              key: level,
              label: HEALTH_LEVEL_LABELS[level].label,
              detail: healthDetail(level, plan.targetAge),
            }))}
            onChange={(healthLevel) => set({ healthLevel: healthLevel as HealthLevel })}
          />
        ) : null}
        {step === "viagens" ? (
          <MoneyField
            label="Orçamento por ano"
            hint={`${formatBRL(plan.travelYearly / 12)} por mês na conta.`}
            value={plan.travelYearly}
            onChange={(travelYearly) => set({ travelYearly })}
          />
        ) : null}
        {step === "resumo" ? (
          <WizardSummary
            plan={plan}
            koinosWealth={koinosWealth}
            monthlyAporte={monthlyAporte}
            currentMonth={currentMonth}
            yearsToTarget={yearsToTarget}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" onClick={() => setPosition(index - 1)}>
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
          {index < last ? (
            <Button onClick={() => setPosition(index + 1)}>
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

function healthDetail(level: HealthLevel, targetAge: number): string {
  const { detail } = HEALTH_LEVEL_LABELS[level];
  if (level === "nenhum") return detail;
  return `${detail} · ${formatBRL(healthCost(level, targetAge))} por pessoa aos ${targetAge} anos`;
}

function MoneyField({
  label,
  hint,
  value,
  max = PLAN_AMOUNT_MAX,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid max-w-80 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput
        id={id}
        defaultValue={value}
        className="max-md:text-base"
        onValueChange={(next) => onChange(clamp(next ?? 0, 0, max))}
      />
      {hint ? <p className="text-footnote text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Campo de número inteiro (idades, quantidade). Valores fora da faixa ficam no limite. */
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  // O valor de fora manda quando muda sem vir da digitação (a idade alvo que acompanha a atual).
  if (value !== last) {
    setLast(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <div className="grid max-w-60 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={text}
        className="max-md:text-base"
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Math.trunc(Number(event.target.value));
          if (event.target.value !== "" && Number.isFinite(parsed)) {
            onChange(clamp(parsed, min, max));
          }
        }}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: boolean;
  onChange: (yes: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <SegmentedControl
          label={label}
          value={value ? "sim" : "nao"}
          options={YES_NO}
          onChange={(next) => onChange(next === "sim")}
        />
      </div>
      {children}
    </div>
  );
}

function WizardSummary({
  plan,
  koinosWealth,
  monthlyAporte,
  currentMonth,
  yearsToTarget,
}: {
  plan: IndependencePlan;
  koinosWealth: number;
  monthlyAporte: number;
  currentMonth: string;
  yearsToTarget: number;
}) {
  const summary = independenceSummary({ plan, koinosWealth, monthlyAporte, currentMonth });
  const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;
  return (
    <StatList>
      <StatRow label="Renda perpétua por mês" value={money(summary.perpetualIncome)} />
      <StatRow label="Meta perpétua" value={money(summary.perpetual)} />
      <StatRow label="Fundo temporário" value={money(summary.temporary)} />
      <StatRow label="Meta total" value={money(summary.target)} />
      <StatRow label="Prazo no ritmo atual" value={forecastLine(summary)} />
      {summary.requiredAporte !== null ? (
        <StatRow
          label={`Aporte para parar aos ${plan.targetAge} (${yearsToTarget} anos)`}
          value={money(summary.requiredAporte)}
        />
      ) : null}
    </StatList>
  );
}
