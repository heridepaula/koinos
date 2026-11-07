import type { Metadata } from "next";
import { Suspense } from "react";
import { defaultPlan } from "@/features/independence";
import { getIndependenceView } from "@/features/independence/server";
import {
  ForecastCard,
  IndependencePanel,
  IndependenceWizard,
  ProgressCard,
  TargetBreakdown,
  TargetSplit,
} from "@/features/independence/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Independência financeira" };

export default function IndependencePage() {
  return (
    <>
      <PageHeader
        title="Independência financeira"
        description="Quanto patrimônio a sua vida pede e quando você chega lá no ritmo atual."
      />
      <div className="mt-6">
        <Suspense fallback={<CardSkeleton height="h-96" />}>
          <IndependenceContent />
        </Suspense>
      </div>
    </>
  );
}

async function IndependenceContent() {
  const view = await getIndependenceView();
  const data = {
    koinosWealth: view.koinosWealth,
    monthlyAporte: view.monthlyAporte,
    currentMonth: view.currentMonth,
  };
  if (!view.plan || !view.summary) {
    return (
      <IndependenceWizard
        initial={view.draft ?? defaultPlan()}
        notice={view.draft ? "A meta ganhou novas perguntas: confira e salve." : undefined}
        {...data}
      />
    );
  }
  return (
    <IndependencePanel plan={view.plan} {...data}>
      <div className="@container">
        <div className="grid gap-4 md:gap-6 @min-[900px]:grid-cols-3">
          <ProgressCard summary={view.summary} />
          <ForecastCard plan={view.plan} summary={view.summary} />
          <TargetSplit summary={view.summary} />
        </div>
      </div>
      <TargetBreakdown plan={view.plan} summary={view.summary} />
    </IndependencePanel>
  );
}
