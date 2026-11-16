import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  AssetFiscalPosition,
  FiscalClass,
  FiscalFlagCode,
  FiscalYearReport,
  TaxNarrativesView,
} from "./types";

// Os textos do Gemini no relatório de IR (spec 2026-11-16-relatorio-ir-design.md §6). Puro: monta o
// prompt, valida a resposta e decide o que a tela mostra. O modelo só reescreve texto: nenhum
// número dele entra no relatório. A discriminação de cada posição só vale se tiver exatamente os
// números do texto de modelo fixo; a narrativa de cada tipo de achado não pode ter dígito algum.

/** Sobe quando o prompt ou as regras mudam: os textos guardados deixam de valer e a chave muda. */
export const NARRATIVE_VERSION = 1;

export const NARRATIVE_LIMITS = { position: 600, code: 300 } as const;

/**
 * O que cada tipo de achado significa, em texto fixo, sem ticker, mês nem valor: é tudo o que o
 * Gemini recebe dos achados. Sem dígito, para o modelo não ter número para copiar.
 */
export const FINDING_DESCRIPTIONS: Record<FiscalFlagCode, string> = {
  CNPJ_AUSENTE:
    "Ativo sem o CNPJ do emissor identificado; a ficha Bens e Direitos e o agrupamento dos proventos exigem o CNPJ.",
  PRECO_ESTIMADO:
    "Compra com preço estimado, que não veio de uma nota de negociação; o custo de aquisição desse ativo é uma estimativa.",
  POSICAO_ANTERIOR:
    "Posição que já existia antes do primeiro extrato da bolsa, sem data nem preço de compra conhecidos; o custo vem de uma estimativa.",
  SALDO_PREJUIZO_NAO_INFORMADO:
    "O saldo de prejuízo acumulado de períodos anteriores não foi informado; a compensação de prejuízo na apuração pode estar errada.",
  PROVENTO_REEMBOLSO:
    "Reembolso de provento (por exemplo, de empréstimo de ativos), que não tem ficha própria e ficou fora das fichas até ser conferido.",
  PROVENTO_NAO_CLASSIFICADO:
    "Provento de um tipo que o programa não conseguiu enquadrar em nenhuma ficha da declaração.",
  ALUGUEL_NAO_CLASSIFICADO:
    "Rendimento de aluguel (empréstimo) de ativos que não foi enquadrado em nenhuma ficha da declaração.",
  RETENCAO_DIVIDENDO_POSSIVEL:
    "Dividendos de uma mesma fonte pagadora acima do limite mensal da regra nova de retenção na fonte; confira o valor retido no informe de rendimentos.",
  JCP_FORA_DA_FAIXA:
    "Juros sobre capital próprio cujo valor líquido não corresponde à retenção esperada; confira com o informe de rendimentos.",
  DAY_TRADE_NAO_APURADO:
    "Compra e venda do mesmo ativo no mesmo dia (day trade), que o Koinos ainda não apura; esse imposto deve ser conferido à parte e pode afetar os números do swing trade do mês.",
  VENDA_ACIMA_ISENCAO:
    "Vendas de ações no mês acima do limite de isenção mensal, o que torna o lucro do mês tributável e gera DARF.",
};

export type NarrativeResult = { ok: true } | { ok: false; rule: string };

const ACCENTED = /[À-ÿ]/;
const NUMBER = /\d[\d.,]*/g;

/** Os tokens numéricos do texto, sem a pontuação que termina a frase ("11,025." vira "11,025"). */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(NUMBER)].map((m) => m[0].replace(/[.,]+$/, ""));
}

/**
 * A reescrita da discriminação de uma posição: vale se tiver os números do texto de modelo fixo
 * (`reference`), todos e só eles, na mesma ordem e com a mesma repetição (quantidade, CNPJ, custo
 * total, preço médio). Recusa vazio, mais de 600 caracteres e texto sem acentos
 * quando a referência tem (o Flash-Lite às vezes os perde).
 */
export function acceptRewrite(candidate: string, reference: string): NarrativeResult {
  const text = candidate.trim();
  if (!text) return { ok: false, rule: "vazio" };
  if (text.length > NARRATIVE_LIMITS.position) return { ok: false, rule: "longo" };
  if (ACCENTED.test(reference) && !ACCENTED.test(text)) return { ok: false, rule: "sem-acento" };
  const expected = numbersIn(reference);
  const actual = numbersIn(text);
  const allowed = new Set(expected);
  const found = new Set(actual);
  if ([...found].some((n) => !allowed.has(n))) return { ok: false, rule: "numero-extra" };
  if ([...allowed].some((n) => !found.has(n))) return { ok: false, rule: "numero-faltando" };
  // Mesmos números, mas a sequência difere (total e preço médio trocados, número repetido).
  if (actual.length !== expected.length || actual.some((n, i) => n !== expected[i])) {
    return { ok: false, rule: "numero-fora-de-ordem" };
  }
  return { ok: true };
}

