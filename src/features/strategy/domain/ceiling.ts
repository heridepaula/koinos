import { formatBRL, formatPercent, formatSignedPercent } from "@/shared/lib/format";

/** (teto − preço) / teto: positivo = abaixo do teto (margem de segurança). */
export function marginToCeiling(ceiling: number | null, price: number | null): number | null {
  if (ceiling === null || price === null || ceiling <= 0) return null;
  return (ceiling - price) / ceiling;
}

/** O maior teto aceito, em R$ (o mesmo limite do schema da action). */
export const CEILING_MAX = 1_000_000;

/**
 * O teto como sai do campo com máscara de moeda: em branco ou 0,00 é "sem teto" (null), e acima do
 * máximo é recusado com a mensagem. Devolve o valor a salvar ou o problema.
 */
export function ceilingFromInput(typed: number | null): {
  value: number | null;
  problem: string | null;
} {
  if (typed === null || typed === 0) return { value: null, problem: null };
  if (typed > CEILING_MAX) {
    return { value: null, problem: `O teto deve ser de até ${formatBRL(CEILING_MAX)}.` };
  }
  return { value: typed, problem: null };
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
  /** Há aviso quando |teto calculado ÷ teto do ranking − 1| passa disto. */
  limit: 0.1,
} as const;

/** O teto calculado de um FII cujo teto do ranking está fora do limite. Frações, exceto os preços. */
export type CeilingCheck = {
  /** Teto calculado, em R$ por cota. */
  calculated: number;
  /** calculado ÷ teto do ranking − 1, com 6 casas. Positivo: o teto do ranking está abaixo do calculado. */
  divergence: number;
  /** Proventos por cota dos 12 meses que entraram na conta. */
  income12m: number;
  /** Rendimento exigido que dividiu a renda. */
  requiredYield: number;
  /** NTN-B real usada (a mediana de 60 pregões). */
  ntnbRealRate: number;
  /** Papel (soma o IPCA assumido) ou tijolo e demais classes. */
  paper: boolean;
};

export type CeilingCheckInput = {
  /** Teto do ranking. */
  ceiling: number | null;
  /** Proventos por cota dos 12 meses; null quando não há ou estão velhos. */
  income12m: number | null;
  paper: boolean;
  /** NTN-B real, em fração (7,675% = 0,07675); null sem dado ou com dado velho. */
  ntnbRealRate: number | null;
};

/**
 * Compara o teto do ranking com o teto calculado: proventos de 12 meses ÷ rendimento exigido. Devolve
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
  return { calculated, divergence, requiredYield, income12m, ntnbRealRate, paper };
}

/** Uma linha de valores do aviso. `tone: "warn"` destaca a linha (o preço já passou do calculado). */
export type CeilingCheckRow = { label: string; value: string; note?: string; tone?: "warn" };

/**
 * O aviso pronto para desenhar (tooltip e folha do celular). Positivo: o teto calculado está ACIMA
 * do ranking (o do ranking é o mais conservador). Negativo: está ABAIXO (o do ranking pode estar alto
 * para a renda atual).
 */
export type CeilingCheckDetails = {
  direction: "positive" | "negative";
  /** A cor do selo: o negativo com o preço ainda abaixo do calculado vira "caution" (amarelo). */
  tone: "positive" | "negative" | "caution";
  badge: "Positivo" | "Negativo" | "Atenção";
  /** A diferença com sinal, em 1 casa: "+29,2%". */
  change: string;
  headline: string;
  rows: CeilingCheckRow[];
  /** A conta: proventos de 12 meses ÷ rendimento exigido, e de onde ele vem. */
  formula: string;
  /** O que a divergência quer dizer e o que conferir. */
  meaning: string;
};

/**
 * A cor do aviso. Positivo é verde. Negativo é vermelho, salvo quando o preço atual ainda está no
 * teto calculado ou abaixo dele: o teto do ranking está alto, mas a compra de hoje cabe no calculado,
 * então é só atenção (amarelo).
 */
export function ceilingCheckTone(
  check: CeilingCheck,
  price: number | null = null,
): "positive" | "negative" | "caution" {
  if (check.divergence > 0) return "positive";
  if (price !== null && Number.isFinite(price) && price > 0 && price <= check.calculated) {
    return "caution";
  }
  return "negative";
}

/** "1,0 p.p." a partir de uma fração. */
const pointsOf = (fraction: number) => `${(fraction * 100).toFixed(1).replace(".", ",")} p.p.`;

/**
 * Monta o texto do aviso. `ceiling` é o teto do ranking; `price` (opcional) é o preço atual, que
 * ganha uma linha dizendo se já passou do teto calculado.
 */
export function ceilingCheckDetails(
  check: CeilingCheck,
  ceiling: number,
  price: number | null = null,
): CeilingCheckDetails {
  const positive = check.divergence > 0;
  const tone = ceilingCheckTone(check, price);
  const rows: CeilingCheckRow[] = [
    { label: "Teto do ranking", value: formatBRL(ceiling) },
    { label: "Teto calculado", value: formatBRL(check.calculated) },
  ];
  if (price !== null && Number.isFinite(price) && price > 0) {
    const row: CeilingCheckRow = { label: "Preço atual", value: formatBRL(price) };
    if (price > check.calculated) {
      row.note = `${formatPercent(price / check.calculated - 1, 1)} acima do teto calculado`;
      row.tone = "warn";
    } else {
      row.note = `margem de ${formatPercent(1 - price / check.calculated, 1)} até o teto calculado`;
    }
    rows.push(row);
  }
  const rate = `NTN-B ${formatPercent(check.ntnbRealRate, 2)}`;
  const premium = check.paper
    ? `${rate} + IPCA ${formatPercent(CEILING_CHECK.assumedInflation, 1)} + ${pointsOf(CEILING_CHECK.paperSpread)}`
    : `${rate} + ${pointsOf(CEILING_CHECK.tijoloSpread)}`;
  return {
    direction: positive ? "positive" : "negative",
    tone,
    badge: tone === "caution" ? "Atenção" : positive ? "Positivo" : "Negativo",
    change: formatSignedPercent(check.divergence, 1),
    headline: positive
      ? "Teto calculado acima do teto do ranking"
      : tone === "caution"
        ? "Teto do ranking acima do calculado, mas o preço atual está abaixo do calculado"
        : "Teto calculado abaixo do teto do ranking",
    rows,
    formula: `Proventos de 12 meses ${formatBRL(check.income12m)} ÷ ${formatPercent(check.requiredYield, 2)} (${premium})`,
    meaning: positive
      ? "A renda atual sustenta um teto maior que o do ranking: o teto do ranking é o mais conservador dos dois. Ele pode estar desatualizado, ou os proventos de 12 meses incluem algum pagamento extraordinário."
      : tone === "caution"
        ? "A renda atual sustenta um teto menor que o do ranking, mas o preço de hoje ainda cabe no teto calculado. Dá para comprar com margem; só não conte com o teto do ranking para os preços mais altos."
        : "A renda atual sustenta um teto menor que o do ranking: comprar perto do teto do ranking pode sair caro. Confira se os proventos caíram ou se o teto do ranking está desatualizado.",
  };
}
