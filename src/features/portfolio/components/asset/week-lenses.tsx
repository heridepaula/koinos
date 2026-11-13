import type { AssetClass, WeekLensView } from "@/features/market-data";
import { Disclosure } from "@/shared/components/disclosure";
import { GlossaryText } from "@/shared/components/glossary-text";
import { NewsToneChip } from "./news-tone";

/**
 * "Pelas lentes do conselho": a leitura da semana pelas lentes da skill `conselho-investidores`
 * (renda, imóveis, risco e fundamento ou ruído nos FIIs; dividendos, negócio, risco e fundamento ou
 * ruído nas ações), cada uma com o sentido e a observação apoiada nas notícias. Recolhido: o
 * veredito vem antes. As lentes só aparecem quando têm fato.
 */
export function WeekLenses({
  lenses,
  assetClass,
}: {
  lenses: readonly WeekLensView[];
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
