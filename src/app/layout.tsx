import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import "./globals.css";

// SF Pro vem do sistema no Mac; Inter é o substituto mais próximo nos outros sistemas.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Só o tooltip padrão dos gráficos usa a mono, e depois do ui-monospace: sem pré-carregar em toda página.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: { default: "Koinos", template: "%s · Koinos" },
  description: "Carteira de FIIs com aportes pelo método Suno.",
  // App pessoal: nada de indexação por buscadores.
  robots: { index: false, follow: false },
  // Na tela de início do iPhone abre como app, em tela cheia: a barra de status fica sobre o
  // papel de parede, e as barras do app descontam as áreas seguras.
  appleWebApp: { capable: true, title: "Koinos", statusBarStyle: "black-translucent" },
};

// viewport-fit=cover libera as áreas seguras (env(safe-area-inset-*)) no iPhone.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <TooltipProvider>{children}</TooltipProvider>
          </NuqsAdapter>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
