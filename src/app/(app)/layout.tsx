import { Suspense, type ReactNode } from "react";
import { UserMenu, UserMenuSkeleton } from "@/features/auth/ui";
import { getCurrentUser } from "@/features/auth/server";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { QueryProvider } from "@/shared/components/query-provider";
import { ThemeToggle } from "@/shared/components/theme-toggle";
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
        {/* min-w-0: tabelas largas rolam dentro do card, sem empurrar a página. */}
        <SidebarInset className="min-w-0 bg-transparent">
          {/* Toolbar flutuante de vidro, como no macOS 27. */}
          <header className="sticky top-2 z-10 mx-2 mt-2 flex h-12 items-center gap-2 rounded-2xl glass px-2 md:mx-4">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
