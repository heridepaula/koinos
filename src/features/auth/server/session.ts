import "server-only";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isEmailAllowed } from "../domain/allowlist";
import { allowedEmails, auth } from "./auth";
import { ensureDefaultPortfolioId } from "./portfolio-repo";

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

declare const TENANT_BRAND: unique symbol;

/**
 * Dono dos dados de uma requisição. É um tipo "marcado": só as funções de sessão deste arquivo
 * conseguem criá-lo, então nenhum código consulta dados com um portfolioId arbitrário.
 */
export type Tenant = {
  readonly userId: string;
  readonly portfolioId: string;
  readonly [TENANT_BRAND]: true;
};

function toTenant(userId: string, portfolioId: string): Tenant {
  return { userId, portfolioId } as Tenant;
}

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
  // Daqui em diante os dados vêm do banco, sem cache: só em tempo de requisição. Sem isso,
  // o prefetch das rotas para no new Date() interno do driver do MongoDB.
  await connection();
  return toTenant(user.id, await ensureDefaultPortfolioId(user.id));
});

/** Tenant para Server Actions e Route Handlers: confere a sessão a cada chamada, sem cache. */
export async function requireTenant(): Promise<Tenant> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isEmailAllowed(session.user.email, allowedEmails)) {
    throw new UnauthorizedError();
  }
  return toTenant(session.user.id, await ensureDefaultPortfolioId(session.user.id));
}
