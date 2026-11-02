import { describe, expect, it } from "vitest";
import {
  BENCHMARK_TITLE,
  daysSince,
  medianRate,
  midRate,
  parseBrDate,
  parseTreasuryCsv,
  parseTreasuryPackage,
  summarizeRate,
  treasuryRowId,
  TREASURY_COLUMNS,
  type TreasurySeriesPoint,
} from "./treasury-rates";

const HEADER = TREASURY_COLUMNS.join(";");
const KIND = "Tesouro IPCA+ com Juros Semestrais";

/** Uma linha do CSV. Os PUs são valores de teste; o que importa nos testes são as taxas e as datas. */
const line = (kind: string, maturity: string, base: string, buy: string, sell: string) =>
  [kind, maturity, base, buy, sell, "4389,83", "4355,94", "4355,94"].join(";");
const ntnb = (base: string, buy: string, sell: string) => line(KIND, "15/05/2035", base, buy, sell);
const file = (...lines: string[]) => [HEADER, ...lines].join("\n") + "\n";

describe("parseBrDate", () => {
  it("converte dd/mm/aaaa e recusa o que não é uma data real", () => {
    expect(parseBrDate("30/10/2026")).toBe("2026-10-30");
    expect(parseBrDate("29/02/2028")).toBe("2028-02-29");
    for (const bad of ["31/02/2026", "2026-10-30", "5/1/2026", "", "30/13/2026"]) {
      expect(parseBrDate(bad)).toBeNull();
    }
  });
});

