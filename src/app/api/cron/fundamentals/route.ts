import { refreshFundamentals } from "@/features/market-data/server";
import { listAllTargetTickers } from "@/features/strategy/server";
import { withSpan } from "@/shared/lib/tracing";
import { isCronAuthorized } from "../authorize";

export const maxDuration = 60;

/**
 * VP e P/VP dos FIIs da Carteira Alvo (usebolsai), todo dia às 2h de Brasília (vercel.json, 5h UTC;
 * no plano Hobby, entre 2h00 e 2h59). Responde só contagens.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  return withSpan("cron.fundamentals", {}, async (span) => {
    const tickers = await listAllTargetTickers();
    const summary = await refreshFundamentals(tickers);
    span.setAttributes({
      "koinos.fundamentals.requested": summary.requested,
      "koinos.fundamentals.updated": summary.updated,
      "koinos.fundamentals.missing": summary.missing,
      "koinos.fundamentals.failed": summary.failed,
    });
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  });
}
