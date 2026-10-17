import { NextResponse, type NextRequest } from "next/server";
import { requireTenant } from "@/features/auth/server";
import { searchTickers } from "@/features/market-data/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Autocomplete de tickers. Exige sessão, mesmo o catálogo sendo público, para não virar proxy aberto. */
export async function GET(request: NextRequest) {
  try {
    await requireTenant();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: NO_STORE });
  }
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 20);
  const results = await searchTickers(query);
  return NextResponse.json(
    results.map(({ ticker, name, subType }) => ({ ticker, name, subType })),
    { headers: NO_STORE },
  );
}
