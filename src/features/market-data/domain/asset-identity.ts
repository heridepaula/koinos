export type CvmCnpjUpdate = {
  ticker: string;
  cnpj: string;
  legalName: string;
  source: "CVM_FCA" | "CVM_ISIN" | "CVM_ISIN_NOME";
};

/**
 * A escrita da CVM no ativo. O filtro exclui `MANUAL`: o CNPJ que o dono digitou nunca é
 * sobrescrito pela sincronização. O operador `$ne` precisa de `mongoose.trusted` na hora de usar.
 */
export function cvmCnpjWrite(update: CvmCnpjUpdate, now: Date) {
  return {
    filter: { _id: update.ticker, cnpjSource: { $ne: "MANUAL" as const } },
    update: {
      $set: {
        cnpj: update.cnpj,
        legalName: update.legalName,
        cnpjSource: update.source,
        cnpjFetchedAt: now,
      },
    },
  };
}
