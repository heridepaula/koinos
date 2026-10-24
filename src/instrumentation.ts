// Roda uma vez quando o servidor sobe, antes da primeira requisição. Todo o app usa o runtime
// Node (o proxy do Next 16 também): o import condicional só mantém o SDK fora de um bundle edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation.node");
}
