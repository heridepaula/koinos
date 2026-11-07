"use client";

import { ArrowLeftIcon, ChevronRightIcon, FlagIcon, InfoIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/shared/components/money-input";
import { Sensitive } from "@/shared/components/sensitive";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
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
  REAL_MONTHLY_RATE,
  SPOUSE_AGE_RANGE,
  TARGET_AGE_MAX,
  YOUNGEST_AGE_MAX,
  type EducationUntil,
} from "../domain/constants";
import { HEALTH_LEVELS, healthCost, type HealthLevel } from "../domain/health";
import { independenceSummary } from "../domain/plan";
import type { IndependencePlan } from "../domain/types";
import { ChoiceList } from "./choice-list";
import { VerdictChip } from "./figures";
import { forecastVerdict } from "./format";
import { ProgressBar } from "./progress-bar";
import {
  nextStep,
  planAnswers,
  previousStep,
  STEP_TEXT,
  stepImpact,
  wizardSteps,
  type ReturnToReview,
  type StepKey,
} from "./wizard-steps";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const money = (value: number) => <Sensitive>{formatBRL(value)}</Sensitive>;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const RATE = formatPercent(REAL_MONTHLY_RATE, 1);
const YES_NO = [
  { value: "nao", label: "Não" },
  { value: "sim", label: "Sim" },
] as const;

type SetPlan = (patch: Partial<IndependencePlan>) => void;

/**
 * O questionário da meta (spec v2 §3), no estilo dos assistentes do macOS: uma pergunta por vez
 * numa coluna estreita, a barra de passos no topo, o valor em R$ em destaque com o quanto ele soma
 * à meta, e o Enter avançando. A revisão refaz a conta com as mesmas funções puras da página e
 * lista as respostas: tocar numa leva ao passo dela, e o passo volta direto para a revisão.
 */
