import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchFeed } from "./news";

afterEach(() => vi.unstubAllGlobals());

describe("fetchFeed", () => {
  it("põe o host na mensagem quando a rede falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));
    await expect(fetchFeed("https://www.infomoney.com.br/feed/")).rejects.toThrow(
      "www.infomoney.com.br: fetch failed",
    );
  });

  it("põe o host na mensagem quando a leitura do corpo falha", async () => {
    const response = {
      ok: true,
      headers: new Headers(),
      text: () => Promise.reject(new Error("aborted")),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(fetchFeed("https://fiis.com.br/noticias/feed/")).rejects.toThrow(
      "fiis.com.br: aborted",
    );
  });

  it("mantém a mensagem de status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchFeed("https://fiis.com.br/x")).rejects.toThrow("fiis.com.br respondeu 503");
  });
});
