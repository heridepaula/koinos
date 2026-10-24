"use client";

import { cn } from "@/shared/lib/utils";
import { CoinsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NAV_ITEMS, isWithin } from "./nav-items";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/shared/ui/sidebar";

// Item ativo: vidro claro com brilho interno (o aro de titânio vem do metal-ring).
const ACTIVE_ITEM =
  "data-active:bg-white/60 data-active:shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.12)] dark:data-active:bg-white/12 dark:data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]";
// Pai de um subitem ativo: com o menu aberto, só o subitem leva o destaque (como no Finder);
// recolhido, os subitens somem, e o destaque volta para o azulejo do pai.
const ANCESTOR_COLLAPSED =
  "group-data-[collapsible=icon]:bg-white/60 group-data-[collapsible=icon]:metal-ring group-data-[collapsible=icon]:shadow-[inset_0_1px_0_#fff,0_1px_3px_rgb(30_40_100/0.12)] dark:group-data-[collapsible=icon]:bg-white/12 dark:group-data-[collapsible=icon]:shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]";

export function AppSidebar({ footer }: { footer: ReactNode }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // No celular o menu é uma gaveta por cima da página: fecha ao escolher um item.
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" onClick={closeMobile} />}>
              <div className="metal-ring tile aspect-square size-8 rounded-md [--tile:var(--tile-app)]">
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
                const childActive =
                  item.children?.some((child) => pathname === child.href) ?? false;
                const active = isWithin(item.href, pathname) && !childActive;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={closeMobile} />}
                      isActive={active}
                      tooltip={item.label}
                      // Recolhida, a sidebar tem botões de 32 px: o azulejo de 24 px pede padding menor.
                      className={cn(
                        ACTIVE_ITEM,
                        "group-data-[collapsible=icon]:p-1!",
                        active && "metal-ring",
                        childActive && ANCESTOR_COLLAPSED,
                      )}
                    >
                      {/* Azulejo colorido, como os Ajustes do iPhone. */}
                      <span className={cn("tile size-6 rounded-sm", item.tile)}>
                        <item.icon />
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.children ? (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton
                              render={<Link href={child.href} onClick={closeMobile} />}
                              isActive={pathname === child.href}
                              className={cn(ACTIVE_ITEM, pathname === child.href && "metal-ring")}
                            >
                              <child.icon />
                              <span>{child.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
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