export function IndependenceWizard({
  initial,
  start = "perfil",
  koinosWealth,
  monthlyAporte,
  currentMonth,
  notice,
  reviewFooter,
  onCancel,
  onSaved,
}: {
  initial: IndependencePlan;
  /** "revisao" para editar uma meta salva: abre na revisão. */
  start?: StepKey;
  koinosWealth: number;
  monthlyAporte: number;
  currentMonth: string;
  /** Aviso no primeiro passo (o plano da v1 que ganhou perguntas novas). */
  notice?: string;
  /** Embaixo das respostas, só na revisão: o "Excluir meta" de quem edita uma meta salva. */
  reviewFooter?: ReactNode;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [step, setStep] = useState<StepKey>(start);
  const [returning, setReturning] = useState<ReturnToReview | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  // O foco vai para o passo novo a cada navegação e, na edição, já ao abrir. Na primeira visita,
  // a página carrega sem roubar o foco.
  const focusStep = useRef(start === "revisao");
  const stepRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const save = useAction(saveIndependencePlanAction, {
    onSuccess: () => {
      toast.success("Meta salva.");
      onSaved?.();
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  const steps = wizardSteps(plan);
  const index = Math.max(0, steps.indexOf(step));
  const reviewing = step === "revisao";
  const set: SetPlan = (patch) => setPlan((old) => ({ ...old, ...patch }));

  useEffect(() => {
    if (!focusStep.current) return;
    focusStep.current = false;
    const field = stepRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]), [role='radio'][tabindex='0']",
    );
    (field ?? headingRef.current)?.focus();
  }, [step]);

  function go(to: StepKey, towards: "forward" | "back") {
    focusStep.current = true;
    setDirection(towards);
    setStep(to);
  }

  function advance() {
    if (reviewing) {
      save.execute(plan);
      return;
    }
    const to = nextStep(plan, step, returning);
    if (to === "revisao") setReturning(null);
    go(to, "forward");
  }

  function edit(target: StepKey) {
    setReturning({ dependents: plan.dependents });
    go(target, "back");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!save.isPending) advance();
  }

  // Enter como num formulário de uma página só: num campo que não é o último do passo, vai para o
  // seguinte; no último, envia (avança); numa opção (rádio), confirma o passo.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") === "radio") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
      return;
    }
    if (!(target instanceof HTMLInputElement)) return;
    const fields = [
      ...event.currentTarget.querySelectorAll<HTMLInputElement>("input:not([disabled])"),
    ];
    const following = fields[fields.indexOf(target) + 1];
    if (following) {
      event.preventDefault();
      following.focus();
    }
  }

  const upcoming = reviewing ? null : nextStep(plan, step, returning);
  const primary = reviewing
    ? save.isPending
      ? "Salvando…"
      : "Salvar meta"
    : upcoming === "revisao"
      ? "Revisar"
      : "Continuar";
  // Vindo da revisão, o botão principal já volta para ela; aberta na revisão, ela é o começo.
  const showBack = !returning && index > 0 && !(reviewing && start === "revisao");

  return (
    <form noValidate onSubmit={onSubmit} onKeyDown={onKeyDown} className="w-full max-w-2xl">
      <Card>
        <CardHeader className="gap-3">
          <p className="text-footnote text-muted-foreground">
            Passo {index + 1} de {steps.length} · {STEP_TEXT[step].title}
          </p>
          <StepBar index={index} total={steps.length} />
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="text-title-3 outline-none">
            {STEP_TEXT[step].question}
          </h2>
        </CardHeader>
        <CardContent>
          <div
            key={step}
            ref={stepRef}
            role="group"
            aria-labelledby={headingId}
            className={cn(
              "grid animate-in gap-5 duration-300 ease-smooth fade-in-0 motion-reduce:animate-none",
              direction === "forward" ? "slide-in-from-right-3" : "slide-in-from-left-3",
            )}
          >
            {notice && step === "perfil" && !returning ? (
              <p className="flex gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {notice}
              </p>
            ) : null}
            {step === "perfil" ? <ProfileStep plan={plan} set={set} /> : null}
            {step === "essencial" ? (
              <>
                <MoneyField
                  label="Gasto mensal fixo"
                  value={plan.essentialMonthly}
                  onChange={(essentialMonthly) => set({ essentialMonthly })}
                />
                <Impact value={stepImpact("essencial", plan)}>
                  É o gasto ÷ {RATE}: o patrimônio que rende esse valor todo mês, para sempre, acima
                  da inflação.
                </Impact>
              </>
            ) : null}
            {step === "sazonal" ? (
              <>
                <MoneyField
                  label="Total do ano"
                  value={plan.seasonalYearly}
                  onChange={(seasonalYearly) => set({ seasonalYearly })}
                />
                <Impact value={stepImpact("sazonal", plan)}>
                  Entra como {money(plan.seasonalYearly / 12)} por mês (o ano ÷ 12), e a meta guarda
                  esse valor ÷ {RATE}.
                </Impact>
              </>
            ) : null}
            {step === "familia" ? <FamilyStep plan={plan} set={set} /> : null}
            {step === "educacao" ? <EducationStep plan={plan} set={set} /> : null}
            {step === "saude" ? <HealthStep plan={plan} set={set} /> : null}
            {step === "viagens" ? (
              <>
                <MoneyField
                  label="Total do ano"
                  value={plan.travelYearly}
                  onChange={(travelYearly) => set({ travelYearly })}
                />
                <Impact value={stepImpact("viagens", plan)}>
                  Entra como {money(plan.travelYearly / 12)} por mês (o ano ÷ 12), e a meta guarda
                  esse valor ÷ {RATE}.
                </Impact>
              </>
            ) : null}
            {reviewing ? (
              <WizardReview
                plan={plan}
                koinosWealth={koinosWealth}
                monthlyAporte={monthlyAporte}
                currentMonth={currentMonth}
                onEdit={edit}
              />
            ) : null}
            {reviewing ? reviewFooter : null}
          </div>
        </CardContent>
        <div className="flex flex-col-reverse gap-2 px-(--card-spacing) pt-1 sm:flex-row sm:items-center">
          {showBack || onCancel ? (
            <div className="flex gap-2 max-sm:justify-between">
              {showBack ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => go(previousStep(plan, step), "back")}
                >
                  <ArrowLeftIcon />
                  Voltar
                </Button>
              ) : null}
              {onCancel ? (
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button type="submit" disabled={save.isPending} className="max-sm:w-full sm:ml-auto">
            {primary}
          </Button>
        </div>
      </Card>
    </form>
  );
}

/** A barra de passos, em segmentos como a do iOS. Decorativa: o "Passo N de M" diz o mesmo. */
function StepBar({ index, total }: { index: number; total: number }) {
  return (
    <div aria-hidden="true" className="flex gap-1">
      {Array.from({ length: total }, (_, position) => (
        <span
          key={position}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
            position <= index ? "bg-primary" : "bg-secondary",
          )}
        />
      ))}
    </div>
  );
}

