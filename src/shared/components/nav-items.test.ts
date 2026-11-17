import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  activeTabIndex,
  moreItemsFor,
  navGroups,
  parentOf,
  tabItemsFor,
} from "./nav-items";

const hrefs = (items: readonly { href: string }[]) => items.map((item) => item.href);

describe("navGroups", () => {
  it("agrupa o menu na ordem de uso", () => {
    expect(navGroups().map((group) => [group.label, hrefs(group.items)])).toEqual([
      ["Carteira", ["/dashboard", "/ativos", "/proventos", "/independencia"]],
      ["Aporte", ["/recomendacoes", "/carteira-alvo"]],
      ["Registros", ["/transacoes", "/encerradas", "/atualizacao-b3", "/imposto-de-renda"]],
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
      ["Registros", ["/transacoes", "/encerradas", "/atualizacao-b3", "/imposto-de-renda"]],
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

describe("tab bar por largura", () => {
  it("abaixo de 481 px são as quatro de sempre, sem o Ativos", () => {
    expect(tabItemsFor("narrow").map((item) => item.tabLabel)).toEqual([
      "Dashboard",
      "Proventos",
      "Aporte",
    ]);
  });

  it("de 481 px o Ativos entra, na ordem do menu", () => {
    expect(tabItemsFor("wide").map((item) => item.tabLabel)).toEqual([
      "Dashboard",
      "Ativos",
      "Proventos",
      "Aporte",
    ]);
  });

  it("o Mais guarda o Ativos só na largura estreita", () => {
    expect(hrefs(moreItemsFor("narrow"))).toContain("/ativos");
    expect(hrefs(moreItemsFor("wide"))).not.toContain("/ativos");
  });

  it("cada página está na barra ou no Mais, nunca nos dois", () => {
    for (const width of ["narrow", "wide"] as const) {
      const all = [...hrefs(tabItemsFor(width)), ...hrefs(moreItemsFor(width))];
      expect(all.toSorted()).toEqual(hrefs(NAV_ITEMS).toSorted());
    }
  });

  it("o item ativo muda com a largura: /ativos é o Mais a 400 px e o Ativos a 600 px", () => {
    expect(activeTabIndex("narrow", "/ativos")).toBe(3);
    expect(activeTabIndex("wide", "/ativos")).toBe(1);
    expect(activeTabIndex("narrow", "/ativos/HGLG11")).toBe(3);
    expect(activeTabIndex("wide", "/ativos/HGLG11")).toBe(1);
  });

  it("Aporte é o 3º a 400 px e o 4º a 600 px; páginas do Mais ficam com o último", () => {
    expect(activeTabIndex("narrow", "/recomendacoes")).toBe(2);
    expect(activeTabIndex("wide", "/recomendacoes")).toBe(3);
    expect(activeTabIndex("narrow", "/carteira-alvo")).toBe(3);
    expect(activeTabIndex("wide", "/carteira-alvo")).toBe(4);
  });
});
