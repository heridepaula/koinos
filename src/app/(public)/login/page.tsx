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

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CoinsIcon className="size-6" />
          </div>
          <CardTitle className="text-2xl">Koinos</CardTitle>
          <CardDescription>Sua carteira de FIIs, com aportes pelo método Suno.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={null}>
            <SignedInRedirect />
          </Suspense>
          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>
          <SignInButton />
          <p className="text-center text-xs text-muted-foreground">
            Acesso restrito a e-mails autorizados.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