function ProfileStep({ plan, set }: { plan: IndependencePlan; set: SetPlan }) {
  const years = Math.max(0, plan.targetAge - plan.currentAge);
  return (
    <>
      <FieldGroup
        footer={
          years > 0
            ? `Faltam ${plural(years, "ano", "anos")} para a idade alvo.`
            : "A idade alvo é a de hoje."
        }
      >
        <NumberRow
          label="Idade atual"
          suffix="anos"
          value={plan.currentAge}
          min={CURRENT_AGE_RANGE.min}
          max={CURRENT_AGE_RANGE.max}
          onChange={(currentAge) =>
            set({ currentAge, targetAge: Math.max(plan.targetAge, currentAge) })
          }
        />
        <NumberRow
          label="Idade para parar"
          suffix="anos"
          value={plan.targetAge}
          min={plan.currentAge}
          max={TARGET_AGE_MAX}
          onChange={(targetAge) => set({ targetAge })}
        />
      </FieldGroup>
      <MoneyField
        label="Patrimônio fora do Koinos (opcional)"
        hint="Previdência, imóveis de renda, outras corretoras: soma ao patrimônio no progresso e no prazo."
        value={plan.externalWealth}
        max={EXTERNAL_WEALTH_MAX}
        onChange={(externalWealth) => set({ externalWealth })}
      />
    </>
  );
}

function FamilyStep({ plan, set }: { plan: IndependencePlan; set: SetPlan }) {
  return (
    <>
      <FieldGroup>
        <ToggleRow
          label="Cônjuge no orçamento"
          value={plan.spouseAge !== null}
          onChange={(yes) =>
            set({
              spouseAge: yes
                ? clamp(plan.currentAge, SPOUSE_AGE_RANGE.min, SPOUSE_AGE_RANGE.max)
                : null,
            })
          }
        />
        {plan.spouseAge !== null ? (
          <NumberRow
            label="Idade do cônjuge"
            suffix="anos"
            value={plan.spouseAge}
            min={SPOUSE_AGE_RANGE.min}
            max={SPOUSE_AGE_RANGE.max}
            onChange={(spouseAge) => set({ spouseAge })}
          />
        ) : null}
      </FieldGroup>
      <FieldGroup footer="O cônjuge entra no plano de saúde; os dependentes, na escola e na saúde até saírem do orçamento.">
        <ToggleRow
          label="Dependentes financeiros"
          value={plan.dependents > 0}
          onChange={(yes) =>
            set(yes ? { dependents: 1, youngestAge: 5 } : { dependents: 0, youngestAge: null })
          }
        />
        {plan.dependents > 0 ? (
          <>
            <NumberRow
              label="Quantos"
              value={plan.dependents}
              min={1}
              max={DEPENDENTS_MAX}
              onChange={(dependents) => set({ dependents })}
            />
            <NumberRow
              label="Idade do mais novo"
              suffix="anos"
              value={plan.youngestAge ?? 0}
              min={0}
              max={YOUNGEST_AGE_MAX}
              onChange={(youngestAge) => set({ youngestAge })}
            />
          </>
        ) : null}
      </FieldGroup>
    </>
  );
}

