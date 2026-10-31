import { describe, expect, it } from "vitest";
import { byClass, inClass, parseClassParam } from "./class-filter";

describe("parseClassParam", () => {
  it("lê fiis e acoes", () => {
    expect(parseClassParam("fiis")).toBe("FII");
    expect(parseClassParam("acoes")).toBe("ACAO");
  });
  it("sem parâmetro ou desconhecido é Geral", () => {
    expect(parseClassParam(undefined)).toBe("TODOS");
    expect(parseClassParam(null)).toBe("TODOS");
    expect(parseClassParam("")).toBe("TODOS");
    expect(parseClassParam("FIIS")).toBe("TODOS");
    expect(parseClassParam("toString")).toBe("TODOS");
  });
  it("repetido na URL vale o primeiro", () => {
    expect(parseClassParam(["acoes", "fiis"])).toBe("ACAO");
  });
});

describe("byClass", () => {
  const classes = new Map<string, string | null>([
    ["AAAA11", "FII"],
    ["PETR4", "ACAO"],
    ["XXXX11", null],
  ]);
  const classOf = (ticker: string) => classes.get(ticker) ?? null;
  const items = [{ ticker: "AAAA11" }, { ticker: "PETR4" }, { ticker: "XXXX11" }];

  it("FIIs inclui a classe desconhecida, como o snapshot", () => {
    expect(byClass(items, classOf, "FII").map((item) => item.ticker)).toEqual(["AAAA11", "XXXX11"]);
  });
  it("Ações só traz ações", () => {
    expect(byClass(items, classOf, "ACAO").map((item) => item.ticker)).toEqual(["PETR4"]);
  });
  it("Geral traz tudo", () => {
    expect(byClass(items, classOf, "TODOS")).toHaveLength(3);
  });
  it("inClass segue a mesma regra", () => {
    expect(inClass("FII", null)).toBe(true);
    expect(inClass("ACAO", null)).toBe(false);
    expect(inClass("TODOS", "ACAO")).toBe(true);
  });
});
