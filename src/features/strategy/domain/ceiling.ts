import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";

/** (teto − preço) / teto: positivo = abaixo do teto (margem de segurança). */
export function marginToCeiling(ceiling: number | null, price: number | null): number | null {
  if (ceiling === null || price === null || ceiling <= 0) return null;
  return (ceiling - price) / ceiling;
}

/** Teto muito longe do preço (menos da metade ou mais do dobro) costuma ser erro de digitação ou dado velho. */
export function isSuspiciousCeiling(ceiling: number | null, price: number | null): boolean {
  if (ceiling === null || price === null || price <= 0) return false;
  return ceiling < price * 0.5 || ceiling > price * 2;
}

/**
 * Parâmetros do aviso de divergência do teto (spec 2026-11-01-divergencia-teto-design.md). São
 * constantes do código, sem tela: mudar um valor é uma decisão do dono e uma alteração aqui.
 * Tudo em fração (0,01 = 1 p.p.).
 */
export const CEILING_CHECK = {
  /** Tijolo (e as demais classes): NTN-B real + este spread. O aluguel acompanha a inflação. */
  tijoloSpread: 0.01,
  /** Papel: NTN-B real + IPCA assumido + este spread. O DY do papel já traz a inflação. */
  paperSpread: 0.01,
  assumedInflation: 0.04,
  /** Há aviso quando |teto calculado ÷ teto da Suno − 1| passa disto. */
  limit: 0.1,
} as const;

/** O teto calculado de um FII cujo teto da Suno está fora do limite. Frações, exceto os preços. */
export type CeilingCheck = {
  /** Teto calculado, em R$ por cota. */
  calculated: number;
  /** calculado ÷ teto da Suno − 1, com 6 casas. Positivo: o teto da Suno está abaixo do calculado. */
  divergence: number;
  /** Rendimento exigido que dividiu a renda. */
  requiredYield: number;
  /** NTN-B real usada (a mediana de 60 pregões). */
  ntnbRealRate: number;
  /** Papel (soma o IPCA assumido) ou tijolo e demais classes. */
  paper: boolean;
};

export type CeilingCheckInput = {
  /** Teto da Suno. */
  ceiling: number | null;
  /** Proventos por cota dos 12 meses; null quando não há ou estão velhos. */
  income12m: number | null;
  paper: boolean;
  /** NTN-B real, em fração (7,675% = 0,07675); null sem dado ou com dado velho. */
  ntnbRealRate: number | null;
};

/**
 * Compara o teto da Suno com o teto calculado: proventos de 12 meses ÷ rendimento exigido. Devolve
 * o cálculo só quando a divergência passa do limite, nos dois lados; sem dado, null (sem aviso).
 */
export function ceilingCheck({
  ceiling,
  income12m,
  paper,
  ntnbRealRate,
}: CeilingCheckInput): CeilingCheck | null {
  if (ceiling === null || !Number.isFinite(ceiling) || ceiling <= 0) return null;
  if (income12m === null || !Number.isFinite(income12m) || income12m <= 0) return null;
  if (ntnbRealRate === null || !Number.isFinite(ntnbRealRate)) return null;
  const requiredYield =
    ntnbRealRate +
    (paper
      ? CEILING_CHECK.paperSpread + CEILING_CHECK.assumedInflation
      : CEILING_CHECK.tijoloSpread);
  if (!(requiredYield > 0)) return null;
  const calculated = income12m / requiredYield;
  // 6 casas: o ponto flutuante não pode empurrar um 10% exato para 10,000000000000002%.
  const divergence = Math.round((calculated / ceiling - 1) * 1_000_000) / 1_000_000;
  if (Math.abs(divergence) <= CEILING_CHECK.limit) return null;
  return { calculated, divergence, requiredYield, ntnbRealRate, paper };
}

/** "1,0 p.p." a partir de uma fração. */
const pointsOf = (fraction: number) => `${(fraction * 100).toFixed(1).replace(".", ",")} p.p.`;

/** O texto do aviso (tooltip e folha do celular). `ceiling` é o teto da Suno. */
export function ceilingCheckMessage(check: CeilingCheck, ceiling: number): string {
  const rate = `NTN-B ${formatPercent(check.ntnbRealRate, 2)}`;
  const premium = check.paper
    ? `${rate} + IPCA ${formatPercent(CEILING_CHECK.assumedInflation, 1)} + ${pointsOf(CEILING_CHECK.paperSpread)}`
    : `${rate} + ${pointsOf(CEILING_CHECK.tijoloSpread)}`;
  return (
    `Teto da Suno ${formatBRL(ceiling)}; calculado ${formatBRL(check.calculated)} ` +
    `(${formatSignedPercent(check.divergence, 0)}). ` +
    `Proventos de 12 meses ÷ (${premium}). Confira o teto.`
  );
}