function EducationStep({ plan, set }: { plan: IndependencePlan; set: SetPlan }) {
  const impact = stepImpact("educacao", plan);
  const youngestAtTarget = (plan.youngestAge ?? 0) + Math.max(0, plan.targetAge - plan.currentAge);
  return (
    <>
      <MoneyField
        label="Por mês, somando todos os dependentes"
        value={plan.educationMonthly}
        onChange={(educationMonthly) => set({ educationMonthly })}
      />
      <div className="grid gap-2">
        {/* O grupo de rádios já tem este nome para o leitor de tela. */}
        <span aria-hidden="true" className="text-sm font-medium">
          Até que idade o mais novo é custeado?
        </span>
        <ChoiceList
          label="Até que idade o mais novo é custeado"
          value={String(plan.educationUntil)}
          options={[
            { key: "18", label: "18 anos", detail: "Fim do ensino médio" },
            { key: "24", label: "24 anos", detail: "Fim da faculdade" },
          ]}
          onChange={(key) => set({ educationUntil: Number(key) as EducationUntil })}
        />
      </div>
      <Impact value={impact}>
        {youngestAtTarget >= plan.educationUntil
          ? `Aos ${plan.targetAge}, o mais novo já terá ${youngestAtTarget} anos: a escola acaba antes e não entra na meta.`
          : `Paga a escola dos ${plan.targetAge} até o mais novo fazer ${plan.educationUntil}: 13 mensalidades por ano, corrigidas 8% ao ano.`}
      </Impact>
    </>
  );
}

function HealthStep({ plan, set }: { plan: IndependencePlan; set: SetPlan }) {
  const who = [
    "você",
    ...(plan.spouseAge !== null ? ["o cônjuge"] : []),
    ...(plan.dependents > 0
      ? [plan.dependents === 1 ? "o dependente" : `os ${plan.dependents} dependentes`]
      : []),
  ];
  const whoText = who.length === 1 ? who[0] : `${who.slice(0, -1).join(", ")} e ${who.at(-1)}`;
  return (
    <>
      <ChoiceList
        label="Plano de saúde"
        value={plan.healthLevel}
        options={HEALTH_LEVELS.map((level) => ({
          key: level,
          label: HEALTH_LEVEL_LABELS[level].label,
          detail: HEALTH_LEVEL_LABELS[level].detail,
          trailing:
            level === "nenhum" ? undefined : (
              <span className="grid">
                <span className="font-medium">{formatBRL(healthCost(level, plan.targetAge))}</span>
                <span className="text-caption text-muted-foreground">por mês</span>
              </span>
            ),
        }))}
        onChange={(healthLevel) => set({ healthLevel: healthLevel as HealthLevel })}
      />
      <Impact value={stepImpact("saude", plan)}>
        {plan.healthLevel === "nenhum"
          ? "Sem plano particular, a saúde fica de fora da meta."
          : `Por pessoa, na faixa dos ${plan.targetAge} anos e subindo nas seguintes (tabela de 2026, plano individual, São Paulo). Entram ${whoText}.`}
      </Impact>
    </>
  );
}

