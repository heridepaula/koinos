import { describe, expect, it } from "vitest";
import { darfDueDate } from "./darf-due";

describe("darfDueDate", () => {
  it("vence no último dia útil do mês seguinte", () => {
    // Abril de 2025 termina numa quarta-feira.
    expect(darfDueDate("2025-03")).toBe("2025-04-30");
  });

  it("recua do sábado para a sexta", () => {
    // 31/05/2025 foi um sábado.
    expect(darfDueDate("2025-04")).toBe("2025-05-30");
  });

  it("recua do domingo para a sexta", () => {
    // 31/08/2025 foi um domingo.
    expect(darfDueDate("2025-07")).toBe("2025-08-29");
  });

  it("vira o ano em dezembro", () => {
    // 31/01/2026 é um sábado.
    expect(darfDueDate("2025-12")).toBe("2026-01-30");
  });

  it("acerta fevereiro de ano bissexto", () => {
    // 29/02/2024 foi uma quinta-feira.
    expect(darfDueDate("2024-01")).toBe("2024-02-29");
  });

  it("recusa um mês inválido", () => {
    expect(() => darfDueDate("2025-13")).toThrow(RangeError);
    expect(() => darfDueDate("2025")).toThrow(RangeError);
  });
});
