import type { Metadata } from "next";
import { Suspense } from "react";
import { defaultPlan } from "@/features/independence";
import { getIndependenceView } from "@/features/independence/server";
import {
  EditPlanButton,
  ForecastCard,
  IndependenceEditingProvider,
  IndependencePanel,
  IndependenceWizard,
  TargetBreakdown,
  TargetCard,
} from "@/features/independence/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Independência financeira" };

export default function IndependencePage() {
  return (
    <IndependenceEditingProvider>
      {/* No iPhone, o "Editar meta" vai para o botão ao lado da tab bar. */}
      <PageHeader
        title="Independência financeira"
        description="Quanto patrimônio a sua vida pede e quando você chega lá no ritmo atual."
        actions={<EditPlanButton />}
        mobileActions={false}
      />
      <div className="mt-6">
        <Suspense fallback={<CardSkeleton height="h-96" />}>
          <IndependenceContent />
        </Suspense>
      </div>
    </IndependenceEditingProvider>
  );
}

async function IndependenceContent() {
  const view = await getIndependenceView();
  const data = {
    koinosWealth: view.koinosWealth,
    monthlyAporte: view.monthlyAporte,
    portfolioYield: view.portfolioYield,
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
      <div className="grid gap-4 md:gap-6">
        <TargetCard summary={view.summary} />
        <ForecastCard plan={view.plan} summary={view.summary} />
        <TargetBreakdown plan={view.plan} summary={view.summary} />
      </div>
    </IndependencePanel>
  );
}
