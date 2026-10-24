import { NextResponse, type NextRequest } from "next/server";
import { requireTenant } from "@/features/auth/server";
import { searchTickers } from "@/features/market-data/server";
import { withSpan } from "@/shared/lib/tracing";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Autocomplete de tickers. Exige sessão, mesmo o catálogo sendo público, para não virar proxy aberto. */
export async function GET(request: NextRequest) {
  try {
    await requireTenant();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: NO_STORE });
  }
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 20);
  // Só o tamanho da busca vai para o APM, não o texto digitado.
  const results = await withSpan(
    "tickers.search",
    { "koinos.tickers.query_length": query.length },
    async (span) => {
      const found = await searchTickers(query);
      span.setAttribute("koinos.tickers.results", found.length);
      return found;
    },
  );
  return NextResponse.json(
    results.map(({ ticker, name, subType }) => ({ ticker, name, subType })),
    { headers: NO_STORE },
  );
}
