import { describe, expect, it } from "vitest";
import {
  BACKOFF_INITIAL_MS,
  BACKOFF_MAX_MS,
  IDLE_LIMIT_MS,
  isIdle,
  needsRerender,
  nextBackoffMs,
} from "./quote-clock";

const at = (iso: string) => new Date(`${iso}-03:00`);

describe("needsRerender", () => {
  it("o banco está mais novo que a tela: re-renderiza", () => {
    expect(needsRerender(at("2026-11-06T10:00"), at("2026-11-06T10:31"))).toBe(true);
  });

  it("tela e banco iguais, ou tela mais nova: não", () => {
    expect(needsRerender(at("2026-11-06T10:00"), at("2026-11-06T10:00"))).toBe(false);
    expect(needsRerender(at("2026-11-06T10:31"), at("2026-11-06T10:00"))).toBe(false);
  });

  it("sem cotação no banco, não há o que mostrar", () => {
    expect(needsRerender(null, null)).toBe(false);
    expect(needsRerender(at("2026-11-06T10:00"), null)).toBe(false);
  });

  it("a tela sem cotação e o banco com uma: re-renderiza", () => {
    expect(needsRerender(null, at("2026-11-06T10:00"))).toBe(true);
  });
});

describe("nextBackoffMs", () => {
  it("avançou: zera o recuo", () => {
    expect(nextBackoffMs(20 * 60_000, true)).toBe(0);
  });

  it("não avançou: 5 min na primeira, depois dobra até 30 min", () => {
    expect(nextBackoffMs(0, false)).toBe(BACKOFF_INITIAL_MS);
    expect(nextBackoffMs(5 * 60_000, false)).toBe(10 * 60_000);
    expect(nextBackoffMs(10 * 60_000, false)).toBe(20 * 60_000);
    expect(nextBackoffMs(20 * 60_000, false)).toBe(BACKOFF_MAX_MS);
    expect(nextBackoffMs(BACKOFF_MAX_MS, false)).toBe(BACKOFF_MAX_MS);
  });
});

describe("isIdle", () => {
  it("sem interação há mais de 60 min, está ocioso", () => {
    const now = at("2026-11-06T12:00").getTime();
    expect(isIdle(now - IDLE_LIMIT_MS, now)).toBe(false);
    expect(isIdle(now - IDLE_LIMIT_MS - 1, now)).toBe(true);
    expect(isIdle(now, now)).toBe(false);
  });
});
