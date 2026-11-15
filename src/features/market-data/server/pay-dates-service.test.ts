import { beforeEach, describe, expect, it, vi } from "vitest";

// O serviço é de servidor e fala com o Mongo e o site. Aqui os dois são trocados por dublês para
// provar só o contrato do lote: um ativo com erro não derruba os outros, e repetir a leitura grava
// o mesmo.
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db/mongo", () => ({ connectMongo: vi.fn(async () => undefined) }));

const pages = new Map<string, string | Error>();
vi.mock("../adapters/fundamentus", () => ({
  fetchFundamentusDividendsPage: vi.fn(async (ticker: string) => {
    const page = pages.get(ticker);
    if (page instanceof Error) throw page;
    return page ?? "";
  }),
}));

const stored: { assets: unknown[]; updates: { _id: string; set: Record<string, unknown> }[] } = {
  assets: [],
  updates: [],
};
vi.mock("./models", () => ({
  AssetModel: {
    find: () => ({ lean: async () => stored.assets }),
    updateOne: vi.fn(async (filter: { _id: string }, update: { $set: Record<string, unknown> }) => {
      stored.updates.push({ _id: filter._id, set: update.$set });
    }),
  },
}));

import { refreshPayDates } from "./pay-dates-service";

const NOW = new Date("2026-11-10T15:00:00Z");
const fiiPage = (value: string) =>
  `<table id="resultado"><tbody><tr><td>30/10/2026</td><td>Rendimento</td><td>16/11/2026</td><td>${value}</td></tr></tbody></table>`;

beforeEach(() => {
  pages.clear();
  stored.assets = [];
  stored.updates = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("refreshPayDates em lote", () => {
  const setup = () => {
    pages.set("AAAA11", fiiPage("1,10"));
    pages.set("BBBB11", fiiPage("0,90"));
    pages.set("CCCC11", new Error("Fundamentus respondeu 503"));
    pages.set("DDDD11", "<html><body>erro interno</body></html>");
    pages.set("EEEE11", fiiPage("0,75"));
    return ["AAAA11", "BBBB11", "CCCC11", "DDDD11", "EEEE11"];
  };

  it("1 de 5 falha com erro HTTP: os outros 4 gravam e o lote termina", async () => {
    const result = await refreshPayDates(setup(), NOW, { force: true });
    expect(result).toEqual({ updated: 4, failed: 1 });
    expect(stored.updates.map((update) => update._id).sort()).toEqual([
      "AAAA11",
      "BBBB11",
      "DDDD11",
      "EEEE11",
    ]);
  });

  it("o ativo que falhou não grava nada, nem payDatesFetchedAt (tenta de novo no próximo ciclo)", async () => {
    await refreshPayDates(setup(), NOW, { force: true });
    expect(stored.updates.find((update) => update._id === "CCCC11")).toBeUndefined();
  });

  it("HTML sem tabela grava null (ticker desconhecido), não uma lista inventada", async () => {
    await refreshPayDates(setup(), NOW, { force: true });
    expect(stored.updates.find((update) => update._id === "DDDD11")?.set.payDates).toBeNull();
  });

  it("repetir a leitura grava exatamente o mesmo (idempotente) e sem duplicar", async () => {
    const tickers = setup();
    await refreshPayDates(tickers, NOW, { force: true });
    const first = structuredClone(stored.updates);
    stored.updates = [];
    await refreshPayDates(tickers, NOW, { force: true });
    expect(stored.updates).toEqual(first);
    const aaaa = stored.updates.find((update) => update._id === "AAAA11")!;
    expect(aaaa.set.payDates).toHaveLength(1);
  });

  it("tickers repetidos na lista são lidos uma vez", async () => {
    await refreshPayDates(["AAAA11", "AAAA11", "AAAA11"], NOW, { force: true });
    expect(stored.updates).toHaveLength(1);
  });

  it("valor fora da escala do histórico vai para o log, e o lote grava mesmo assim", async () => {
    pages.set("AAAA11", fiiPage("1.500,00"));
    pages.set("EEEE11", fiiPage("0,75"));
    stored.assets = [
      {
        _id: "AAAA11",
        payDatesFetchedAt: null,
        dividendAnnouncements: [1.45, 1.5, 1.52, 1.5].map((perShare) => ({
          exDate: new Date("2026-01-01"),
          perShare,
        })),
      },
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await refreshPayDates(["AAAA11", "EEEE11"], NOW, { force: true });
    expect(result.failed).toBe(0);
    expect(
      warn.mock.calls.some(([message]) => String(message).includes("AAAA11: valor fora")),
    ).toBe(true);
    expect(stored.updates.find((update) => update._id === "AAAA11")?.set.payDates).toHaveLength(1);
  });
});