describe("parseTreasuryCsv", () => {
  it("mantém só os títulos acompanhados e converte datas e números", () => {
    const result = parseTreasuryCsv(
      file(
        line("Tesouro Selic", "01/03/2029", "30/10/2026", "0,06", "0,07"),
        // Mesmo vencimento, outro tipo (o Principal, sem cupom): não é o acompanhado.
        line("Tesouro IPCA+", "15/05/2035", "30/10/2026", "7,88", "8,00"),
        // Mesmo tipo, outro vencimento.
        line(KIND, "15/05/2037", "30/10/2026", "7,76", "7,88"),
        ntnb("30/10/2026", "7,86", "7,98"),
      ),
    );
    expect(result).toEqual({
      ok: true,
      invalid: 0,
      latestBaseDate: "2026-10-30",
      rows: [
        {
          kind: KIND,
          maturity: "2035-05-15",
          baseDate: "2026-10-30",
          buyRate: 7.86,
          sellRate: 7.98,
          buyPrice: 4389.83,
          sellPrice: 4355.94,
        },
      ],
    });
  });

  it("não filtra salto diário: os dias seguintes às duas votações de outubro de 2026 entram", () => {
    // O arquivo real vem do dia mais novo para o mais antigo.
    const result = parseTreasuryCsv(
      file(
        ntnb("27/10/2026", "7,87", "7,99"),
        ntnb("26/10/2026", "8,03", "8,15"),
        ntnb("23/10/2026", "6,75", "6,87"),
        ntnb("05/10/2026", "6,87", "6,99"),
        ntnb("02/10/2026", "7,54", "7,66"),
      ),
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.rows.map((row) => row.sellRate)).toEqual([7.99, 8.15, 6.87, 6.99, 7.66]);
    expect(result.latestBaseDate).toBe("2026-10-27");
  });

  it("aceita BOM e quebras de linha CRLF", () => {
    // O \r do cabeçalho é o que o teste protege: a 8ª coluna ("PU Base Manha") não é lida,
    // então um \r a mais nela só quebraria a conferência do cabeçalho.
    const text = "\uFEFF" + [HEADER, ntnb("30/10/2026", "7,86", "7,98")].join("\r\n") + "\r\n";
    const result = parseTreasuryCsv(text);
    if (!result.ok) throw new Error(result.reason);
    expect(result.rows).toHaveLength(1);
    expect(result.latestBaseDate).toBe("2026-10-30");
    expect(result.rows[0]).toMatchObject({
      buyRate: 7.86,
      sellRate: 7.98,
      buyPrice: 4389.83,
      sellPrice: 4355.94,
    });
  });

  it("rejeita o arquivo quando o cabeçalho muda", () => {
    const text = HEADER.replace("Data Base", "Data") + "\n" + ntnb("30/10/2026", "7,86", "7,98");
    expect(parseTreasuryCsv(text)).toEqual({ ok: false, reason: "cabeçalho inesperado" });
  });

  it("rejeita o arquivo quando uma linha não tem 8 colunas", () => {
    const result = parseTreasuryCsv(
      file(ntnb("30/10/2026", "7,86", "7,98"), "Tesouro Selic;01/03/2029;30/10/2026;0,06"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("colunas");
  });

  it("rejeita o arquivo sem nenhum título acompanhado", () => {
    const result = parseTreasuryCsv(
      file(line("Tesouro Selic", "01/03/2029", "30/10/2026", "0,06", "0,07")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("nenhum título");
  });

  it.each([
    ["ponto decimal", ntnb("30/10/2026", "7.86", "7,98")],
    ["taxa acima de 30%", ntnb("30/10/2026", "31,00", "7,98")],
    ["taxa abaixo de -10%", ntnb("30/10/2026", "-11,00", "7,98")],
    ["taxa vazia", ntnb("30/10/2026", "", "7,98")],
    ["data-base impossível", ntnb("31/02/2026", "7,86", "7,98")],
    ["data-base em outro formato", ntnb("2026-10-30", "7,86", "7,98")],
  ])("conta como inválida a linha com %s", (_name, badLine) => {
    // Uma inválida em duas acompanhadas (50%) passa de 1% e derruba o arquivo.
    const result = parseTreasuryCsv(file(badLine, ntnb("30/10/2026", "7,86", "7,98")));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inválidas");
  });

  it("tolera até 1% de linhas inválidas e conta quantas foram", () => {
    const good = Array.from({ length: 199 }, () => ntnb("30/10/2026", "7,86", "7,98"));
    const result = parseTreasuryCsv(file(...good, ntnb("30/10/2026", "7.86", "7,98")));
    if (!result.ok) throw new Error(result.reason);
    expect(result.invalid).toBe(1);
    expect(result.rows).toHaveLength(199);
  });
});

describe("treasuryRowId", () => {
  it("junta tipo, vencimento e data-base, então repetir a coleta não duplica", () => {
    const row = {
      kind: KIND,
      maturity: "2035-05-15",
      baseDate: "2026-10-30",
      buyRate: 7.86,
      sellRate: 7.98,
      buyPrice: 1,
      sellPrice: 1,
    };
    expect(treasuryRowId(row)).toBe(`${KIND}|2035-05-15|2026-10-30`);
  });
});

describe("midRate e medianRate", () => {
  it("a taxa de referência é a média de compra e venda, em 4 casas", () => {
    expect(midRate({ buyRate: 7.54, sellRate: 7.66 })).toBe(7.6);
    expect(midRate({ buyRate: 7.86, sellRate: 7.98 })).toBe(7.92);
    expect(midRate({ buyRate: 7.01, sellRate: 7.02 })).toBe(7.015);
  });

  it("a mediana trata número ímpar e par de pontos, série vazia e não altera a entrada", () => {
    const input = [3, 1, 2];
    expect(medianRate(input)).toBe(2);
    expect(input).toEqual([3, 1, 2]);
    expect(medianRate([4, 1, 3, 2])).toBe(2.5);
    expect(medianRate([])).toBeNull();
  });
});

describe("daysSince e summarizeRate", () => {
  const point = (baseDate: string, buy: number, sell: number): TreasurySeriesPoint => ({
    baseDate,
    buyRate: buy,
    sellRate: sell,
  });
  const now = new Date("2026-10-28T12:00:00Z");

  it("conta dias corridos pela data de hoje em UTC", () => {
    expect(daysSince("2026-10-30", new Date("2026-11-01T02:00:00Z"))).toBe(2);
    expect(daysSince("2026-10-30", new Date("2026-10-30T23:59:00Z"))).toBe(0);
  });

  it("resume a série de outubro: último ponto, mediana e a diferença entre os dois", () => {
    const summary = summarizeRate(
      [
        point("2026-10-02", 7.54, 7.66),
        point("2026-10-05", 6.87, 6.99),
        point("2026-10-23", 6.75, 6.87),
        point("2026-10-26", 8.03, 8.15),
        point("2026-10-27", 7.87, 7.99),
      ],
      now,
    );
    expect(summary).toEqual({
      last: 7.93,
      median: 7.6,
      divergence: 0.33,
      baseDate: "2026-10-27",
      stale: false,
      points: 5,
    });
  });

  it("ordena a entrada por data, então a ordem em que chega não importa", () => {
    const summary = summarizeRate(
      [point("2026-10-27", 7.87, 7.99), point("2026-10-02", 7.54, 7.66)],
      now,
    );
    expect(summary?.baseDate).toBe("2026-10-27");
    expect(summary?.last).toBe(7.93);
  });

  it("usa só os últimos 60 pregões por padrão e todos quando há menos", () => {
    const series = Array.from({ length: 70 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return point(date, index, index);
    });
    const summary = summarizeRate(series, new Date("2026-03-12T00:00:00Z"));
    expect(summary?.points).toBe(60);
    expect(summary?.last).toBe(69);
    expect(summary?.median).toBe(39.5); // mediana de 10..69
    expect(summarizeRate(series.slice(0, 3), new Date("2026-01-04T00:00:00Z"))?.points).toBe(3);
  });

  it("marca o dado como velho a partir de 11 dias", () => {
    const series = [point("2026-10-20", 7, 7)];
    expect(summarizeRate(series, new Date("2026-10-30T23:00:00Z"))?.stale).toBe(false);
    expect(summarizeRate(series, new Date("2026-10-31T00:00:00Z"))?.stale).toBe(true);
  });

  it("série vazia dá null", () => {
    expect(summarizeRate([], now)).toBeNull();
  });
});

describe("parseTreasuryPackage", () => {
  const CSV_URL =
    "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";
  const payload = (csv: object | null) => ({
    result: {
      resources: [
        {
          format: "PDF",
          url: "https://www.tesourotransparente.gov.br/taxa.pdf",
          last_modified: null,
        },
        ...(csv ? [csv] : []),
      ],
    },
  });

  it("devolve a URL e o last_modified do recurso CSV", () => {
    expect(
      parseTreasuryPackage(
        payload({ format: "CSV", url: CSV_URL, last_modified: "2026-10-31T10:21:20.453178" }),
      ),
    ).toEqual({ url: CSV_URL, lastModified: "2026-10-31T10:21:20.453178" });
  });

  it("recusa catálogo sem CSV, sem last_modified, sem lista e URL de outro host ou sem https", () => {
    expect(() => parseTreasuryPackage(payload(null))).toThrow();
    expect(() => parseTreasuryPackage(payload({ format: "CSV", url: CSV_URL }))).toThrow();
    expect(() => parseTreasuryPackage({ result: {} })).toThrow();
    expect(() => parseTreasuryPackage(null)).toThrow();
    expect(() =>
      parseTreasuryPackage(
        payload({ format: "CSV", url: "https://example.com/x.csv", last_modified: "2026-10-31" }),
      ),
    ).toThrow();
    expect(() =>
      parseTreasuryPackage(
        payload({
          format: "CSV",
          url: CSV_URL.replace("https://", "http://"),
          last_modified: "2026-10-31",
        }),
      ),
    ).toThrow();
  });
});

describe("título de referência", () => {
  it("é a NTN-B com cupom que vence em 15/05/2035", () => {
    expect(BENCHMARK_TITLE).toEqual({ kind: KIND, maturity: "2035-05-15" });
  });
});

describe("endurecimento depois da revisão", () => {
  const good = () => ntnb("30/10/2026", "7,86", "7,98");

  it("normaliza -0,00 para 0", () => {
    const result = parseTreasuryCsv(file(ntnb("30/10/2026", "-0,00", "7,98")));
    if (!result.ok) throw new Error(result.reason);
    expect(Object.is(result.rows[0].buyRate, 0)).toBe(true);
  });

  it.each([
    ["taxa de venda inválida sozinha", ntnb("30/10/2026", "7,86", "7.98")],
    [
      "PU de compra inválido",
      line(KIND, "15/05/2035", "30/10/2026", "7,86", "7,98").replace("4389,83", "4389.83"),
    ],
    [
      "PU de venda inválido",
      [KIND, "15/05/2035", "30/10/2026", "7,86", "7,98", "4389,83", "abc", "4355,94"].join(";"),
    ],
  ])("conta como inválida a linha com %s", (_name, badLine) => {
    const result = parseTreasuryCsv(file(badLine, good()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inválidas");
  });

  it("aceita as taxas nos limites exatos", () => {
    const result = parseTreasuryCsv(
      file(ntnb("30/10/2026", "30,00", "-10,00"), ntnb("29/10/2026", "-10,00", "30,00")),
    );
    expect(result.ok).toBe(true);
  });

  it("o limite de 1%: 1 inválida em 100 passa e 2 em 100 recusa", () => {
    const ok = Array.from({ length: 99 }, good);
    const bad = ntnb("30/10/2026", "7.86", "7,98");
    expect(parseTreasuryCsv(file(...ok, bad)).ok).toBe(true);
    const fewer = Array.from({ length: 98 }, good);
    expect(parseTreasuryCsv(file(...fewer, bad, bad)).ok).toBe(false);
  });

  it("conta como inválida a linha do tipo acompanhado com vencimento que não é data", () => {
    const result = parseTreasuryCsv(
      file(good(), line(KIND, "xx/yy/zzzz", "30/10/2026", "7,86", "7,98")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inválidas");
  });

  it("ignora sem contar o vencimento válido de outro ano", () => {
    const result = parseTreasuryCsv(
      file(good(), line(KIND, "15/05/2045", "30/10/2026", "7,86", "7,98")),
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.invalid).toBe(0);
    expect(result.rows).toHaveLength(1);
  });

  it("aceita arquivo sem quebra de linha no fim", () => {
    expect(parseTreasuryCsv(HEADER + "\n" + good()).ok).toBe(true);
  });

  it("ignora linha em branco no meio e recusa linha só com espaços", () => {
    expect(parseTreasuryCsv([HEADER, good(), "", good()].join("\n")).ok).toBe(true);
    const spaces = parseTreasuryCsv([HEADER, good(), "   ", good()].join("\n"));
    expect(spaces.ok).toBe(false);
  });

  it("a data-base inválida na série deixa o dado velho", () => {
    const summary = summarizeRate(
      [{ baseDate: "xx", buyRate: 7, sellRate: 7 }],
      new Date("2026-10-28T12:00:00Z"),
    );
    expect(summary?.stale).toBe(true);
  });

  it("ordena as datas pela comparação direta", () => {
    const summary = summarizeRate(
      [
        { baseDate: "2026-10-27", buyRate: 7, sellRate: 7 },
        { baseDate: "2026-10-02", buyRate: 1, sellRate: 1 },
      ],
      new Date("2026-10-28T12:00:00Z"),
    );
    expect(summary?.baseDate).toBe("2026-10-27");
  });

  describe("parseTreasuryPackage", () => {
    const URL_OK = "https://www.tesourotransparente.gov.br/x.csv";
    const pkg = (...resources: object[]) => ({ result: { resources } });

    it("recusa URL com porta ou com usuário", () => {
      for (const url of [
        "https://www.tesourotransparente.gov.br:8443/x.csv",
        "https://user@www.tesourotransparente.gov.br/x.csv",
        "https://user:pw@www.tesourotransparente.gov.br/x.csv",
      ]) {
        expect(() =>
          parseTreasuryPackage(pkg({ format: "CSV", url, last_modified: "2026-10-31" })),
        ).toThrow();
      }
    });

    it("escolhe o primeiro CSV que tem last_modified e aceita format em minúsculas", () => {
      expect(
        parseTreasuryPackage(
          pkg(
            { format: "CSV", url: URL_OK },
            { format: "csv", url: URL_OK, last_modified: "2026-10-31" },
          ),
        ),
      ).toEqual({ url: URL_OK, lastModified: "2026-10-31" });
    });

    it("lança quando nenhum CSV tem last_modified", () => {
      expect(() => parseTreasuryPackage(pkg({ format: "CSV", url: URL_OK }))).toThrow(
        /last_modified/,
      );
    });
  });
});
