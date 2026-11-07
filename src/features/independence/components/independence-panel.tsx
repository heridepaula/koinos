"use client";

import { RotateCcwIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import type { IndependencePlan } from "../domain/types";
import { IndependenceWizard } from "./independence-wizard";

/**
 * Com o plano salvo: os cards (vindos do servidor) e o "Refazer questionário", que troca os cards
 * pelo questionário já preenchido.
 */
export function IndependencePanel({
  plan,
  patrimony,
  monthlyDividends,
  monthlyAporte,
  currentMonth,
  children,
}: {
  plan: IndependencePlan;
  patrimony: number;
  monthlyDividends: number;
  monthlyAporte: number;
  currentMonth: string;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <IndependenceWizard
        initial={plan}
        patrimony={patrimony}
        monthlyDividends={monthlyDividends}
        monthlyAporte={monthlyAporte}
        currentMonth={currentMonth}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="grid gap-4 md:gap-6">
      {children}
      <div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <RotateCcwIcon />
          Refazer questionário
        </Button>
      </div>
    </div>
  );
}
