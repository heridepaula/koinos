import {
  BadgePercentIcon,
  CalendarCheckIcon,
  ListOrderedIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "lucide-react";

// Princípios de aporte da Suno: à vista na tela de recomendações da mesa; no iPhone, na folha ⓘ
// da calculadora, para o campo do valor subir.
export const PRINCIPLES = [
  { icon: CalendarCheckIcon, text: "Aporte todo mês" },
  { icon: ShieldCheckIcon, text: "Só abaixo do preço teto" },
  { icon: ListOrderedIcon, text: "Siga o ranking até a % sugerida" },
  { icon: BadgePercentIcon, text: "Compre mais do que está descontado" },
  { icon: ScaleIcon, text: "Rebalanceie com aportes, não com vendas" },
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
    </ul>
  );
}
