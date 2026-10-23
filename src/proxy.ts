import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Redirecionamento otimista: só confere se existe cookie de sessão.
// A checagem de verdade (sessão válida + allowlist) acontece na DAL, em toda página e action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transacoes/:path*",
    "/proventos/:path*",
    "/atualizacao-b3/:path*",
    "/carteira-alvo/:path*",
    "/recomendacoes/:path*",
  ],
};
