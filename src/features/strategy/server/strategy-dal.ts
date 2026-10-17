import "server-only";
import { getTenant } from "@/features/auth/server";
import { listTargetAssets, type TargetAssetRecord } from "./target-asset-repo";

/** Configuração da Carteira Alvo do usuário logado. O dono vem da sessão. */
export async function getMyTargetAssets(): Promise<TargetAssetRecord[]> {
  const { portfolioId } = await getTenant();
  return listTargetAssets(portfolioId);
}
