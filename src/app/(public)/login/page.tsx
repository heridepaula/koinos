import { CoinsIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirectIfSignedIn } from "@/features/auth/server";
import { SignInButton } from "@/features/auth/ui";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const metadata: Metadata = { title: "Entrar" };

const ERROR_MESSAGES: Record<string, string> = {
  "nao-autorizado": "Este e-mail não está autorizado a usar o Koinos.",
  "falha-login": "Não foi possível entrar. Verifique se este e-mail está autorizado.",
};

// searchParams é dado da requisição: fica dentro de <Suspense> para não bloquear a página.
async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const code = typeof params.erro === "string" ? params.erro : null;
  const message = code ? ERROR_MESSAGES[code] : undefined;
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// Quem já tem sessão válida vai para a home. Lê os cookies: fica dentro de <Suspense>.
async function SignedInRedirect() {
  await redirectIfSignedIn();
  return null;
}

/**
 * Entrada no estilo da tela de boas-vindas dos apps da Apple: o ícone do app (o mesmo azulejo com
 * aro de titânio da sidebar), o nome em Large Title, a frase em Subheadline e um botão só. No
 * iPhone não há card: o ícone e o nome ficam no meio da tela, direto no papel de parede, e o botão
 * desce para a base, ao alcance do polegar, acima do home indicator.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 max-md:items-stretch max-md:px-6 max-md:pt-[max(1rem,var(--safe-top))] max-md:pb-[max(1.5rem,var(--safe-bottom))]">
      <Card className="w-full max-w-sm [--card-spacing:--spacing(8)] max-md:max-w-none max-md:border-0 max-md:bg-none max-md:shadow-none max-md:backdrop-blur-none max-md:[--card-spacing:0px]">
        <CardHeader className="justify-items-center gap-3 text-center max-md:flex-1 max-md:content-center">
          <div className="metal-ring tile mb-2 size-16 rounded-2xl [--tile:var(--tile-app)]">
            <CoinsIcon className="size-8" aria-hidden="true" />
          </div>
          <CardTitle className="text-large-title">Koinos</CardTitle>
          <CardDescription className="text-subheadline text-balance">
            Sua carteira de FIIs, com aportes pelo método Suno.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={null}>
            <SignedInRedirect />
          </Suspense>
          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>
          <SignInButton />
          <p className="text-center text-footnote text-muted-foreground">
            Acesso restrito a e-mails autorizados.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
