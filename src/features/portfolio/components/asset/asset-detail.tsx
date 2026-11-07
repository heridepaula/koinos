import { cn } from "@/shared/lib/utils";
import type { AssetOverview } from "../../domain/types";
import { AporteCard } from "./aporte-card";
import { AssetHero } from "./asset-hero";
import { DividendsCard } from "./dividends-card";
import { OrdersCard } from "./orders-card";
import { PositionCard } from "./position-card";

/*
 * A grade da página do ativo, pela largura do conteúdo (sidebar aberta ou fechada):
 * - até 720 px, uma coluna, na ordem de leitura do iPhone: cotação, posição, aporte, proventos e
 *   ordens;
 * - de 720 a 1.000 px, a posição e o aporte lado a lado embaixo da cotação;
 * - a partir de 1.000 px, como o inspetor do macOS: a coluna principal (cotação, proventos, ordens)
 *   e, à direita, uma coluna de 360 px com a posição e o aporte. A coluna da direita ocupa as três
 *   linhas e não estica as da esquerda: a última linha (1fr) absorve a sobra.
 */
export function AssetDetail({ overview }: { overview: AssetOverview }) {
  const holding = Boolean(overview.position || overview.closed);
  const side = holding || Boolean(overview.strategy);
  // Lado a lado só com os dois cards; um só ocupa a largura (meia linha vazia seria um buraco).
  const pair = holding && Boolean(overview.strategy);
  return (
    <div className="@container">
      <div
        className={cn(
          "grid gap-4 md:gap-6",
          side &&
            "@min-[1000px]:grid-cols-[minmax(0,1fr)_22.5rem] @min-[1000px]:grid-rows-[auto_auto_1fr]",
        )}
      >
        <AssetHero
          overview={overview}
          className="@min-[1000px]:col-start-1 @min-[1000px]:row-start-1 @min-[1000px]:self-start"
        />
        {side ? (
          <div
            className={cn(
              "grid gap-4 self-start md:gap-6 @min-[1000px]:col-start-2 @min-[1000px]:row-span-3 @min-[1000px]:row-start-1",
              // Como o inspetor do macOS, acompanha a rolagem; só em telas altas o bastante para
              // ele caber inteiro (senão a parte de baixo ficaria fora de alcance).
              "[@media(min-height:880px)]:@min-[1000px]:sticky [@media(min-height:880px)]:@min-[1000px]:top-20",
              pair && "@min-[720px]:grid-cols-2 @min-[1000px]:grid-cols-1",
            )}
          >
            <PositionCard overview={overview} />
            <AporteCard overview={overview} />
          </div>
        ) : null}
        <DividendsCard
          overview={overview}
          className="@min-[1000px]:col-start-1 @min-[1000px]:self-start"
        />
        <OrdersCard
          overview={overview}
          className="@min-[1000px]:col-start-1 @min-[1000px]:self-start"
        />
      </div>
    </div>
  );
}
