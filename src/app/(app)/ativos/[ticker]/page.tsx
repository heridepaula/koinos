import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAssetOverview } from "@/features/portfolio/server";
import {
  AssetDetail,
  AssetHeader,
  AssetPageSkeleton,
  AssetSearchAction,
} from "@/features/portfolio/ui";
import { Button } from "@/shared/ui/button";

/** O ticker na aba do navegador ("HGLG11 · Koinos"): com várias abertas, cada uma diz qual é. */
export async function generateMetadata({
  params,
}: PageProps<"/ativos/[ticker]">): Promise<Metadata> {
  return { title: (await params).ticker.toUpperCase() };
}

/**
 * Sem ao menos um parâmetro conhecido, o `usePathname` do menu (no layout) fica sem o caminho no
 * prerender e o build falha. O ticker de exemplo só gera o shell estático: o resto da página
 * depende da sessão e chega por streaming; os demais tickers renderizam sob demanda.
 */
export function generateStaticParams() {
  return [{ ticker: "HGLG11" }];
}

// O título é o ticker, que só se sabe na requisição: cabeçalho e conteúdo chegam juntos, por
// streaming, no lugar de um esqueleto com a mesma geometria.
export default function AssetPage({ params }: PageProps<"/ativos/[ticker]">) {
  return (
    <>
      <AssetSearchAction />
      <Suspense fallback={<AssetPageSkeleton />}>
        <AssetContent params={params} />
      </Suspense>
    </>
  );
}

async function AssetContent({ params }: Pick<PageProps<"/ativos/[ticker]">, "params">) {
  const overview = await getAssetOverview((await params).ticker);
  return (
    <>
      <AssetHeader
        overview={overview}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/ativos" />}>
            <SearchIcon />
            Buscar ativo
          </Button>
        }
      />
      <AssetDetail overview={overview} />
    </>
  );
}
