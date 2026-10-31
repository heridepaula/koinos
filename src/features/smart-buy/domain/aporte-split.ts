// Divide o aporte entre FIIs e ações em centavos inteiros, sem a deriva do ponto flutuante
// (1024,1 * 100 = 102409,99999999999). Os FIIs levam os centavos para baixo; as ações, o resto.
export function splitAmount(amount: number, fiisPercent: number): { fii: number; stock: number } {
  const cents = Math.round(amount * 100);
  const fiiCents = Math.floor((cents * fiisPercent) / 100);
  return { fii: fiiCents / 100, stock: (cents - fiiCents) / 100 };
}
