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

export type NavItem = {
  href: string;
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

/** As páginas do app, na ordem do menu: a sidebar, a tab bar e a folha "Mais" saem daqui. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    tile: "[--tile:var(--tile-blue)]",
    tab: "Dashboard",
  },
  {
    href: "/ativos",
    label: "Ativos",
    icon: ChartLineIcon,
    tile: "[--tile:var(--tile-indigo)]",
  },
  {
    href: "/transacoes",
    label: "Transações",
    icon: ArrowLeftRightIcon,
    tile: "[--tile:var(--tile-green)]",
  },
  {
    href: "/proventos",
    label: "Proventos",
    icon: HandCoinsIcon,
    tile: "[--tile:var(--tile-teal)]",
    tab: "Proventos",
    children: [{ href: "/proventos/reinvestimento", label: "Reinvestimento", icon: RepeatIcon }],
  },
  {
    href: "/encerradas",
    label: "Posições encerradas",
    icon: ArchiveIcon,
    tile: "[--tile:var(--tile-pink)]",
    children: [{ href: "/encerradas/ir", label: "IR estimado", icon: ReceiptTextIcon }],
  },
  {
    href: "/atualizacao-b3",
    label: "Atualização B3",
    icon: RefreshCwIcon,
    tile: "[--tile:var(--tile-indigo)]",
  },
  {
    href: "/carteira-alvo",
    label: "Carteira Alvo",
    icon: TargetIcon,
    tile: "[--tile:var(--tile-orange)]",
  },
  {
    href: "/recomendacoes",
    label: "Recomendações",
    icon: LightbulbIcon,
    tile: "[--tile:var(--tile-purple)]",
    tab: "Aporte",
  },
  {
    href: "/independencia",
    label: "Independência",
    icon: FlagIcon,
    tile: "[--tile:var(--tile-green)]",
  },
];

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
