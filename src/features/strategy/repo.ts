// Funções com portfolioId explícito, só para scripts locais (ex.: importador). Ver eslint.config.mjs.
import "server-only";

export { listTargetAssets, upsertTargetAsset } from "./server/target-asset-repo";
