import type { AssetHeat, HeatLevel } from "@/features/market-data";
import { Disclosure } from "@/shared/components/disclosure";
import { cn } from "@/shared/lib/utils";

/** O nível com a cor fria (medo) ou quente (euforia), nos tons de texto com 4,5:1. */
const LEVEL_TEXT: Record<HeatLevel, string> = {
  "medo-extremo": "text-info",
  medo: "text-info",
  neutro: "text-foreground",
  otimismo: "text-warn",
  euforia: "text-warn",
};

/** As cinco faixas da barra, do frio ao quente (gráfico, não texto). */
const ZONES = [
  "bg-chart-1",
  "bg-chart-1/45",
  "bg-muted-foreground/25",
  "bg-chart-4",
  "bg-chart-2",
] as const;

/**
 * O termômetro do ativo (spec 2026-11-13-leitura-da-semana-design.md, parte 3): o nível, a nota de
 * 0 a 100 e a barra de medo extremo a euforia com o marcador; "Como medimos" abre cada componente
 * com a sua explicação. Calculado pelo código com o preço e o sentido das notícias.
 */
export function AssetHeatMeter({ heat, className }: { heat: AssetHeat; className?: string }) {
  return (
    <section aria-label="Termômetro do ativo" className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-footnote text-muted-foreground">Termômetro do momento</p>
        <p className="text-footnote text-muted-foreground tabular-nums">{heat.score} de 100</p>
      </div>
      <p className={cn("text-headline", LEVEL_TEXT[heat.level])}>{heat.label}</p>
      <div
        role="meter"
        aria-label="Termômetro de medo e euforia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={heat.score}
        aria-valuetext={`${heat.label}, ${heat.score} de 100`}
        className="relative mt-1 h-2"
      >
        <div className="flex h-full gap-0.5 overflow-hidden rounded-full">
          {ZONES.map((zone) => (
            <span key={zone} className={cn("h-full flex-1", zone)} />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-sm ring-2 ring-foreground"
          style={{ left: `${heat.score}%` }}
        />
      </div>
      <div aria-hidden="true" className="flex justify-between text-caption text-muted-foreground">
        <span>Medo extremo</span>
        <span>Neutro</span>
        <span>Euforia</span>
      </div>
      <Disclosure
        summary="Como medimos"
        summaryClassName="text-footnote font-normal text-muted-foreground"
      >
        <ul className="grid gap-3">
          {heat.factors.map((factor) => (
            <li key={factor.id} className="grid gap-0.5 text-footnote">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{factor.label}</span>
                <span className="text-muted-foreground tabular-nums">{factor.score}</span>
              </span>
              <span className="text-pretty text-muted-foreground">{factor.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-footnote text-pretty text-muted-foreground">
          Média ponderada de 0 (medo extremo) a 100 (euforia), calculada pelo painel com o preço e o
          tom das notícias. Retrato do momento, não é recomendação.
        </p>
      </Disclosure>
    </section>
  );
}
