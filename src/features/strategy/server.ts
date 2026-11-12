// API pública de servidor da feature strategy.
import "server-only";

export { getMyTargetAssets, listTargetAssetsOf } from "./server/strategy-dal";
export { listAllTargetRanks, listAllTargetTickers } from "./server/target-asset-repo";
export type { TargetAssetRecord } from "./server/target-asset-repo";
