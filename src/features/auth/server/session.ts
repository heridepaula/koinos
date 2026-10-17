import "server-only";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isEmailAllowed } from "../domain/allowlist";
import { allowedEmails, auth } from "./auth";
import { ensureDefaultPortfolioId } from "./portfolio-repo";

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

/** Dono dos dados de uma requisição. Sempre derivado da sessão, nunca do cliente. */
export type Tenant = { userId: string; portfolioId: string };

export class UnauthorizedError extends Error {
  constructor() {
    super("Sessão expirada. Entre novamente.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Usuário logado, para renderização (dentro de <Suspense>).
 * 'use cache: private' guarda o resultado só no navegador do próprio usuário,
 * o que permite pré-carregar as rotas autenticadas sem cache compartilhado no servidor.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  "use cache: private";
  cacheLife("minutes");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!isEmailAllowed(session.user.email, allowedEmails)) redirect("/login?erro=nao-autorizado");

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/** Tenant para renderização. React.cache evita repetir a consulta na mesma requisição. */
export const getTenant = cache(async (): Promise<Tenant> => {
  const user = await getCurrentUser();
  return { userId: user.id, portfolioId: await ensureDefaultPortfolioId(user.id) };
});

/** Tenant para Server Actions e Route Handlers: confere a sessão a cada chamada, sem cache. */
export async function requireTenant(): Promise<Tenant> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isEmailAllowed(session.user.email, allowedEmails)) {
    throw new UnauthorizedError();
  }
  return {
    userId: session.user.id,
    portfolioId: await ensureDefaultPortfolioId(session.user.id),
  };
}
