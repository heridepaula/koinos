import "server-only";
import { cache } from "react";
import { getTenant, type Tenant } from "@/features/auth/server";
import { findClassTarget } from "./class-target-repo";
import { listTargetAssets, type TargetAssetRecord } from "./target-asset-repo";

/** Configuração da Carteira Alvo de um tenant (que só existe se veio da sessão). */
export async function listTargetAssetsOf(tenant: Tenant): Promise<TargetAssetRecord[]> {
  return listTargetAssets(tenant.portfolioId);
}

/** Configuração do usuário logado, para renderização. */
export const getMyTargetAssets = cache(async (): Promise<TargetAssetRecord[]> =>
  listTargetAssetsOf(await getTenant()),
);

/** Meta entre FIIs e ações do usuário logado, ou null se ainda não definida. */
export const getMyClassTarget = cache(async (): Promise<{ fiiPercent: number } | null> =>
  findClassTarget((await getTenant()).portfolioId),
);
