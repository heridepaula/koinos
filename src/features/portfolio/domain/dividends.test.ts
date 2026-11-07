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
          comDate: null,
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

describe("upcomingDividends: datas de pagamento do Fundamentus", () => {
  const stock: LedgerEntry = { ...buy, id: "b2", ticker: "PETR4", quantity: 200 };
  const sched = (
    kind: "RENDIMENTO" | "DIVIDENDO" | "JCP",
    com: string,
    pay: string,
    perShare = 1,
  ) => ({ kind, comDate: at(com), payDate: at(pay), perShare });
  const base = {
    now,
    transactions: [buy, stock],
    received: [] as DividendEntry[],
    announcements: new Map([["AAAA11", [{ exDate: at("2026-10-01"), perShare: 0.1 }]]]),
  };

  it("usa a data anunciada e deixa o Yahoo de lado no mesmo ativo", () => {
    const upcoming = upcomingDividends({
      ...base,
      schedules: new Map([["AAAA11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15", 0.12)]]]),
    });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({
      source: "FUNDAMENTUS",
      payBy: at("2026-10-15"),
      comDate: at("2026-09-30"),
      quantity: 100,
    });
    expect(upcoming[0].amount).toBeCloseTo(12, 10);
  });

  it("o rendimento leva as casas do Yahoo quando cabe no arredondamento; senão, o do Fundamentus", () => {
    const close = upcomingDividends({
      ...base,
      announcements: new Map([["AAAA11", [{ exDate: at("2026-10-01"), perShare: 0.083 }]]]),
      schedules: new Map([["AAAA11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15", 0.08)]]]),
    });
    expect(close[0].perShare).toBe(0.083);
    const far = upcomingDividends({
      ...base,
      announcements: new Map([["AAAA11", [{ exDate: at("2026-10-01"), perShare: 0.095 }]]]),
      schedules: new Map([["AAAA11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15", 0.08)]]]),
    });
    expect(far[0].perShare).toBe(0.08);
  });

  it("ações entram, inclusive pagamento meses à frente, e o JCP vem líquido", () => {
    const upcoming = upcomingDividends({
      ...base,
      announcements: new Map(),
      schedules: new Map([
        [
          "PETR4",
          [
            sched("JCP", "2026-08-21", "2026-11-23", 1),
            sched("DIVIDENDO", "2026-08-21", "2026-12-21", 0.5),
          ],
        ],
      ]),
    });
    expect(upcoming.map((item) => item.kind)).toEqual(["JCP", "DIVIDENDO"]);
    expect(upcoming[0].amount).toBeCloseTo(170, 10); // 200 × 1 × 85%
    expect(upcoming[1].amount).toBeCloseTo(100, 10);
  });

  it("pagamento antes do mês atual fica de fora; o deste mês que passou continua", () => {
    const upcoming = upcomingDividends({
      ...base,
      announcements: new Map(),
      schedules: new Map([
        [
          "AAAA11",
          [
            sched("RENDIMENTO", "2026-08-31", "2026-09-15"),
            sched("RENDIMENTO", "2026-09-30", "2026-10-14"),
          ],
        ],
      ]),
    });
    expect(upcoming.map((item) => item.payBy)).toEqual([at("2026-10-14")]);
  });

  it("o crédito da B3 perto da data confirma um anúncio só, e o Reembolso também vale", () => {
    const schedules = new Map([
      [
        "PETR4",
        [sched("JCP", "2026-09-01", "2026-10-11"), sched("JCP", "2026-09-01", "2026-10-11")],
      ],
      ["AAAA11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15")]],
    ]);
    const upcoming = upcomingDividends({
      ...base,
      announcements: new Map(),
      received: [
        paid("PETR4", "JCP", 10, "2026-10-13"),
        paid("AAAA11", "REEMBOLSO", 5, "2026-10-15"),
      ],
      schedules,
    });
    expect(upcoming.map((item) => item.ticker)).toEqual(["PETR4"]);
  });

  it("sem cotas no fim da data com não entra; a compra no próprio dia conta", () => {
    const late: LedgerEntry = { ...buy, id: "b3", ticker: "BBBB11", date: at("2026-09-30") };
    const later: LedgerEntry = { ...buy, id: "b4", ticker: "CCCC11", date: at("2026-10-01") };
    const upcoming = upcomingDividends({
      ...base,
      transactions: [late, later],
      announcements: new Map(),
      schedules: new Map([
        ["BBBB11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15")]],
        ["CCCC11", [sched("RENDIMENTO", "2026-09-30", "2026-10-15")]],
      ]),
    });
    expect(upcoming.map((item) => item.ticker)).toEqual(["BBBB11"]);
  });

  it("com a foto da B3, só o anunciado depois dela e o que não está nela", () => {
    const upcoming = upcomingDividends({
      ...base,
      announcements: new Map(),
      forecast: {
        asOf: at("2026-10-05"),
        items: [
          {
            ticker: "PETR4",
            kind: "JCP",
            payDate: at("2026-11-23"),
            quantity: 200,
            perShare: 1,
            amount: 170,
          },
        ],
      },
      schedules: new Map([
        [
          "AAAA11",
          [
            sched("RENDIMENTO", "2026-09-30", "2026-10-15"),
            sched("RENDIMENTO", "2026-10-07", "2026-10-22"),
          ],
        ],
        ["PETR4", [sched("JCP", "2026-10-06", "2026-11-23")]],
      ]),
    });
    expect(upcoming.map((item) => `${item.source}:${item.ticker}`)).toEqual([
      "FUNDAMENTUS:AAAA11",
      "FUNDAMENTUS:PETR4",
    ]);
    expect(upcoming[0].payBy).toEqual(at("2026-10-22"));
  });
});

