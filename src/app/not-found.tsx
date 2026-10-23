import Link from "next/link";
import { Button } from "@/shared/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Ir para o dashboard
      </Button>
    </main>
  );
}
