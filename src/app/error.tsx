"use client";

import { Button } from "@/shared/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar seus dados</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Algo falhou ao buscar as informações. Tente de novo em instantes.
      </p>
      <Button onClick={reset}>Tentar de novo</Button>
    </main>
  );
}
