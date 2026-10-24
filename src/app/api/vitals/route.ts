import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordSpan } from "@/shared/lib/tracing";

/** Rotas do app. Qualquer outro caminho vira "other": o APM não guarda URLs soltas. */
const ROUTES = new Set([
  "/dashboard",
  "/transacoes",
  "/proventos",
  "/proventos/reinvestimento",
  "/encerradas",
  "/encerradas/ir",
  "/atualizacao-b3",
  "/carteira-alvo",
  "/recomendacoes",
]);
const MAX_BODY_BYTES = 8 * 1024;

const samplesSchema = z
  .array(
    z.object({
      name: z.enum(["TTFB", "FCP", "LCP", "CLS", "INP"]),
      value: z.number().nonnegative().max(600_000),
      rating: z.enum(["good", "needs-improvement", "poor"]),
      navigationType: z.string().max(32).optional(),
      path: z.string().max(256),
    }),
  )
  .min(1)
  .max(20);

/**
 * Web Vitals do navegador (`WebVitals`): um span `web-vitals` por medida. Só aceita pedidos do
 * próprio app (Sec-Fetch-Site) e com cookie de sessão; o resto não entra no APM.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" || !getSessionCookie(request)) {
    return new Response(null, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const samples = samplesSchema.safeParse(body);
  if (!samples.success) return new Response(null, { status: 400 });
  for (const sample of samples.data) {
    recordSpan("web-vitals", {
      "koinos.vitals.name": sample.name,
      "koinos.vitals.value": sample.value,
      "koinos.vitals.rating": sample.rating,
      "koinos.vitals.route": ROUTES.has(sample.path) ? sample.path : "other",
      ...(sample.navigationType ? { "koinos.vitals.navigation_type": sample.navigationType } : {}),
    });
  }
  return new Response(null, { status: 204 });
}
