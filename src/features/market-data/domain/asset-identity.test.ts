import { describe, expect, it } from "vitest";
import { cvmCnpjWrite } from "./asset-identity";

describe("cvmCnpjWrite", () => {
  const now = new Date("2026-11-16T09:00:00Z");
  const write = cvmCnpjWrite(
    { ticker: "EGIE3", cnpj: "02.474.103/0001-19", legalName: "ENGIE", source: "CVM_FCA" },
    now,
  );

  it("nunca casa com um ativo cujo CNPJ foi digitado pelo dono", () => {
    expect(write.filter).toEqual({ _id: "EGIE3", cnpjSource: { $ne: "MANUAL" } });
  });

  it("grava o CNPJ, a razão social, a fonte e a data", () => {
    expect(write.update).toEqual({
      $set: {
        cnpj: "02.474.103/0001-19",
        legalName: "ENGIE",
        cnpjSource: "CVM_FCA",
        cnpjFetchedAt: now,
      },
    });
  });
});
