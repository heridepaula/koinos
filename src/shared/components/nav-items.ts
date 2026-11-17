import {
  ArchiveIcon,
  ArrowLeftRightIcon,
  ChartLineIcon,
  FileTextIcon,
  FlagIcon,
  HandCoinsIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RepeatIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";

export type NavChild = { href: string; label: string; icon: LucideIcon };

export type NavGroupId = "carteira" | "aporte" | "registros";

export type NavItem = {
  href: string;
  /** O grupo do menu: ver a carteira, decidir o aporte ou manter os registros. */
  group: NavGroupId;
  label: string;
  icon: LucideIcon;
  tile: string;
  /**
   * Aba própria na tab bar do iPhone, com o rótulo curto. São só as três jornadas do dia a dia
   * (ver a carteira, os proventos e aportar) mais o "Mais", com as outras páginas: com cinco abas
   * e o botão da ação principal ao lado, os rótulos não cabiam em 393 px.
   */
  tab?: string;
  /**
   * Aba só na tab bar larga (481 a 767 px, celular deitado ou tablet pequeno), onde cabe uma quinta
   * aba. Abaixo de 481 px a página fica no "Mais"; a partir dela sai de lá.
   */
  tabWide?: string;
  /** Subpáginas que aparecem no menu, abaixo do item (somem com a sidebar recolhida). */
  children?: readonly NavChild[];
};

/** Os grupos do menu, na ordem de uso: ver a carteira, decidir o aporte, manter os registros. */
export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "carteira", label: "Carteira" },
  { id: "aporte", label: "Aporte" },
  { id: "registros", label: "Registros" },
];

/**
 * As páginas do app, na ordem do menu (por grupo, da mais usada para a menos usada): a sidebar, a
 * tab bar e a folha "Mais" saem daqui.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    group: "carteira",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    tile: "[--tile:var(--tile-blue)]",
    tab: "Dashboard",
  },
  {
    href: "/ativos",
    group: "carteira",
    label: "Ativos",
    icon: ChartLineIcon,
    tile: "[--tile:var(--tile-indigo)]",
    tabWide: "Ativos",
  },
  {
    href: "/proventos",
    group: "carteira",
    label: "Proventos",
    icon: HandCoinsIcon,
    tile: "[--tile:var(--tile-teal)]",
    tab: "Proventos",
    children: [{ href: "/proventos/reinvestimento", label: "Reinvestimento", icon: RepeatIcon }],
  },
  {
    href: "/independencia",
    group: "carteira",
    label: "Independência",
    icon: FlagIcon,
    tile: "[--tile:var(--tile-green)]",
  },
  {
    href: "/recomendacoes",
    group: "aporte",
    label: "Recomendações",
    icon: LightbulbIcon,
    tile: "[--tile:var(--tile-purple)]",
    tab: "Aporte",
  },
  {
    href: "/carteira-alvo",
    group: "aporte",
    label: "Carteira Alvo",
    icon: TargetIcon,
    tile: "[--tile:var(--tile-orange)]",
  },
  {
    href: "/transacoes",
    group: "registros",
    label: "Transações",
    icon: ArrowLeftRightIcon,
    tile: "[--tile:var(--tile-green)]",
  },
  {
    href: "/encerradas",
    group: "registros",
    label: "Posições encerradas",
    icon: ArchiveIcon,
    tile: "[--tile:var(--tile-pink)]",
    children: [{ href: "/encerradas/ir", label: "IR estimado", icon: ReceiptTextIcon }],
  },
  {
    href: "/atualizacao-b3",
    group: "registros",
    label: "Atualização B3",
    icon: RefreshCwIcon,
    tile: "[--tile:var(--tile-indigo)]",
  },
  {
    href: "/imposto-de-renda",
    group: "registros",
    label: "Imposto de Renda",
    icon: FileTextIcon,
    tile: "[--tile:var(--tile-orange)]",
  },
];

/** Os itens agrupados na ordem de `NAV_GROUPS`, sem os grupos que ficaram vazios. */
export function navGroups(items: readonly NavItem[] = NAV_ITEMS) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}

/** Largura da tab bar: estreita (até 480 px, quatro abas) ou larga (481 a 767 px, cinco). */
export type TabWidth = "narrow" | "wide";

export type TabItem = NavItem & { tabLabel: string };

/** As páginas que têm aba na barra naquela largura, na ordem do menu, com o rótulo curto. */
export function tabItemsFor(width: TabWidth): TabItem[] {
  return NAV_ITEMS.flatMap((item) => {
    const tabLabel = item.tab ?? (width === "wide" ? item.tabWide : undefined);
    return tabLabel ? [{ ...item, tabLabel }] : [];
  });
}

/** As páginas que ficam na folha "Mais" naquela largura. */
export function moreItemsFor(width: TabWidth): NavItem[] {
  const tabs = new Set(tabItemsFor(width).map((item) => item.href));
  return NAV_ITEMS.filter((item) => !tabs.has(item.href));
}

/** A página ou uma subpágina dela está aberta. */
export const isWithin = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** O índice da aba marcada; fora das abas é o "Mais", a última posição. */
export function activeTabIndex(width: TabWidth, pathname: string): number {
  const tabs = tabItemsFor(width);
  const index = tabs.findIndex((item) => isWithin(item.href, pathname));
  return index === -1 ? tabs.length : index;
}

/**
 * A página-mãe de uma subpágina, para o botão voltar da barra do iPhone: a do menu (os `children`)
 * ou, numa página de detalhe fora dele (`/ativos/HGLG11`), a página de cima.
 */
export function parentOf(pathname: string): NavItem | null {
  return (
    NAV_ITEMS.find((item) => item.children?.some((child) => isWithin(child.href, pathname))) ??
    NAV_ITEMS.find((item) => pathname.startsWith(`${item.href}/`)) ??
    null
  );
}
