import type { AssetClass } from "../domain/asset-class";
import { groupLenses, lensCounts } from "../domain/asset-thesis";
import type { NewsTone } from "../domain/week-summary";
import { Disclosure } from "@/shared/components/disclosure";
import { GlossaryText } from "@/shared/components/glossary-text";
import { cn } from "@/shared/lib/utils";

export type CouncilLens = {
  id: string;
  label: string;
  persona: string;
  tone: NewsTone;
  text: string;
};

function PointList({
  title,
  points,
  tone,
  assetClass,
}: {
  title: string;
  points: readonly CouncilLens[];
  tone: "gain" | "loss";
  assetClass: AssetClass | null;
}) {
  if (points.length === 0) return null;
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-footnote font-semibold">
        <span
          aria-hidden="true"
          className={cn("size-2 rounded-full", tone === "gain" ? "bg-gain" : "bg-loss")}
        />
        {title}
      </p>
      <ul className="grid gap-1.5">
        {points.map((point) => (
          <li key={point.id} className="text-subheadline text-pretty">
            <span className="text-muted-foreground">{point.label} · </span>
            <GlossaryText text={point.text} assetClass={assetClass} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** As lentes da tese como "A favor" e "Atenção" (pelo tom do código), o nome da lente antes do texto. */
export function ThesisPoints({
  lenses,
  assetClass,
}: {
  lenses: readonly CouncilLens[];
  assetClass: AssetClass | null;
}) {
  const { favor, attention } = groupLenses(lenses);
  if (favor.length === 0 && attention.length === 0) return null;
  return (
    <div className="grid gap-3">
      <PointList title="A favor" points={favor} tone="gain" assetClass={assetClass} />
      <PointList title="Atenção" points={attention} tone="loss" assetClass={assetClass} />
    </div>
  );
}

/**
 * Recolhível das lentes no card da semana (spec 2026-11-14-lentes-da-semana-design.md): o resumo é a
 * contagem "1 a favor · 2 de atenção", no estilo de "Como medimos" e "Fontes (N)", e aberto mostra
 * `ThesisPoints`. Sem lente a favor nem de atenção, não aparece.
 */
export function LensPointsDisclosure({
  lenses,
  assetClass,
}: {
  lenses: readonly CouncilLens[];
  assetClass: AssetClass | null;
}) {
  const { favor, attention } = lensCounts(lenses);
  if (favor === 0 && attention === 0) return null;
  return (
    <Disclosure
      summary={
        <span className="flex flex-wrap items-center gap-x-3">
          {favor > 0 ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-gain" />
              {favor} a favor
            </span>
          ) : null}
          {attention > 0 ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-loss" />
              {attention} de atenção
            </span>
          ) : null}
        </span>
      }
      summaryClassName="text-footnote font-normal text-muted-foreground"
    >
      <ThesisPoints lenses={lenses} assetClass={assetClass} />
    </Disclosure>
  );
}