describe("upcomingDividends: item da B3 com anúncio do Fundamentus", () => {
  const forecastItem = (
    ticker: string,
    kind: DividendEntry["kind"],
    pay: string | null,
    amount: number,
  ) => ({ ticker, kind, payDate: pay ? at(pay) : null, quantity: 100, perShare: 1, amount });
  const base = {
    now: new Date("2026-11-07T15:00:00Z"),
    transactions: [buy],
    received: [] as DividendEntry[],
    announcements: new Map(),
    forecast: {
      asOf: at("2026-11-05"),
      items: [
        forecastItem("AAAA11", "RENDIMENTO", "2026-11-16", 95),
        forecastItem("PETR4", "REEMBOLSO", "2026-11-23", 55.61),
        forecastItem("EGIE3", "DIVIDENDO", null, 75.64),
      ],
    },
    schedules: new Map([
      [
        "AAAA11",
        [
          {
            kind: "RENDIMENTO" as const,
            comDate: at("2026-10-30"),
            payDate: at("2026-11-16"),
            perShare: 0.95,
          },
        ],
      ],
      [
        "PETR4",
        [
          {
            kind: "JCP" as const,
            comDate: at("2026-08-21"),
            payDate: at("2026-11-23"),
            perShare: 0.67,
          },
        ],
      ],
    ]),
  };

  it("segue como anunciado, com a data com e o valor da B3; sem anúncio, fica B3", () => {
    const upcoming = upcomingDividends(base);
    expect(
      upcoming.map((item) => [item.ticker, item.source, item.comDate, item.amount, item.kind]),
    ).toEqual([
      ["AAAA11", "FUNDAMENTUS", at("2026-10-30"), 95, "RENDIMENTO"],
      ["PETR4", "FUNDAMENTUS", at("2026-08-21"), 55.61, "REEMBOLSO"],
      ["EGIE3", "B3", null, 75.64, "DIVIDENDO"],
    ]);
  });

  it("sai do a receber quando o crédito da B3 chega (pago)", () => {
    const upcoming = upcomingDividends({
      ...base,
      received: [paid("AAAA11", "RENDIMENTO", 95, "2026-11-16")],
    });
    expect(upcoming.map((item) => item.ticker)).toEqual(["PETR4", "EGIE3"]);
  });
});

describe("monthSummary: detalhes dos cards do mês", () => {
  const upcoming = (ticker: string, pay: string | null, amount = 10) => ({
    ticker,
    kind: "RENDIMENTO" as const,
    exDate: null,
    comDate: null,
    quantity: 10,
    perShare: 1,
    amount,
    payBy: pay ? at(pay) : null,
    source: "B3" as const,
  });

  it("conta os ativos, o último crédito, o mês anterior e o próximo pagamento", () => {
    const summary = monthSummary(
      now, // 20/10/2026
      [
        paid("AAAA11", "RENDIMENTO", 10, "2026-10-07"),
        paid("AAAA11", "REEMBOLSO", 2, "2026-10-14"),
        paid("BBBB11", "RENDIMENTO", 5, "2026-10-09"),
        paid("AAAA11", "RENDIMENTO", 9, "2026-09-14"),
        paid("CCCC11", "RENDIMENTO", 4, "2026-09-15"),
      ],
      [
        upcoming("DDDD11", "2026-10-16"), // passou: não é o próximo
        upcoming("EEEE11", "2026-10-28"),
        upcoming("FFFF11", "2026-10-23"),
        upcoming("GGGG11", "2026-11-10"), // outro mês
      ],
    );
    expect(summary).toMatchObject({
      receivedAssets: 2,
      lastReceived: { ticker: "AAAA11", date: at("2026-10-14") },
      previousMonth: 13,
      upcomingAssets: 3,
      nextUpcoming: { ticker: "FFFF11", date: at("2026-10-23") },
      lastUpcoming: at("2026-10-28"),
    });
  });

  it("sem crédito nem a receber, tudo vazio", () => {
    expect(monthSummary(now, [], [])).toMatchObject({
      receivedAssets: 0,
      lastReceived: null,
      previousMonth: 0,
      upcomingAssets: 0,
      nextUpcoming: null,
      lastUpcoming: null,
    });
  });
});
