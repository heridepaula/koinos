import { describe, expect, it } from "vitest";
import { parseBolsaiFii, priceToBook } from "./fundamentals";

describe("parseBolsaiFii", () => {
  it("lê o VP e calcula o P/VP com 4+ casas, sem o arredondamento da API", () => {
    const parsed = parseBolsaiFii({
      ticker: "MCCI11",
      reference_date: "2026-09-01",
      close_price: 89.78,
      book_value_per_share: 94.999051,
      pvp: 0.95,
    });
    expect(parsed).toMatchObject({
      ticker: "MCCI11",
      bookValuePerShare: 94.999051,
      bookValueMonth: "2026-09",
    });
    expect(parsed!.priceToBook).toBeCloseTo(0.9451, 4);
  });

  it("sem VP ou sem mês de referência, não há dado", () => {
    expect(parseBolsaiFii({ ticker: "AAAA11", reference_date: "2026-09-01" })).toBeNull();
    expect(parseBolsaiFii({ ticker: "AAAA11", book_value_per_share: 10 })).toBeNull();
    expect(parseBolsaiFii({ error: "Pro tier required" })).toBeNull();
    expect(parseBolsaiFii(null)).toBeNull();
  });

  it("sem preço, guarda o VP e deixa o P/VP vazio", () => {
    const parsed = parseBolsaiFii({
      ticker: "aaaa11",
      reference_date: "2026-09-01",
      book_value_per_share: 10,
    });
    expect(parsed).toMatchObject({ ticker: "AAAA11", priceToBook: null });
  });
});

describe("parseBolsaiFii: perfil do FII", () => {
  it("lê vacância, segmento, tipo e a composição (recebíveis × imóveis)", () => {
    const parsed = parseBolsaiFii({
      ticker: "XPML11",
      reference_date: "2026-09-01",
      close_price: 97.2,
      book_value_per_share: 107.359665,
      vacancy_pct: 5.2,
      segment: "Shoppings",
      fund_type: "Híbrido",
      asset_composition: {
        real_estate_leased_pct: 60,
        land_pct: 4.1,
        cri_pct: 1.7,
        fii_holdings_pct: 34.2,
      },
    });
    expect(parsed).toMatchObject({
      vacancyPct: 5.2,
      segment: "Shoppings",
      fundType: "Híbrido",
      paperPct: 1.7,
    });
    expect(parsed!.realEstatePct).toBeCloseTo(64.1);
  });

  it("vacância fora de 0 a 100 e textos vazios viram nulo", () => {
    const parsed = parseBolsaiFii({
      ticker: "AAAA11",
      reference_date: "2026-09-01",
      book_value_per_share: 10,
      vacancy_pct: 140,
      segment: " ",
    });
    expect(parsed).toMatchObject({
      vacancyPct: null,
      segment: null,
      fundType: null,
      paperPct: null,
    });
  });
});

describe("priceToBook", () => {
  it("descarta P/VP fora de 0,3 a 3", () => {
    expect(priceToBook(1, 10)).toBeNull();
    expect(priceToBook(40, 10)).toBeNull();
    expect(priceToBook(9, 10)).toBe(0.9);
  });
});
