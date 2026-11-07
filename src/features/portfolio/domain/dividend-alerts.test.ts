import { describe, expect, it } from "vitest";
import type { DividendEntry } from "@/features/transactions";
import { dividendAlerts } from "./dividend-alerts";
import type { UpcomingDividend } from "./types";

// O Intl põe um espaço não separável depois do "R$".
const plain = (text: string) => text.replace(/ /g, " ");
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Sábado, 07/11/2026, 14h em São Paulo.
const now = new Date("2026-11-07T17:00:00.000Z");

const upcoming = (patch: Partial<UpcomingDividend>): UpcomingDividend => ({
  ticker: "HGLG11",
  kind: "RENDIMENTO",
  exDate: null,
  comDate: d("2026-10-30"),
  quantity: 100,
  perShare: 1.1,
  amount: 110,
  payBy: d("2026-11-13"),
  source: "FUNDAMENTUS",
  ...patch,
});

const credit = (ticker: string, paidAt: string, amount: number): DividendEntry =>
  ({ ticker, paidAt: d(paidAt), kind: "RENDIMENTO", amount }) as DividendEntry;

describe("dividendAlerts", () => {
  it("anúncio que ainda vai pagar: valor por cota, data e o total da posição", () => {
    const [alert] = dividendAlerts({ now, upcoming: [upcoming({})], received: [] });
    expect(plain(alert.title)).toBe("HGLG11 anunciou pagamento de R$ 1,10 por cota no dia 13/11");
    expect(alert).toMatchObject({
      id: "provento-hglg11-rendimento-2026-11-13",
      level: "dividend",
      detail: "Rendimento",
      amount: 110,
    });
  });

  it("a ação paga por ação, e sem data o título diz que ela não saiu", () => {
    const [alert] = dividendAlerts({
      now,
      upcoming: [upcoming({ ticker: "PETR4", kind: "JCP", perShare: 0.5, payBy: null })],
      received: [],
      classes: new Map([["PETR4", "ACAO"]]),
    });
    expect(plain(alert.title)).toBe(
      "PETR4 anunciou pagamento de R$ 0,50 por ação (data ainda não divulgada)",
    );
    expect(alert.detail).toBe("JCP");
  });

  it("no Yahoo, a data é uma estimativa", () => {
    const [alert] = dividendAlerts({
      now,
      upcoming: [upcoming({ source: "YAHOO", comDate: null, exDate: d("2026-10-31") })],
      received: [],
    });
    expect(alert.detail).toBe("Rendimento · Data estimada");
  });

  it("data oficial que chegou vira pagamento do dia, junto com os créditos da B3", () => {
    const alerts = dividendAlerts({
      now,
      upcoming: [upcoming({ ticker: "XPML11", payBy: d("2026-11-06"), amount: 50 })],
      received: [credit("KNRI11", "2026-11-06", 80), credit("HGLG11", "2026-11-07", 110)],
    });
    expect(alerts.map((alert) => alert.id)).toEqual([
      "pagamento-2026-11-07",
      "pagamento-2026-11-06",
    ]);
    expect(alerts[0].title).toBe("Proventos caem na conta hoje");
    expect(alerts[1]).toMatchObject({
      title: "Proventos pagos em 06/11",
      amount: 130,
      detail: "KNRI11 · XPML11",
      fingerprint: "KNRI11,XPML11",
    });
  });

  it("a estimativa do Yahoo vencida não é dinheiro na conta", () => {
    const alerts = dividendAlerts({
      now,
      upcoming: [upcoming({ source: "YAHOO", payBy: d("2026-11-05") })],
      received: [],
    });
    expect(alerts).toEqual([]);
  });

  it("o pagamento sai do sino depois de 7 dias", () => {
    const alerts = dividendAlerts({
      now,
      upcoming: [],
      received: [credit("HGLG11", "2026-11-01", 110), credit("HGLG11", "2026-10-31", 110)],
    });
    expect(alerts.map((alert) => alert.id)).toEqual(["pagamento-2026-11-01"]);
  });

  it("um valor ou uma data nova muda a impressão do anúncio", () => {
    const first = dividendAlerts({ now, upcoming: [upcoming({})], received: [] })[0];
    const revised = dividendAlerts({
      now,
      upcoming: [upcoming({ perShare: 1.2 })],
      received: [],
    })[0];
    expect(revised.id).toBe(first.id);
    expect(revised.fingerprint).not.toBe(first.fingerprint);
  });

  it("dois anúncios do mesmo ativo, tipo e dia viram um alerta só, com um id só", () => {
    const alerts = dividendAlerts({
      now,
      upcoming: [
        upcoming({
          ticker: "PETR4",
          kind: "REEMBOLSO",
          perShare: 0.2,
          amount: 20,
          payBy: d("2026-12-21"),
        }),
        upcoming({
          ticker: "PETR4",
          kind: "REEMBOLSO",
          perShare: 0.47,
          amount: 47,
          payBy: d("2026-12-21"),
        }),
      ],
      received: [],
      classes: new Map([["PETR4", "ACAO"]]),
    });
    expect(alerts).toHaveLength(1);
    expect(plain(alerts[0].title)).toBe(
      "PETR4 anunciou pagamento de R$ 0,67 por ação no dia 21/12",
    );
    expect(alerts[0]).toMatchObject({
      id: "provento-petr4-reembolso-2026-12-21",
      detail: "Reembolso · 2 anúncios",
      amount: 67,
      fingerprint: "0.2+0.47|2026-12-21",
    });
  });

  it("os ids dos alertas nunca se repetem", () => {
    const alerts = dividendAlerts({
      now,
      upcoming: [
        upcoming({ ticker: "EGIE3", kind: "DIVIDENDO", payBy: null, comDate: null }),
        upcoming({ ticker: "EGIE3", kind: "DIVIDENDO", payBy: null, comDate: null, perShare: 0.3 }),
        upcoming({}),
      ],
      received: [credit("HGLG11", "2026-11-06", 10), credit("HGLG11", "2026-11-06", 5)],
    });
    const ids = alerts.map((alert) => alert.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
