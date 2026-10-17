import { timingSafeEqual } from "node:crypto";
import { runDailyMarketJob } from "@/features/market-data/server";
import { listTradedTickersWithFirstDate } from "@/features/transactions/server";
import { env } from "@/shared/env";
import { monthKeyOfTradeDate } from "@/shared/lib/time";

export const maxDuration = 300;

/** Compara o cabeçalho com o segredo em tempo constante (sem vazar o tamanho por timing). */
function isAuthorized(header: string | null): boolean {
  if (!env.CRON_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Chamado pela Vercel Cron (vercel.json). Responde só contagens, nunca dados de carteiras. */
export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const traded = await listTradedTickersWithFirstDate();
  const summary = await runDailyMarketJob(
    traded.map(({ ticker, firstDate }) => ({ ticker, fromMonth: monthKeyOfTradeDate(firstDate) })),
  );
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
