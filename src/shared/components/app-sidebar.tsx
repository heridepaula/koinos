"use client";

import { cn } from "cn";
import {
  ArrowLeftRightIcon,
  CoinsIcon,
  HandCoinsIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/shared/ui/sidebar";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    tile: "[--tile:var(--tile-blue)]",
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
  },
] as const;

// Item ativo: vidro claro com brilho interno (o aro de titânio vem do metal-ring).
const ACTIVE_ITEM =
  "data-active:bg-white/60 data-active:shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.12)] dark:data-active:bg-white/12 dark:data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]";

export function AppSidebar({ footer }: { footer: ReactNode }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="metal-ring tile aspect-square size-8 rounded-[9px] [--tile:var(--tile-app)]">
                <CoinsIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-semibold">Koinos</span>
                <span className="text-xs text-muted-foreground">Aportes pelo método Suno</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[var(--sidebar-muted)]">Carteira</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      // Recolhida, a sidebar tem botões de 32 px: o azulejo de 24 px pede padding menor.
                      className={cn(
                        ACTIVE_ITEM,
                        "group-data-[collapsible=icon]:p-1!",
                        active && "metal-ring",
                      )}
                    >
                      {/* Azulejo colorido, como os Ajustes do iPhone. */}
                      <span className={cn("tile size-6 rounded-[7px]", item.tile)}>
                        <item.icon />
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
