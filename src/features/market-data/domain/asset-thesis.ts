import { formatPercent } from "@/shared/lib/format";
import type { AssetClass } from "./asset-class";
import type { RadarFact, RadarInput, RadarTone } from "./radar";
import { WEEK_SUMMARY, type WeekSummary } from "./week-summary";

// A tese do ativo (spec 2026-11-13-tese-do-ativo-design.md): o porquê do método junto com os
// fundamentos. O código decide as evidências (sinais do método, fatos do Radar com o número, a
// leitura da semana) e o sentido de cada uma; o Gemini escolhe as evidências de cada lente e
// escreve até 3 frases; a validação confere ids e números. Nada da carteira entra. Regras puras.

export const THESIS = {
  version: 2,
  /** Até 5% abaixo do teto (ou de margem): perto do teto. */
  nearCeiling: 0.05,
  /** A partir de 15%: bem abaixo do teto (margem alta). */
  wellBelow: 0.15,
  maxSentences: 3,
  maxChars: 520,
  maxLensChars: 220,
  temperature: 0.2,
  maxOutputTokens: 4096,
  timeoutMs: 8_000,
  regenerateAfterHours: 20,
  retryAfterMinutes: 60,
  weekMaxDays: 7,
} as const;

export type EvidenceGroup = "metodo" | "fundamento" | "semana";
export type EvidenceTone = "favoravel" | "desfavoravel" | "neutro";
/** Uma evidência mandada ao Gemini. `key` é a parte estável (a faixa, sem o número) para a chave. */
export type ThesisEvidence = {
  id: string;
  group: EvidenceGroup;
  text: string;
  tone: EvidenceTone;
  key: string;
};

