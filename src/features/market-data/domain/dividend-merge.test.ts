import { describe, expect, it } from "vitest";
import { exDateAfter, mergeDividendHistory } from "./dividend-merge";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const y = (ex: string, amount: number) => ({ exDate: at(ex), amount });
const f = (com: string, perShare: number, kind: "RENDIMENTO" | "JCP" = "RENDIMENTO") => ({
  comDate: at(com),
  payDate: at(com),
  perShare,
  kind,
});
const from = at("2025-01-01");

describe("mergeDividendHistory: o Yahoo é a base, o Fundamentus completa", () => {
  it("sem o Fundamentus, fica o Yahoo", () => {
    expect(mergeDividendHistory([y("2026-10-01", 0.083)], null, from)).toEqual([
      y("2026-10-01", 0.083),
    ]);
  });

  it("mesmo evento dentro do arredondamento: o valor do Yahoo (GARE11 0,083 contra 0,08)", () => {
    expect(mergeDividendHistory([y("2026-10-01", 0.083)], [f("2026-09-30", 0.08)], from)).toEqual([
      y("2026-10-01", 0.083),
    ]);
  });

  it("mês que o Yahoo perdeu entra com a data ex no dia útil seguinte à data com", () => {
    const merged = mergeDividendHistory(
      [y("2025-11-03", 0.083), y("2026-01-02", 0.083)],
      [f("2025-10-31", 0.08), f("2025-11-28", 0.08), f("2025-12-30", 0.08)],
      from,
    );
    // 28/11/2025 é sexta: a data ex vai para segunda, 01/12.
    expect(merged).toEqual([y("2025-11-03", 0.083), y("2025-12-01", 0.08), y("2026-01-02", 0.083)]);
  });

  it("valor muito diferente: o Yahoo errou, fica o do Fundamentus (XPML11 0,95 contra 0,92)", () => {
    expect(mergeDividendHistory([y("2026-09-21", 0.95)], [f("2026-09-18", 0.92)], from)).toEqual([
      y("2026-09-21", 0.92),
    ]);
  });

  it("evento do Yahoo sem par continua; JCP e o que é anterior a `from` não entram", () => {
    const merged = mergeDividendHistory(
      [y("2026-03-16", 0.15)],
      [f("2026-05-29", 1, "JCP"), f("2024-12-30", 0.1)],
      from,
    );
    expect(merged).toEqual([y("2026-03-16", 0.15)]);
  });

  it("dois rendimentos no mesmo mês casam cada um com um evento", () => {
    const merged = mergeDividendHistory(
      [y("2026-07-01", 0.93), y("2026-07-01", 0.57)],
      [f("2026-06-30", 0.93), f("2026-06-30", 0.57)],
      from,
    );
    expect(merged.map((entry) => entry.amount).sort()).toEqual([0.57, 0.93]);
  });

  it("dia útil seguinte: sexta vai para segunda", () => {
    expect(exDateAfter(at("2026-10-30"))).toEqual(at("2026-11-02"));
    expect(exDateAfter(at("2026-10-29"))).toEqual(at("2026-10-30"));
  });
});
