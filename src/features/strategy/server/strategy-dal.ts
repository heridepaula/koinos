import "server-only";
import { cache } from "react";
import { getTenant, type Tenant } from "@/features/auth/server";
import { listTargetAssets, type TargetAssetRecord } from "./target-asset-repo";

/** Configuração da Carteira Alvo de um tenant (que só existe se veio da sessão). */
export async function listTargetAssetsOf(tenant: Tenant): Promise<TargetAssetRecord[]> {
  return listTargetAssets(tenant.portfolioId);
}

/** Configuração do usuário logado, para renderização. */
export const getMyTargetAssets = cache(async (): Promise<TargetAssetRecord[]> =>
  listTargetAssetsOf(await getTenant()),
);
