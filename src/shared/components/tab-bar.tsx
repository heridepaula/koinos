"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MoreSheet } from "./more-sheet";
import { NAV_ITEMS, isWithin } from "./nav-items";
import { useCurrentTabBarAction } from "./tab-bar-action";

const TABS = NAV_ITEMS.filter((item) => item.tab);

/*
 * Aba: ícone de 24 px sobre o rótulo de 10 px, como no iOS. A escolhida fica no azul AA do --info
 * (o systemBlue dá menos de 4,5:1 no vidro) e o ícone afunda no toque.
 */
const TAB =
  "group/tab flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-[0.625rem] leading-3 font-semibold text-foreground outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-info data-current:text-info";
const TAB_ICON =
  "size-6 transition-transform duration-150 ease-out group-active/tab:scale-88 motion-reduce:transition-none";

/**
 * Tab bar do iPhone (abaixo de 768 px), no Liquid Glass do iOS 26: uma cápsula de vidro que
 * flutua sobre o conteúdo, acima do home indicator, com as quatro páginas principais e o "Mais"
 * (as outras páginas, a aparência e a conta numa folha). Uma lente clara marca a aba aberta e
 * desliza com a mola bouncy. Quando a página registra uma ação principal (useTabBarAction), ela
 * aparece num círculo à direita, ao alcance do polegar.
 */
export function TabBar({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const action = useCurrentTabBarAction();
  const tab = TABS.findIndex((item) => isWithin(item.href, pathname));
  // Fora das abas (Carteira Alvo, Encerradas, B3), quem fica marcado é o "Mais".
  const index = tab === -1 ? TABS.length : tab;

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-(--tab-bar-bottom) z-30 flex gap-2 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] md:hidden"
    >
      <div className="pointer-events-auto relative isolate grid h-(--tab-bar-height) flex-1 auto-cols-fr grid-flow-col rounded-full p-1 glass-strong [--glass-strong-tint:var(--tab-bar-tint)]">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 -z-10 rounded-full bg-white/70 shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.14)] transition-transform duration-690 ease-bouncy motion-reduce:transition-none dark:bg-white/14 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]"
          style={{
            width: `calc((100% - 8px) / ${TABS.length + 1})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {TABS.map((item, position) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={position === index ? "page" : undefined}
            className={TAB}
          >
            <item.icon aria-hidden="true" className={TAB_ICON} />
            <span className="max-w-full truncate px-0.5">{item.tab}</span>
          </Link>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          data-current={index === TABS.length || undefined}
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