/** O alvo da Carteira Alvo. `rankCount`: ativos da mesma classe com rank. */
export type ThesisTarget = {
  rank: number | null;
  rankCount: number;
  ceiling: number | null;
  bias: "COMPRAR" | "AGUARDAR" | null;
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const pct0 = (value: number) => formatPercent(value, 0);
const pct1 = (value: number) => formatPercent(value, 1);
const decimal = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "−9%": sinal de menos tipográfico, como no resto do app. */
const signedPct0 = (value: number) => (value < 0 ? `−${pct0(-value)}` : `+${pct0(value)}`);

const method = (id: string, text: string, tone: EvidenceTone, bucket: string): ThesisEvidence => ({
  id,
  group: "metodo",
  text,
  tone,
  key: `${id}:${bucket}`,
});

/**
 * Os sinais do método que não dependem da carteira nem do valor do aporte: o rank, o teto (FII:
 * (teto − preço) ÷ teto, como `marginToCeiling`; ação: teto ÷ preço − 1, como `marginOfSafety`),
 * o viés e o motivo de elegibilidade, na ordem de `eligibilityFailure`.
 */
export function methodSignals(args: {
  kind: AssetClass;
  target: ThesisTarget | null;
  price: number | null;
  suspended: boolean;
}): ThesisEvidence[] {
  const { kind, target, price } = args;
  if (!target) return [];
  const out: ThesisEvidence[] = [];
  const noun = kind === "FII" ? "FIIs" : "ações";
  if (target.rank !== null && target.rankCount > 0) {
    const position = (target.rank - 1) / target.rankCount;
    const [word, tone]: [string, EvidenceTone] =
      position < 1 / 3
        ? ["entre os primeiros", "favoravel"]
        : position < 2 / 3
          ? ["no meio", "neutro"]
          : ["entre os últimos", "neutro"];
    out.push(
      method(
        "metodo-rank",
        `${target.rank}º do ranking de ${target.rankCount} ${noun} (${word})`,
        tone,
        word,
      ),
    );
  }
  const priced = price !== null && price > 0;
  if (priced && target.ceiling !== null) {
    const id = kind === "FII" ? "metodo-teto" : "metodo-margem";
    if (price >= target.ceiling) {
      out.push(
        method(
          id,
          `preço ${pct0(price / target.ceiling - 1)} acima do teto do método`,
          "desfavoravel",
          "acima",
        ),
      );
    } else {
      const margin =
        kind === "FII" ? (target.ceiling - price) / target.ceiling : target.ceiling / price - 1;
      const level =
        margin < THESIS.nearCeiling ? "perto" : margin < THESIS.wellBelow ? "abaixo" : "bem-abaixo";
      const tone: EvidenceTone = level === "perto" ? "neutro" : "favoravel";
      const text =
        kind === "FII"
          ? `preço ${pct0(margin)} abaixo do teto do método (${{ perto: "perto do teto", abaixo: "abaixo do teto", "bem-abaixo": "bem abaixo do teto" }[level]})`
          : `margem de segurança de ${pct0(margin)} até o teto do método (${{ perto: "baixa", abaixo: "boa", "bem-abaixo": "alta" }[level]})`;
      out.push(method(id, text, tone, level));
    }
  }
  if (target.bias === "COMPRAR") {
    out.push(method("metodo-vies", "viés Comprar no método", "favoravel", "comprar"));
  } else if (target.bias === "AGUARDAR") {
    out.push(method("metodo-vies", "viés Aguardar no método", "desfavoravel", "aguardar"));
  }
  const reason = !priced
    ? null
    : target.rank === null
      ? "o ativo não tem posição no ranking"
      : target.ceiling === null
        ? "o método não tem preço teto para o ativo"
        : price >= target.ceiling
          ? "o preço chegou ao teto do método"
          : target.bias === "AGUARDAR"
            ? "o método marcou Aguardar"
            : kind === "FII" && args.suspended
              ? "o fundo parou de pagar rendimentos"
              : null;
  if (reason) {
    out.push(method("metodo-fora", `fora da fila de compra: ${reason}`, "desfavoravel", reason));
  }
  return out;
}

/** O número que acompanha o fato (pelo id), ou null quando o fato não tem número. */
export function factNumber(fact: Pick<RadarFact, "id">, input: RadarInput): string | null {
  const id = fact.id;
  if (id.startsWith("preco-") && id.endsWith("-mes") && input.monthChange !== null) {
    return `${signedPct0(input.monthChange)} no mês`;
  }
  if (id.startsWith("preco-") && id.endsWith("-ano") && input.yearChange !== null) {
    return `${signedPct0(input.yearChange)} em 12 meses`;
  }
  if (input.kind === "FII") {
    if (id.startsWith("pvp-") && input.pvp !== null) return `P/VP de ${decimal(input.pvp)}`;
    if (id === "provento-menor" && input.dividendRatio !== null) {
      return `último pagamento ${pct0(input.dividendRatio)} da média de 12 meses`;
    }
    if ((id.startsWith("dy-") || id === "premio-negativo") && input.dy12m !== null) {
      return `DY de ${pct1(input.dy12m)} em 12 meses`;
    }
    if (id.startsWith("vacancia-") && input.vacancy !== null)
      return `vacância de ${pct1(input.vacancy)}`;
    return null;
  }
  const ind = input.indicators;
  if (id.startsWith("margem-") && ind?.netMargin != null)
    return `margem líquida de ${pct1(ind.netMargin)}`;
  if (id.startsWith("roe-") && ind?.roe != null) return `ROE de ${pct1(ind.roe)}`;
  if (id.startsWith("divida-") && ind?.netDebtToEquity != null) {
    return `dívida líquida de ${decimal(ind.netDebtToEquity)} vez o patrimônio`;
  }
  if (id === "receita-cresceu" && ind?.revenueGrowth5y != null) {
    return `receita ${pct0(ind.revenueGrowth5y)} maior que há cinco anos`;
  }
  if (id === "receita-caiu" && ind?.revenueGrowth5y != null) {
    return `receita ${pct0(-ind.revenueGrowth5y)} menor que há cinco anos`;
  }
  if (id.startsWith("pvp-banco-") && ind?.pvp != null) return `P/VP de ${decimal(ind.pvp)}`;
  if (id === "dividendos-bons" && input.dy12m !== null)
    return `DY de ${pct1(input.dy12m)} em 12 meses`;
  return null;
}

const TONE: Record<RadarTone, EvidenceTone> = {
  good: "favoravel",
  bad: "desfavoravel",
  neutral: "neutro",
};

/** O veredito da leitura da semana (a primeira frase), só da versão atual e com até 7 dias. */
export function weekEvidence(
  week: WeekSummary | null | undefined,
  now: Date,
): ThesisEvidence | null {
  if (!week || week.status !== "ok" || !week.text || week.version !== WEEK_SUMMARY.version)
    return null;
  if (
    !week.generatedAt ||
    now.getTime() - week.generatedAt.getTime() > THESIS.weekMaxDays * DAY_MS
  ) {
    return null;
  }
  const first = week.text.split(/(?<=[.!?])\s+/)[0] ?? week.text;
  const tone: EvidenceTone =
    week.tone === "favoravel" || week.tone === "desfavoravel" ? week.tone : "neutro";
  return { id: "semana", group: "semana", text: first, tone, key: `semana:${tone}` };
}

/** As evidências do prompt: método, fundamentos (com o número) e semana, nesta ordem. */
export function thesisEvidence(args: {
  kind: AssetClass;
  target: ThesisTarget | null;
  price: number | null;
  input: RadarInput;
  facts: readonly RadarFact[];
  week: WeekSummary | null | undefined;
  now: Date;
}): ThesisEvidence[] {
  const suspended = args.input.kind === "FII" && args.input.suspended;
  const signals = methodSignals({
    kind: args.kind,
    target: args.target,
    price: args.price,
    suspended,
  });
  const fundamentals = args.facts.map((fact): ThesisEvidence => {
    const number = factNumber(fact, args.input);
    return {
      id: fact.id,
      group: "fundamento",
      text: number ? `${fact.text} (${number})` : fact.text,
      tone: TONE[fact.tone],
      key: fact.id,
    };
  });
  const week = weekEvidence(args.week, args.now);
  return [...signals, ...fundamentals, ...(week ? [week] : [])];
}

/** A chave da tese: as faixas das evidências, sem os números (um preço que oscila não refaz). */
export const thesisKey = (evidence: readonly ThesisEvidence[]) =>
  evidence.map((e) => e.key).join("|");

export type StoredThesisMeta = {
  version?: number;
  factsKey: string;
  status: "ok" | "failed";
  generatedAt: Date;
};

/**
 * Refaz: sem tese; uma v1 após 60 min; chave nova na hora; uma falha após 60 min; e uma ok igual
 * após 20 h, porque o texto tem números (a % até o teto muda com o preço).
 */
export function needsThesis(stored: StoredThesisMeta | null, key: string, now: Date): boolean {
  if (!stored) return true;
  const age = now.getTime() - stored.generatedAt.getTime();
  if ((stored.version ?? 1) < THESIS.version) return age >= THESIS.retryAfterMinutes * MINUTE_MS;
  if (stored.factsKey !== key) return true;
  if (stored.status === "failed") return age >= THESIS.retryAfterMinutes * MINUTE_MS;
  return age >= THESIS.regenerateAfterHours * 60 * MINUTE_MS;
}
