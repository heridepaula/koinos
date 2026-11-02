import {
  BadgePercentIcon,
  BoxesIcon,
  CalendarCheckIcon,
  LayersIcon,
  ListOrderedIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { CURRENT_ENGINE } from "../domain/engine-options";

// Princípios de aporte do ranking: à vista na tela de recomendações da mesa; no iPhone, na folha ⓘ
// da calculadora, para o campo do valor subir.
export const PRINCIPLES = [
  { icon: CalendarCheckIcon, text: "Aporte todo mês" },
  { icon: ShieldCheckIcon, text: "Só abaixo do preço teto" },
  { icon: ListOrderedIcon, text: "Siga o ranking até a % sugerida" },
  { icon: BadgePercentIcon, text: "Mais no descontado, menos no que perdeu fundamento" },
  { icon: LayersIcon, text: "Limite por FII, setor e papel ou tijolo" },
  { icon: ScaleIcon, text: "Rebalanceie com aportes, não com vendas" },
  { icon: BoxesIcon, text: "Sem ordens pequenas: mínimo nos FIIs, lote de 100 nas ações" },
] as const;

export function PrinciplesBanner() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl glass px-4 py-3 text-sm max-md:hidden">
      {PRINCIPLES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {text}
        </li>
      ))}
      <li className="text-muted-foreground">Koinos {CURRENT_ENGINE}</li>
    </ul>
  );
}
