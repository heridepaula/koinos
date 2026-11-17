"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { MoreSheet } from "./more-sheet";
import { activeTabIndex, isWithin, tabItemsFor } from "./nav-items";
import { useCurrentTabBarAction } from "./tab-bar-action";

// A barra larga (481 a 767 px) tem uma aba a mais, o Ativos; abaixo de 481 px ela fica escondida.
const TABS = tabItemsFor("wide");
const NARROW_TABS = tabItemsFor("narrow").length;

/*
 * Aba: ícone de 24 px sobre o rótulo de 10 px, como no iOS. A escolhida fica no azul AA da
 * --tab-active (o systemBlue dá menos de 4,5:1 no vidro) e o ícone afunda no toque.
 */
const TAB =
  "group/tab flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-[0.625rem] leading-3 font-semibold text-foreground outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-(--tab-active) data-current-narrow:max-[481px]:text-(--tab-active) data-current-wide:min-[481px]:text-(--tab-active)";
const TAB_ICON =
  "size-6 transition-transform duration-150 ease-out group-active/tab:scale-88 motion-reduce:transition-none";

/**
 * Tab bar do iPhone (abaixo de 768 px), no Liquid Glass do iOS 26: uma cápsula de vidro que
 * flutua sobre o conteúdo, acima do home indicator, com as quatro páginas principais e o "Mais"
 * (as outras páginas, a aparência e a conta numa folha). Uma lente clara marca a aba aberta e
 * desliza com a mola bouncy. Quando a página registra uma ação principal (useTabBarAction), ela
 * aparece num círculo à direita, ao alcance do polegar. A barra (com o círculo) não passa de 32 rem
 * e fica centralizada: entre 481 e 767 px ela não estica pela tela toda.
 */
export function TabBar({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const action = useCurrentTabBarAction();
  // Fora das abas (Carteira Alvo, Encerradas, B3), quem fica marcado é o "Mais". O Ativos é aba só
  // na barra larga, e na estreita (onde está no "Mais") o índice conta sem ele: o CSS escolhe.
  const narrow = activeTabIndex("narrow", pathname);
  const wide = activeTabIndex("wide", pathname);

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-(--tab-bar-bottom) z-30 mx-auto flex max-w-lg gap-2 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] md:hidden"
    >
      <div
        className="pointer-events-auto relative isolate grid h-(--tab-bar-height) flex-1 auto-cols-fr grid-flow-col rounded-full p-1 glass-strong [--glass-strong-tint:var(--tab-bar-tint)] [--index:var(--index-narrow)] [--tabs:4] min-[481px]:[--index:var(--index-wide)] min-[481px]:[--tabs:5]"
        style={{ "--index-narrow": narrow, "--index-wide": wide } as CSSProperties}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 -z-10 w-[calc((100%-8px)/var(--tabs))] translate-x-[calc(var(--index)*100%)] rounded-full bg-white/70 shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.14)] transition-transform duration-690 ease-bouncy motion-reduce:transition-none dark:bg-white/14 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]"
        />
        {TABS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isWithin(item.href, pathname) ? "page" : undefined}
            // `max-[481px]` é "largura < 481" no Tailwind 4, o par exato de `min-[481px]` ("≥ 481"). Com
            // `max-[480px]` ("< 480") a faixa de 480 a 481 px ficava sem regra nenhuma.
            className={cn(TAB, !item.tab && "max-[481px]:hidden")}
          >
            <item.icon aria-hidden="true" className={TAB_ICON} />
            <span className="max-w-full truncate px-0.5">{item.tabLabel}</span>
          </Link>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          data-current-narrow={narrow === NARROW_TABS || undefined}
          data-current-wide={wide === TABS.length || undefined}
          onClick={() => setMoreOpen(true)}
          className={TAB}
        >
          <EllipsisIcon aria-hidden="true" className={TAB_ICON} />
          <span>Mais</span>
        </button>
      </div>
      {action ? (
        <button
          type="button"
          aria-label={action.label}
          onClick={action.onPress}
          className="metal-ring btn-gloss pointer-events-auto grid size-(--tab-bar-height) shrink-0 press-spring place-items-center rounded-full select-none [-webkit-touch-callout:none] [&_svg]:size-6"
        >
          <action.icon aria-hidden="true" />
        </button>
      ) : null}
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} account={account} />
    </nav>
  );
}
