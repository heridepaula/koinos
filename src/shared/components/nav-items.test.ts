import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navGroups, parentOf } from "./nav-items";

const hrefs = (items: readonly { href: string }[]) => items.map((item) => item.href);

describe("navGroups", () => {
  it("agrupa o menu na ordem de uso", () => {
    expect(navGroups().map((group) => [group.label, hrefs(group.items)])).toEqual([
      ["Carteira", ["/dashboard", "/ativos", "/proventos", "/independencia"]],
      ["Aporte", ["/recomendacoes", "/carteira-alvo"]],
      ["Registros", ["/transacoes", "/encerradas", "/atualizacao-b3"]],
    ]);
  });

  it("não perde nem repete nenhuma página", () => {
    const all = navGroups().flatMap((group) => hrefs(group.items));
    expect(all.toSorted()).toEqual(hrefs(NAV_ITEMS).toSorted());
  });

  it("sem as abas, devolve os grupos do Mais", () => {
    const more = navGroups(NAV_ITEMS.filter((item) => !item.tab));
    expect(more.map((group) => [group.label, hrefs(group.items)])).toEqual([
      ["Carteira", ["/ativos", "/independencia"]],
      ["Aporte", ["/carteira-alvo"]],
      ["Registros", ["/transacoes", "/encerradas", "/atualizacao-b3"]],
    ]);
  });

  it("omite o grupo que ficou vazio", () => {
    const only = navGroups(NAV_ITEMS.filter((item) => item.group === "aporte"));
    expect(only.map((group) => group.id)).toEqual(["aporte"]);
  });
});

describe("abas e subpáginas", () => {
  it("as abas seguem Dashboard, Proventos e Aporte", () => {
    expect(NAV_ITEMS.filter((item) => item.tab).map((item) => item.tab)).toEqual([
      "Dashboard",
      "Proventos",
      "Aporte",
    ]);
  });

  it("parentOf acha a página-mãe", () => {
    expect(parentOf("/proventos/reinvestimento")?.href).toBe("/proventos");
    expect(parentOf("/encerradas/ir")?.href).toBe("/encerradas");
    expect(parentOf("/ativos/HGLG11")?.href).toBe("/ativos");
    expect(parentOf("/dashboard")).toBeNull();
  });
});