/** A narrativa de um tipo de achado: sem dígito algum, até 300 caracteres, com acentos. */
export function acceptCodeNarrative(candidate: string): NarrativeResult {
  const text = candidate.trim();
  if (!text) return { ok: false, rule: "vazio" };
  if (text.length > NARRATIVE_LIMITS.code) return { ok: false, rule: "longo" };
  if (/\d/.test(text)) return { ok: false, rule: "digito" };
  if (!ACCENTED.test(text)) return { ok: false, rule: "sem-acento" };
  return { ok: true };
}

/** As posições com texto de modelo fixo (as que o Gemini pode reescrever), por ticker. */
export function narrativeReferences(positions: readonly AssetFiscalPosition[]) {
  const references: Record<string, string> = {};
  for (const p of positions) {
    if (p.discrimination && !p.closedInYear) references[p.ticker] = p.discrimination;
  }
  return references;
}

/** Os códigos distintos dos achados do ano, em ordem. */
export function narrativeCodes(report: Pick<FiscalYearReport, "findings">): FiscalFlagCode[] {
  return [...new Set(report.findings.map((f) => f.code))].sort();
}

/** A chave dos dados: muda quando uma referência, um código ou a versão das regras muda. */
export function narrativeKey(
  references: Readonly<Record<string, string>>,
  codes: readonly FiscalFlagCode[],
): string {
  const payload = {
    version: NARRATIVE_VERSION,
    references: Object.entries(references).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    codes: [...codes].sort(),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export type NarrativePromptInput = {
  positions: readonly { ticker: string; assetClass: FiscalClass; reference: string }[];
  codes: readonly FiscalFlagCode[];
};

/**
 * O prompt. Por posição: ticker, classe e o texto de modelo fixo (quantidade, custo total, preço
 * médio, CNPJ e razão social já estão nele). Dos achados: só os códigos distintos, com a descrição
 * fixa. Nunca id de carteira, e-mail, total da carteira, proventos nem apuração.
 */
export function buildNarrativePrompt({ positions, codes }: NarrativePromptInput): string {
  const lines = positions.map(
    (p) =>
      `- ${p.ticker} (${p.assetClass === "FII" ? "fundo imobiliário" : "ação"}): ${p.reference}`,
  );
  const findings = codes.map((code) => `- ${code}: ${FINDING_DESCRIPTIONS[code]}`);
  return [
    "Você ajuda um investidor brasileiro a preencher a declaração de Imposto de Renda. Escreva em português do Brasil, com acentos, em linguagem clara e sem jargão.",
    "",
    "Tarefa 1 (positions): reescreva cada texto de posição abaixo como uma discriminação clara para o campo da ficha Bens e Direitos. Copie todos os números exatamente como estão (quantidade, CNPJ, valores e preço médio) e não acrescente nenhum número novo. Até 600 caracteres por texto.",
    "Tarefa 2 (codeNarratives): para cada tipo de achado abaixo, escreva uma explicação curta (até 300 caracteres) do que ele significa e do que o investidor deve conferir. Não escreva nenhum dígito, nenhum ticker e nenhum valor nessas explicações. Não dê recomendação de investimento.",
    "Responda somente com o JSON do esquema, usando exatamente os tickers e os códigos recebidos.",
    "",
    "<dados>",
    "<posicoes>",
    ...lines,
    "</posicoes>",
    "<achados>",
    ...findings,
    "</achados>",
    "</dados>",
  ].join("\n");
}

const textItem = (key: "ticker" | "code") => ({
  type: "object",
  properties: { [key]: { type: "string" }, text: { type: "string" } },
  required: [key, "text"],
  additionalProperties: false,
});

/** O esquema da resposta (`responseJsonSchema`), com as chaves nesta ordem. */
export const narrativeSchema = {
  type: "object",
  properties: {
    positions: { type: "array", items: textItem("ticker") },
    codeNarratives: { type: "array", items: textItem("code") },
  },
  required: ["positions", "codeNarratives"],
  additionalProperties: false,
};

const responseSchema = z.object({
  positions: z.array(z.object({ ticker: z.string(), text: z.string() })),
  codeNarratives: z.array(z.object({ code: z.string(), text: z.string() })),
});

export type ParsedNarratives = {
  positions: Record<string, string>;
  codes: Record<string, string>;
  accepted: number;
  rejected: number;
  /** Recusas por regra (kebab-case): o log e o span levam só isto, nunca o texto do modelo. */
  rejections: Record<string, number>;
};

/**
 * A resposta do modelo (JSON em texto) validada contra as referências e os códigos enviados:
 * devolve só os textos aceitos e conta as recusas por regra. JSON cortado ou fora do formato
 * recusa tudo com `json-invalido`. A primeira ocorrência de cada ticker ou código vale.
 */
export function parseNarratives(
  json: string,
  references: Readonly<Record<string, string>>,
  codes: readonly FiscalFlagCode[],
): ParsedNarratives {
  const out: ParsedNarratives = {
    positions: {},
    codes: {},
    accepted: 0,
    rejected: 0,
    rejections: {},
  };
  const reject = (rule: string) => {
    out.rejected += 1;
    out.rejections[rule] = (out.rejections[rule] ?? 0) + 1;
  };
  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(json));
  } catch {
    reject("json-invalido");
    return out;
  }
  for (const { ticker, text } of parsed.positions) {
    const reference = references[ticker];
    if (reference === undefined) reject("ticker-desconhecido");
    else if (ticker in out.positions) reject("duplicado");
    else {
      const verdict = acceptRewrite(text, reference);
      if (verdict.ok) {
        out.positions[ticker] = text.trim();
        out.accepted += 1;
      } else reject(verdict.rule);
    }
  }
  for (const { code, text } of parsed.codeNarratives) {
    if (!(codes as readonly string[]).includes(code)) reject("codigo-desconhecido");
    else if (code in out.codes) reject("duplicado");
    else {
      const verdict = acceptCodeNarrative(text);
      if (verdict.ok) {
        out.codes[code] = text.trim();
        out.accepted += 1;
      } else reject(verdict.rule);
    }
  }
  return out;
}

