import type { DividendEntry } from "./dividend-window";
import type { PaySchedule } from "./fundamentus";

// Histórico de proventos do FII: o Yahoo é a base (valores com todas as casas) e o Fundamentus
// completa (spec 2026-11-06-fundamentus-historico-design.md). Medido em 2026-11-06: o Yahoo
// perdeu a data ex de dezembro de 2025 de GARE11, HGRU11 e TRXF11 e deu 0,95 no lugar de 0,92 no
// XPML11 de setembro; o Fundamentus tem todos os meses, mas arredonda o FII para 2 casas.

const DAY = 86_400_000;
/** A data ex vem até 10 dias depois da data com (o dia útil seguinte, com folga para feriados). */
const EX_WINDOW_DAYS = 10;
/** Diferença que cabe no arredondamento para 2 casas do Fundamentus. */
export const ROUNDING_TOLERANCE = 0.0051;

/** O dia útil (seg. a sex.) depois da data com: a data ex que se supõe. Feriados não são vistos. */
export function exDateAfter(comDate: Date): Date {
  let date = new Date(comDate.getTime() + DAY);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date = new Date(date.getTime() + DAY);
  return date;
}

/** O evento do Yahoo que corresponde à data com: data ex depois dela, até 10 dias. */
export function matchesComDate(exDate: Date, comDate: Date): boolean {
  const diff = exDate.getTime() - comDate.getTime();
  return diff > 0 && diff <= EX_WINDOW_DAYS * DAY;
}

/**
 * Junta os rendimentos do Fundamentus aos proventos do Yahoo. Cada rendimento casa com um evento
 * do Yahoo (o primeiro livre, pela data ex até 10 dias depois da data com):
 * - casou e os valores diferem até o arredondamento: fica o do Yahoo;
 * - casou e diferem mais que isso: fica o do Fundamentus (o Yahoo errou o valor);
 * - não casou: entra o do Fundamentus, com a data ex no dia útil seguinte à data com.
 * Eventos do Yahoo sem par continuam. Só entra do Fundamentus o que tem data com desde `from`, a
 * janela buscada no Yahoo. Sem o Fundamentus (`null`), o resultado é o próprio Yahoo.
 */
export function mergeDividendHistory(
  yahoo: readonly DividendEntry[],
  schedules: readonly PaySchedule[] | null,
  from: Date,
): DividendEntry[] {
  if (!schedules) return [...yahoo];
  const result = yahoo.map((entry) => ({ ...entry }));
  const used = new Set<number>();
  const rendimentos = schedules
    .filter((item) => item.kind === "RENDIMENTO" && item.comDate.getTime() >= from.getTime())
    .sort((a, b) => a.comDate.getTime() - b.comDate.getTime());
  for (const item of rendimentos) {
    const index = result.findIndex(
      (entry, i) => !used.has(i) && matchesComDate(entry.exDate, item.comDate),
    );
    if (index < 0) {
      result.push({ exDate: exDateAfter(item.comDate), amount: item.perShare });
      used.add(result.length - 1);
      continue;
    }
    used.add(index);
    if (Math.abs(result[index].amount - item.perShare) > ROUNDING_TOLERANCE) {
      result[index] = { ...result[index], amount: item.perShare };
    }
  }
  return result.sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
}
