import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { QueryProvider } from "@/shared/components/query-provider";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { Separator } from "@/shared/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar";

// Lê a sessão: fica dentro de <Suspense> para o resto do layout ir no shell estático.
async function CurrentUserMenu() {
  const user = await getCurrentUser();
  return <UserMenu user={{ name: user.name, email: user.email, image: user.image }} />;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SidebarProvider>
        <AppSidebar
          footer={
            <Suspense fallback={<UserMenuSkeleton />}>
              <CurrentUserMenu />
            </Suspense>
          }
        />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
