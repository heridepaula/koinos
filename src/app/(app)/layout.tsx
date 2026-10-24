import { Suspense, type ReactNode } from "react";
import { SessionKeepAlive, UserMenu, UserMenuSkeleton } from "@/features/auth/ui";
import { getCurrentUser } from "@/features/auth/server";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { AutoHideHeader } from "@/shared/components/auto-hide-header";
import { PointerGlow } from "@/shared/components/pointer-glow";
import { QueryProvider } from "@/shared/components/query-provider";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { ToolbarTitle } from "@/shared/components/toolbar-title";
import { WebVitals } from "@/shared/components/web-vitals";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar";

/*
 * Cápsula de vidro da barra: 4 px entre a borda e o botão redondo de dentro (1 de borda + 3 de
 * respiro), então os dois são concêntricos: 44/36 px, ou 52/44 px no toque.
 */
const TOOLBAR_CAPSULE =
  "pointer-events-auto flex h-11 items-center rounded-full p-[3px] glass-strong pointer-coarse:h-13";

// Lê a sessão: fica dentro de <Suspense> para o resto do layout ir no shell estático.
async function CurrentUserMenu() {
  const user = await getCurrentUser();
  return <UserMenu user={{ name: user.name, email: user.email, image: user.image }} />;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <PointerGlow />
      <SessionKeepAlive />
      <WebVitals />
      <SidebarProvider>
        <AppSidebar
          footer={
            <Suspense fallback={<UserMenuSkeleton />}>
              <CurrentUserMenu />
            </Suspense>
          }
        />
        {/* min-w-0: tabelas largas rolam dentro do card, sem empurrar a página. */}
        <SidebarInset className="min-w-0 bg-transparent">
          {/*
           * Barra do topo no Liquid Glass: sem faixa de ponta a ponta, só cápsulas de vidro
           * flutuando sobre o conteúdo. A da esquerda abre o menu e ganha o título compacto quando
           * o título grande sai da tela; a da direita guarda as ações. Some ao rolar para baixo.
           */}
          <AutoHideHeader className="pointer-events-none sticky top-2 z-20 mx-2 mt-2 flex items-center justify-between gap-2 md:mx-4">
            <div className={TOOLBAR_CAPSULE}>
              <SidebarTrigger />
              <ToolbarTitle />
            </div>
            <div className={TOOLBAR_CAPSULE}>
              <ThemeToggle />
            </div>
          </AutoHideHeader>
          <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
