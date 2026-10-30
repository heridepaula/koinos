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

describe("priceToBook", () => {
  it("descarta P/VP fora de 0,3 a 3", () => {
    expect(priceToBook(1, 10)).toBeNull();
    expect(priceToBook(40, 10)).toBeNull();
    expect(priceToBook(9, 10)).toBe(0.9);
  });
});
