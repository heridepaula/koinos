import type { AssetClass } from "../domain/asset-class";
import { groupLenses } from "../domain/asset-thesis";
import { GlossaryText } from "@/shared/components/glossary-text";
import { cn } from "@/shared/lib/utils";
import type { CouncilLens } from "./council-lenses";

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
      <ul className="grid gap-2">
        {points.map((point) => (
          <li key={point.id} className="grid gap-0.5">
            <span className="text-caption text-muted-foreground">{point.label}</span>
            <p className="text-subheadline text-pretty">
              <GlossaryText text={point.text} assetClass={assetClass} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** As lentes da tese como "A favor" e "Atenção" (pelo tom do código), com o nome da lente pequeno. */
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
