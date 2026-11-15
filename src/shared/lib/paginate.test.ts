import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from "./paginate";

const rows = Array.from({ length: 25 }, (_, i) => i);
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("paginate", () => {
  it("devolve a primeira página", () => {
    const slice = paginate(rows, 1, 10);
    expect(slice.rows).toEqual(range(0, 9));
    expect(slice.page).toBe(1);
    expect(slice.pageCount).toBe(3);
    expect(slice.firstIndex).toBe(0);
    expect(slice.total).toBe(25);
  });

  it("devolve a última página parcial", () => {
    const slice = paginate(rows, 3, 10);
    expect(slice.rows).toEqual(range(20, 24));
    expect(slice.firstIndex).toBe(20);
  });

  it("corrige a página acima da faixa para a última", () => {
    const slice = paginate(rows, 9, 10);
    expect(slice.page).toBe(3);
    expect(slice.rows).toEqual(range(20, 24));
  });

  it("corrige página 0 e negativa para 1", () => {
    expect(paginate(rows, 0, 10).page).toBe(1);
    expect(paginate(rows, -2, 10).page).toBe(1);
  });

  it("trata não finito como 1 e trunca fracionário", () => {
    expect(paginate(rows, Number.NaN, 10).page).toBe(1);
    expect(paginate(rows, Number.POSITIVE_INFINITY, 10).page).toBe(1);
    expect(paginate(rows, Number.NEGATIVE_INFINITY, 10).page).toBe(1);
    expect(paginate(rows, 2.7, 10).page).toBe(2);
  });

  it("lista vazia tem uma página sem linhas", () => {
    const slice = paginate([], 4, 10);
    expect(slice.rows).toEqual([]);
    expect(slice.page).toBe(1);
    expect(slice.pageCount).toBe(1);
    expect(slice.firstIndex).toBe(0);
    expect(slice.total).toBe(0);
  });

  it("múltiplo exato não cria página extra", () => {
    const twenty = range(0, 19);
    const slice = paginate(twenty, 2, 10);
    expect(slice.pageCount).toBe(2);
    expect(slice.rows).toHaveLength(10);
  });

  it("tamanho maior que a lista cabe em uma página", () => {
    const slice = paginate(rows, 1, 50);
    expect(slice.rows).toHaveLength(25);
    expect(slice.pageCount).toBe(1);
  });

  it("recusa pageSize que não é inteiro positivo", () => {
    expect(() => paginate(rows, 1, 0)).toThrow(RangeError);
    expect(() => paginate(rows, 1, -1)).toThrow(RangeError);
    expect(() => paginate(rows, 1, 1.5)).toThrow(RangeError);
  });

  it("não muda a entrada e devolve outro array", () => {
    const input = [...rows];
    const slice = paginate(input, 1, 50);
    expect(slice.rows).not.toBe(input);
    expect(input).toEqual(rows);
  });
});

describe("tamanhos de página", () => {
  it("PAGE_SIZES e o padrão", () => {
    expect([...PAGE_SIZES]).toEqual([10, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});
