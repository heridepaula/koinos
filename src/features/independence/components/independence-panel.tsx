"use client";

import { useEffect, type ReactNode } from "react";
import type { IndependencePlan } from "../domain/types";
import { useIndependenceEditing } from "./independence-editing";
import { IndependenceWizard } from "./independence-wizard";

/**
 * Com o plano salvo: os cards (vindos do servidor) ou, depois do "Editar meta", o questionário
 * aberto na revisão, de onde cada resposta leva ao passo dela.
 */
export function IndependencePanel({
  plan,
  koinosWealth,
  monthlyAporte,
  currentMonth,
  children,
}: {
  plan: IndependencePlan;
  koinosWealth: number;
  monthlyAporte: number;
  currentMonth: string;
  children: ReactNode;
}) {
  const { editing, setEditing, setAvailable } = useIndependenceEditing();
  // O "Editar meta" do cabeçalho só aparece com o painel na tela.
  useEffect(() => {
    setAvailable(true);
    return () => setAvailable(false);
  }, [setAvailable]);
  if (!editing) return children;
  return (
    <IndependenceWizard
      initial={plan}
      start="revisao"
      koinosWealth={koinosWealth}
      monthlyAporte={monthlyAporte}
      currentMonth={currentMonth}
      onCancel={() => setEditing(false)}
      onSaved={() => setEditing(false)}
    />
  );
}
