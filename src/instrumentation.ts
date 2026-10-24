import type { Instrumentation } from "next";
import { recordRequestError } from "@/shared/lib/tracing";

// Roda uma vez quando o servidor sobe, antes da primeira requisição. Todo o app usa o runtime
// Node (o proxy do Next 16 também): o import condicional só mantém o SDK fora de um bundle edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation.node");
}

// Erros que o Next capturou no render, nas rotas, nas actions e no proxy: viram um span
// `request.error` no APM. O caminho pedido e os cabeçalhos ficam de fora.
export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  recordRequestError(error, context);
};
