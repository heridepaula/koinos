import {
  ArchiveIcon,
  ArrowLeftRightIcon,
  ChartLineIcon,
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
];

/** Os itens agrupados na ordem de `NAV_GROUPS`, sem os grupos que ficaram vazios. */
export function navGroups(items: readonly NavItem[] = NAV_ITEMS) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}

/** A página ou uma subpágina dela está aberta. */
export const isWithin = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

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
