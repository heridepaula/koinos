import type { NewsTone } from "../domain/week-summary";
import type { AssetClass } from "../domain/asset-class";
import { Disclosure } from "@/shared/components/disclosure";
import { GlossaryText } from "@/shared/components/glossary-text";
import { NewsToneChip } from "./tone-chip";

export type CouncilLens = {
  id: string;
  label: string;
  persona: string;
  tone: NewsTone;
  text: string;
};

/**
 * "Pelas lentes do conselho": cada lente da skill `conselho-investidores` com o sentido (decidido
 * pelo código) e a observação. Recolhido: o veredito vem antes. Usado pela leitura da semana e pela
 * tese do ativo.
 */
export function CouncilLenses({
  lenses,
  assetClass,
}: {
  lenses: readonly CouncilLens[];
  assetClass: AssetClass | null;
}) {
  if (lenses.length === 0) return null;
  return (
    <Disclosure
      summary={`Pelas lentes do conselho (${lenses.length})`}
      summaryClassName="text-subheadline"
    >
      <ul className="grid gap-4">
        {lenses.map((lens) => (
          <li key={lens.id} className="grid gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-subheadline font-semibold">{lens.label}</span>
              <span className="text-footnote text-muted-foreground">lente de {lens.persona}</span>
              <NewsToneChip tone={lens.tone} />
            </span>
            <p className="text-subheadline text-pretty">
              <GlossaryText text={lens.text} assetClass={assetClass} />
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-footnote text-pretty text-muted-foreground">
        Lentes inspiradas no que cada investidor defende publicamente; não são falas deles.
      </p>
    </Disclosure>
  );
}
