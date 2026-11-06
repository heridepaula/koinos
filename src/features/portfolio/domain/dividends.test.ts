import { describe, expect, it } from "vitest";
import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import {
  groupByYear,
  monthSummary,
  parseKindParam,
  payLagDays,
  upcomingDividends,
} from "./dividends";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paid = (
  ticker: string,
  kind: DividendEntry["kind"],
  amount: number,
  iso: string,
): DividendEntry => ({ ticker, paidAt: at(iso), kind, amount, quantity: null, perShare: null });
const buy: LedgerEntry = {
  id: "b1",
  ticker: "AAAA11",
  type: "BUY",
  quantity: 100,
  unitPrice: 10,
  fees: 0,
  date: at("2026-01-05"),
  createdAt: at("2026-01-05"),
};
const now = new Date("2026-10-20T15:00:00Z");

describe("parseKindParam", () => {
  it("lê o tipo em minúsculas", () => {
    expect(parseKindParam("jcp")).toBe("JCP");
    expect(parseKindParam("aluguel")).toBe("ALUGUEL");
  });
  it("desconhecido ou ausente é todos os tipos", () => {
    expect(parseKindParam("x")).toBeNull();
    expect(parseKindParam(undefined)).toBeNull();
    expect(parseKindParam(["dividendo"])).toBe("DIVIDENDO");
  });
});

describe("upcomingDividends: tipo", () => {
  it("B3 traz o tipo do extrato e o Yahoo conta como Rendimento", () => {
    const upcoming = upcomingDividends({
      now,
      transactions: [buy],
      received: [],
      announcements: new Map([["AAAA11", [{ exDate: at("2026-10-15"), perShare: 0.1 }]]]),
      forecast: {
        asOf: at("2026-10-01"),
        items: [
          {
            ticker: "PETR4",
            kind: "JCP",
            payDate: at("2026-10-25"),
            quantity: 100,
            perShare: 0.5,
            amount: 42.5,
          },
        ],
      },
    });
    expect(upcoming.find((item) => item.ticker === "PETR4")?.kind).toBe("JCP");
    expect(upcoming.find((item) => item.ticker === "AAAA11")?.kind).toBe("RENDIMENTO");
  });
});

describe("byKind", () => {
  it("o mês soma recebidos e a receber por tipo, na ordem dos tipos", () => {
    const summary = monthSummary(
      now,
      [paid("AAAA11", "RENDIMENTO", 10, "2026-10-14"), paid("PETR4", "JCP", 5, "2026-10-02")],
      [
        {
          ticker: "PETR4",
          kind: "DIVIDENDO",
          exDate: null,
          quantity: 1,
          perShare: 3,
          amount: 3,
          payBy: at("2026-10-28"),
          source: "B3",
        },
      ],
    );
    expect(summary.byKind).toEqual([
      { kind: "RENDIMENTO", amount: 10 },
      { kind: "DIVIDENDO", amount: 3 },
      { kind: "JCP", amount: 5 },
    ]);
  });

  it("o ano traz a soma por tipo", () => {
    const [year] = groupByYear([
      paid("AAAA11", "RENDIMENTO", 10, "2026-03-14"),
      paid("PETR4", "ALUGUEL", 2, "2026-04-02"),
      paid("AAAA11", "RENDIMENTO", 10, "2026-04-14"),
    ]);
    expect(year!.byKind).toEqual([
      { kind: "RENDIMENTO", amount: 20 },
      { kind: "ALUGUEL", amount: 2 },
    ]);
  });
});

describe("payLagDays: o intervalo habitual de cada FII", () => {
  const ann = (...days: string[]) => new Map([["AAAA11", days.map((d) => ({ exDate: at(d) }))]]);
  const credit = (iso: string) => paid("AAAA11", "RENDIMENTO", 10, iso);

  it("é a mediana dos dias entre a data ex e o crédito", () => {
    const lags = payLagDays(
      [credit("2026-08-14"), credit("2026-09-14"), credit("2026-10-15")],
      ann("2026-07-31", "2026-08-31", "2026-09-30"),
    );
    // 14, 14 e 15 dias.
    expect(lags.get("AAAA11")).toBe(14);
  });

  it("com um só pagamento casado, ou nenhum, não vale: segue o padrão de 15 dias", () => {
    expect(payLagDays([credit("2026-09-14")], ann("2026-08-31")).has("AAAA11")).toBe(false);
    expect(payLagDays([], ann("2026-08-31", "2026-09-30")).has("AAAA11")).toBe(false);
  });

  it("ignora crédito sem anúncio até 45 dias antes e outros tipos de provento", () => {
    const lags = payLagDays(
      [
        credit("2026-09-14"),
        credit("2026-10-15"),
        credit("2026-12-20"), // anúncio de 31/10 está a 50 dias
        paid("AAAA11", "REEMBOLSO", 5, "2026-10-16"),
      ],
      ann("2026-08-31", "2026-09-30", "2026-10-31"),
    );
    // 14 e 15 dias: a mediana 14,5 arredonda para 15.
    expect(lags.get("AAAA11")).toBe(15);
  });

  it("um anúncio casa com um crédito só", () => {
    const lags = payLagDays([credit("2026-09-14"), credit("2026-09-16")], ann("2026-08-31"));
    expect(lags.has("AAAA11")).toBe(false);
  });
});

describe("upcomingDividends: pagamento pelo intervalo do fundo", () => {
  const input = {
    now,
    transactions: [buy],
    received: [] as DividendEntry[],
    announcements: new Map([["AAAA11", [{ exDate: at("2026-10-15"), perShare: 0.1 }]]]),
  };

  it("sem intervalo guardado, a data ex mais 15 dias", () => {
    expect(upcomingDividends(input)[0].payBy).toEqual(at("2026-10-30"));
  });

  it("com o intervalo do fundo, a data ex mais esse intervalo", () => {
    const [item] = upcomingDividends({ ...input, payLag: new Map([["AAAA11", 8]]) });
    expect(item.payBy).toEqual(at("2026-10-23"));
  });
});
