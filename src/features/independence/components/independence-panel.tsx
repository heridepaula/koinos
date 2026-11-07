"use client";

import { useEffect, type ReactNode } from "react";
import type { IndependencePlan } from "../domain/types";
import { DeletePlanButton } from "./delete-plan-button";
import { useIndependenceEditing } from "./independence-editing";
import { IndependenceWizard } from "./independence-wizard";

/**
 * Com o plano salvo: os cards (vindos do servidor) ou, depois do "Editar meta", o questionário
 * aberto na revisão, de onde cada resposta leva ao passo dela e a meta pode ser excluída.
 */
export function IndependencePanel({
  plan,
  koinosWealth,
  monthlyAporte,
  portfolioYield,
  currentMonth,
  children,
}: {
  plan: IndependencePlan;
  koinosWealth: number;
  monthlyAporte: number;
  portfolioYield: number | null;
  currentMonth: string;
  children: ReactNode;
}) {
  const { editing, setEditing, setAvailable } = useIndependenceEditing();
  // O "Editar meta" do cabeçalho só aparece com o painel na tela. Ao sair (a meta foi excluída),
  // a edição também acaba: sem isso, a próxima meta salva abriria já em edição.
  useEffect(() => {
    setAvailable(true);
    return () => {
      setAvailable(false);
      setEditing(false);
    };
  }, [setAvailable, setEditing]);
  if (!editing) return children;
  return (
    <IndependenceWizard
      initial={plan}
      start="revisao"
      koinosWealth={koinosWealth}
      monthlyAporte={monthlyAporte}
      portfolioYield={portfolioYield}
      currentMonth={currentMonth}
      reviewFooter={<DeletePlanButton />}
      onCancel={() => setEditing(false)}
      onSaved={() => setEditing(false)}
    />
  );
}
