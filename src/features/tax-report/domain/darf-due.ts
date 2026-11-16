/**
 * Vencimento do DARF (código 6015) de um mês de apuração "AAAA-MM": o último dia útil do mês
 * seguinte (segunda a sexta). Os feriados nacionais não entram: a tela avisa que, num feriado, o
 * prazo pode ser o dia útil anterior. Devolve "AAAA-MM-DD".
 */
export function darfDueDate(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const year = match ? Number(match[1]) : NaN;
  const monthNumber = match ? Number(match[2]) : NaN;
  if (!match || monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`Mês inválido: ${month}`);
  }
  // O dia 0 do mês seguinte ao seguinte é o último dia do mês seguinte (UTC, sem fuso).
  const last = new Date(Date.UTC(year, monthNumber + 1, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  return last.toISOString().slice(0, 10);
}
