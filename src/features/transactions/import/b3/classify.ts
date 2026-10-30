import { assetClassOf, type AssetClass } from "@/features/market-data";
import { RIGHTS_OR_RECEIPT_CODE, TICKER_CODE } from "./codes";
import type { AssetTypeInfo } from "./types";

// Classificação dos ativos dos extratos (spec importacao-b3, §4; spec ações etapa 1, §5.1).

export type Classification =
  | { managed: true; assetClass: AssetClass; outOfCatalog: boolean }
  | { managed: false; reason: string };

/** FIIs, Fiagros, ações e units entram; o resto vai para os ignorados da prévia, por motivo. */
export function classify(
  code: string,
  types: ReadonlyMap<string, AssetTypeInfo | null>,
): Classification {
  const info = types.get(code) ?? null;
  const assetClass = assetClassOf(code, info);
  if (assetClass) return { managed: true, assetClass, outOfCatalog: info === null };
  if (info) {
    const subType = info.subType?.toLowerCase() ?? null;
    if (info.type === "bdr") return { managed: false, reason: "BDRs" };
    if (subType === "etf") return { managed: false, reason: "ETFs" };
    if (subType === "fi-infra") return { managed: false, reason: "FI-Infra" };
    return { managed: false, reason: "Outros fundos (FIP, FIDC...)" };
  }
  if (RIGHTS_OR_RECEIPT_CODE.test(code)) {
    return { managed: false, reason: "Direitos e recibos (o recibo entra como subscrição do FII)" };
  }
  if (TICKER_CODE.test(code)) return { managed: false, reason: "Outros ativos fora do catálogo" };
  return { managed: false, reason: "Renda fixa e Tesouro" };
}