/** Revisão: a meta com as respostas de agora e a lista delas, cada uma levando ao seu passo. */
function WizardReview({
  plan,
  koinosWealth,
  monthlyAporte,
  currentMonth,
  onEdit,
}: {
  plan: IndependencePlan;
  koinosWealth: number;
  monthlyAporte: number;
  currentMonth: string;
  onEdit: (step: StepKey) => void;
}) {
  const answersId = useId();
  const summary = independenceSummary({ plan, koinosWealth, monthlyAporte, currentMonth });
  const verdict = forecastVerdict(plan, summary);
  const reached = summary.progress >= 1;
  return (
    <>
      <section aria-label="A meta" className="grid gap-3">
        <div className="grid gap-1">
          <p className="text-subheadline text-muted-foreground">Montante necessário</p>
          <p className="text-title-1 tabular-nums">{money(summary.target)}</p>
        </div>
        <ProgressBar value={summary.progress} label="Progresso da meta" />
        <p className="text-footnote text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">
            {formatPercent(summary.progress, 1)}
          </span>{" "}
          · {money(summary.patrimony)} de patrimônio ·{" "}
          {reached ? "acima da meta" : <>faltam {money(summary.target - summary.patrimony)}</>}
        </p>
        <VerdictChip tone={verdict.tone}>{verdict.text}</VerdictChip>
        {summary.requiredAporte !== null ? (
          <p className="text-footnote text-muted-foreground">
            Para parar aos {plan.targetAge}:{" "}
            <span className="font-semibold text-foreground">{money(summary.requiredAporte)}</span>{" "}
            por mês (hoje, {money(summary.monthlyAporte)}).
          </p>
        ) : null}
        <p className="text-footnote text-muted-foreground">
          A meta rende {money(summary.monthlyYield)} por mês: {money(summary.realIncome)} para viver
          e {money(summary.inflationReinvestment)} reinvestidos contra a inflação.
        </p>
      </section>
      <section aria-labelledby={answersId} className="grid gap-1.5">
        <h3 id={answersId} className="px-1 text-footnote font-medium text-muted-foreground">
          Suas respostas
        </h3>
        <ul className="grid divide-y divide-border overflow-hidden rounded-xl border border-border">
          {planAnswers(plan).map((answer) => (
            <li key={answer.key}>
              <button
                type="button"
                onClick={() => onEdit(answer.step)}
                className="flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-footnote text-muted-foreground">
                    <span className="sr-only">Editar </span>
                    {answer.label}
                  </span>
                  <span className="text-sm">
                    {answer.amount !== undefined ? (
                      <>
                        {money(answer.amount)}
                        {answer.text ? ` ${answer.text}` : null}
                      </>
                    ) : (
                      answer.text
                    )}
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** O peso da resposta na meta, refeito a cada tecla. */
function Impact({ value, children }: { value: number | null; children?: ReactNode }) {
  if (value === null) return null;
  return (
    <div className="grid gap-1 rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="flex items-center gap-2 text-sm">
          <FlagIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Soma à meta
        </p>
        <p className="text-headline tabular-nums">{money(value)}</p>
      </div>
      {children ? <p className="text-footnote text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** Valor em R$ em destaque: o campo grande, como o do Apple Pay. */
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
  const hintId = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput
        id={id}
        size="lg"
        enterKeyHint="next"
        aria-describedby={hint ? hintId : undefined}
        defaultValue={value}
        className="sm:max-w-sm"
        onValueChange={(next) => onChange(clamp(next ?? 0, 0, max))}
      />
      {hint ? (
        <p id={hintId} className="text-footnote text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Grupo de linhas, como os dos Ajustes do iOS, com uma nota opcional embaixo. */
function FieldGroup({ footer, children }: { footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="grid divide-y divide-border rounded-xl border border-border">{children}</div>
      {footer ? <p className="px-1 text-footnote text-muted-foreground">{footer}</p> : null}
    </div>
  );
}

const ROW = "flex min-h-12 items-center gap-4 px-4 py-2 pointer-coarse:min-h-14";

/** Linha de sim/não, com o controle segmentado à direita. */
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (yes: boolean) => void;
}) {
  return (
    <div className={ROW}>
      <span className="flex-1 text-sm">{label}</span>
      <SegmentedControl
        size="sm"
        label={label}
        value={value ? "sim" : "nao"}
        options={YES_NO}
        onChange={(next) => onChange(next === "sim")}
      />
    </div>
  );
}

/** Linha de número inteiro (idades, quantidade). Valores fora da faixa ficam no limite. */
function NumberRow({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix?: string;
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
    <div className={ROW}>
      <label htmlFor={id} className="flex-1 text-sm">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          enterKeyHint="next"
          min={min}
          max={max}
          step={1}
          value={text}
          className="w-20 text-right tabular-nums max-md:text-base pointer-coarse:h-11"
          onChange={(event) => {
            setText(event.target.value);
            const parsed = Math.trunc(Number(event.target.value));
            if (event.target.value !== "" && Number.isFinite(parsed)) {
              onChange(clamp(parsed, min, max));
            }
          }}
          onBlur={() => setText(String(value))}
        />
        <span aria-hidden={suffix ? undefined : true} className="w-9 text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}
