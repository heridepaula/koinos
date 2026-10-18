import { CalendarCheckIcon, ListOrderedIcon, ScaleIcon, ShieldCheckIcon } from "lucide-react";

// Princípios de aporte da Suno, sempre à vista na tela de recomendações.
const PRINCIPLES = [
  { icon: CalendarCheckIcon, text: "Aporte todo mês" },
  { icon: ShieldCheckIcon, text: "Só abaixo do preço teto" },
  { icon: ListOrderedIcon, text: "Siga o ranking até a % sugerida" },
  { icon: ScaleIcon, text: "Rebalanceie com aportes, não com vendas" },
] as const;

export function PrinciplesBanner() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl glass px-4 py-3 text-sm">
      {PRINCIPLES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
