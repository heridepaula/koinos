"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const RENEW_EVERY_MS = 5 * 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

/**
 * A sessão expira depois de 1 h sem uso. As páginas leem a sessão no servidor, mas só a rota
 * /api/auth consegue regravar o cookie: com interação real (no máximo a cada 5 min), esta peça
 * pede a sessão ali, o que empurra o prazo. Aba esquecida aberta não conta como uso.
 */
export function SessionKeepAlive() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const onActivity = async () => {
      if (Date.now() - last < RENEW_EVERY_MS) return;
      last = Date.now();
      // O cliente do Better Auth só carrega aqui: fica fora do bundle de todas as páginas.
      const { authClient } = await import("../auth-client");
      const { data } = await authClient.getSession();
      if (!data) router.replace("/login");
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [router]);

  return null;
}