/** Os textos de posição guardados que ainda valem: o ticker existe e o texto passa contra a referência atual. */
export function validPositionTexts(
  stored: Readonly<Record<string, string>>,
  references: Readonly<Record<string, string>>,
): Record<string, string> {
  const valid: Record<string, string> = {};
  for (const [ticker, text] of Object.entries(stored)) {
    const reference = references[ticker];
    if (reference !== undefined && acceptRewrite(text, reference).ok) valid[ticker] = text;
  }
  return valid;
}

export type StoredNarratives = {
  key: string | null;
  status: "ok" | "failed";
  positions: Readonly<Record<string, string>>;
  codes: Readonly<Record<string, string>>;
};

/**
 * Todo ticker e todo código enviados têm texto aceito (e ainda válido) nos textos guardados? Texto
 * guardado de ticker ou código que saiu não atrapalha. Sem nada a gerar, está completo.
 */
export function narrativesComplete(
  inputs: {
    references: Readonly<Record<string, string>>;
    codes: readonly FiscalFlagCode[];
  },
  stored: Pick<StoredNarratives, "positions" | "codes"> | null,
): boolean {
  const positions = validPositionTexts(stored?.positions ?? {}, inputs.references);
  const hasAllPositions = Object.keys(inputs.references).every((t) => t in positions);
  const hasAllCodes = inputs.codes.every((c) => {
    const text = stored?.codes[c];
    return text !== undefined && acceptCodeNarrative(text).ok;
  });
  return hasAllPositions && hasAllCodes;
}

/** O que a tela mostra dos textos guardados: só os que ainda valem, e se os dados mudaram desde então. */
export function narrativesView(
  stored: StoredNarratives | null,
  references: Readonly<Record<string, string>>,
  codes: readonly FiscalFlagCode[],
): TaxNarrativesView {
  if (!stored) return { status: "none", positions: {}, codes: {}, stale: false };
  const validCodes: Record<string, string> = {};
  for (const [code, text] of Object.entries(stored.codes)) {
    if ((codes as readonly string[]).includes(code) && acceptCodeNarrative(text).ok) {
      validCodes[code] = text;
    }
  }
  return {
    status: stored.status,
    positions: validPositionTexts(stored.positions, references),
    codes: validCodes,
    stale: stored.key !== null && stored.key !== narrativeKey(references, codes),
  };
}
