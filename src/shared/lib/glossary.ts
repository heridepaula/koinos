// Glossário do mercado (spec 2026-11-13-noticias-e-cenario-design.md, "Glossário e tooltips"):
// os textos da IA podem usar estes termos, e a tela mostra o significado num tooltip. Termo fora
// daqui continua proibido na validação do Radar. Puro: serve ao domínio e à tela.

export type GlossaryScope = "FII" | "ACAO" | "cenario" | "geral";
export type GlossaryClass = "FII" | "ACAO";

export type GlossaryEntry = {
  id: string;
  /** Como o termo aparece nos textos. */
  term: string;
  /** Outras grafias aceitas (a busca ignora acento e caixa). */
  aliases: readonly string[];
  scope: GlossaryScope;
  /** Aparece em quase todo texto: ganha tooltip, mas não conta no limite de termos do Radar. */
  common?: boolean;
  /** Até 200 caracteres, para leigos. */
  definition: string;
};

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "pvp",
    term: "P/VP",
    aliases: ["preço sobre valor patrimonial"],
    scope: "geral",
    definition:
      "Compara o preço na bolsa com o valor do que o ativo tem no balanço. Abaixo de 1, a bolsa paga menos do que ele vale no papel; acima de 1, paga mais.",
  },
  {
    id: "valor-patrimonial",
    term: "valor patrimonial",
    aliases: ["VP"],
    scope: "geral",
    definition:
      "Quanto valem, no balanço, os bens do fundo ou da empresa, descontadas as dívidas, dividido pelo número de cotas ou ações.",
  },
  {
    id: "dividend-yield",
    term: "dividend yield",
    aliases: ["DY"],
    scope: "geral",
    definition:
      "Quanto o ativo pagou de proventos em 12 meses, comparado ao preço de hoje. Um DY de 10% quer dizer R$ 10 por ano para cada R$ 100 investidos.",
  },
  {
    id: "proventos",
    term: "proventos",
    aliases: [],
    scope: "geral",
    common: true,
    definition:
      "Todo dinheiro que o fundo ou a empresa repassa a quem tem cotas ou ações: rendimentos, dividendos e JCP.",
  },
  {
    id: "rendimentos",
    term: "rendimentos",
    aliases: ["rendimento"],
    scope: "FII",
    common: true,
    definition:
      "O dinheiro que o FII distribui, em geral todo mês, vindo dos aluguéis ou dos juros dos títulos que ele tem. Para pessoa física, é isento de imposto de renda.",
  },
  {
    id: "cota",
    term: "cota",
    aliases: ["cotas"],
    scope: "FII",
    common: true,
    definition:
      'A "fatia" de um fundo. Quem compra cotas vira dono de uma parte do fundo e recebe rendimentos na proporção.',
  },
  {
    id: "vacancia",
    term: "vacância",
    aliases: ["vacância física"],
    scope: "FII",
    definition:
      "A parte dos imóveis do fundo que está sem inquilino. Imóvel vazio não paga aluguel.",
  },
  {
    id: "fundo-tijolo",
    term: "fundo de tijolo",
    aliases: ["fundos de tijolo"],
    scope: "FII",
    definition:
      "FII que é dono de imóveis de verdade (galpões, shoppings, escritórios) e vive do aluguel.",
  },
  {
    id: "fundo-papel",
    term: "fundo de papel",
    aliases: ["fundos de papel"],
    scope: "FII",
    definition:
      "FII que empresta dinheiro ao mercado imobiliário, comprando títulos como os CRIs, e vive dos juros.",
  },
  {
    id: "cri",
    term: "CRI",
    aliases: ["CRIs"],
    scope: "FII",
    definition:
      "Certificado de Recebíveis Imobiliários: um título de dívida ligado a imóveis. Quem compra empresta dinheiro e recebe juros.",
  },
  {
    id: "cap-rate",
    term: "cap rate",
    aliases: [],
    scope: "FII",
    definition:
      "O aluguel de um ano comparado ao valor dos imóveis. Mostra quanto o imóvel rende por si só.",
  },
  {
    id: "ffo",
    term: "FFO",
    aliases: ["FFO yield"],
    scope: "FII",
    definition:
      "O caixa que o fundo gerou com a operação, sem contar ganhos ou perdas na venda de imóveis.",
  },
  {
    id: "emissao",
    term: "emissão de cotas",
    aliases: ["emissão", "subscrição"],
    scope: "FII",
    definition:
      "Quando o fundo cria cotas novas para captar dinheiro e comprar mais ativos. Quem já tem cotas costuma ter preferência para comprar.",
  },
  {
    id: "inadimplencia",
    term: "inadimplência",
    aliases: [],
    scope: "FII",
    definition:
      "Quando quem deve (um inquilino ou o devedor de um título) atrasa ou deixa de pagar.",
  },
  {
    id: "dividendos",
    term: "dividendos",
    aliases: ["dividendo"],
    scope: "ACAO",
    common: true,
    definition:
      "Parte do lucro que a empresa distribui aos acionistas. Para pessoa física, hoje é isento de imposto de renda.",
  },
  {
    id: "jcp",
    term: "JCP",
    aliases: ["juros sobre capital próprio"],
    scope: "ACAO",
    definition:
      "Outra forma de a empresa repassar lucro aos acionistas. Tem 15% de imposto retido na fonte.",
  },
  {
    id: "lucro-liquido",
    term: "lucro líquido",
    aliases: [],
    scope: "ACAO",
    definition:
      "O que sobra para a empresa depois de pagar todos os custos, despesas, juros e impostos.",
  },
  {
    id: "margem-liquida",
    term: "margem líquida",
    aliases: [],
    scope: "ACAO",
    definition:
      "Quanto do que a empresa vende vira lucro no fim. Margem de 10% quer dizer R$ 10 de lucro a cada R$ 100 vendidos.",
  },
  {
    id: "roe",
    term: "ROE",
    aliases: ["retorno sobre o patrimônio"],
    scope: "ACAO",
    definition: "Quanto o dinheiro dos sócios rendeu dentro da empresa em um ano.",
  },
  {
    id: "pl",
    term: "P/L",
    aliases: ["preço sobre lucro"],
    scope: "ACAO",
    definition: "Quantos anos de lucro, do jeito que está hoje, pagariam o preço da ação.",
  },
  {
    id: "divida-liquida",
    term: "dívida líquida",
    aliases: ["endividamento"],
    scope: "ACAO",
    definition: "O que a empresa deve, descontado o dinheiro que ela tem em caixa.",
  },
  {
    id: "balanco",
    term: "balanço",
    aliases: ["resultado trimestral"],
    scope: "ACAO",
    definition:
      "O relatório que a empresa publica a cada três meses com receitas, lucro, dívida e caixa.",
  },
  {
    id: "fato-relevante",
    term: "fato relevante",
    aliases: [],
    scope: "geral",
    definition:
      "Comunicado oficial que a empresa ou o fundo é obrigado a publicar quando algo pode mexer com o preço.",
  },
  {
    id: "ibovespa",
    term: "Ibovespa",
    aliases: ["Ibov"],
    scope: "cenario",
    definition: "O principal índice da bolsa brasileira: a média das ações mais negociadas.",
  },
  {
    id: "ifix",
    term: "IFIX",
    aliases: [],
    scope: "cenario",
    definition: "O índice dos fundos imobiliários: a média dos FIIs mais negociados.",
  },
  {
    id: "selic",
    term: "Selic",
    aliases: ["taxa Selic", "juros básicos"],
    scope: "cenario",
    definition:
      "A taxa básica de juros do país, definida pelo Banco Central. Juros altos costumam pesar sobre o preço das ações e dos FIIs de tijolo.",
  },
  {
    id: "copom",
    term: "Copom",
    aliases: [],
    scope: "cenario",
    definition: "O comitê do Banco Central que se reúne a cada 45 dias para decidir a Selic.",
  },
  {
    id: "ipca",
    term: "IPCA",
    aliases: ["inflação oficial"],
    scope: "cenario",
    definition:
      "O índice oficial de inflação do Brasil. Muitos CRIs e aluguéis são corrigidos por ele.",
  },
  {
    id: "curva-juros",
    term: "curva de juros",
    aliases: ["juros futuros"],
    scope: "cenario",
    definition:
      "Os juros que o mercado cobra hoje para emprestar por prazos longos. Sobe quando cresce a desconfiança nas contas do governo.",
  },
  {
    id: "arcabouco",
    term: "arcabouço fiscal",
    aliases: ["regra fiscal"],
    scope: "cenario",
    definition:
      "A regra que limita quanto o governo pode gastar. Mudanças nela mexem com a confiança e com os juros.",
  },
  {
    id: "tesouro-ipca",
    term: "Tesouro IPCA+",
    aliases: ["NTN-B"],
    scope: "cenario",
    definition:
      "Título do governo que paga a inflação mais um juro fixo. É a régua para saber se um FII paga bem pelo risco que tem.",
  },
  {
    id: "volatilidade",
    term: "volatilidade",
    aliases: [],
    scope: "geral",
    definition: "O quanto o preço sobe e desce em pouco tempo.",
  },
  {
    id: "realizacao",
    term: "realização de lucros",
    aliases: [],
    scope: "geral",
    definition:
      "Quando muita gente vende depois de uma alta para garantir o ganho, e o preço cai mesmo sem notícia ruim.",
  },
  {
    id: "meta-carteira",
    term: "meta",
    aliases: ["% meta"],
    scope: "geral",
    common: true,
    definition:
      "Quanto este ativo deveria pesar na sua carteira, pela % sugerida que você definiu na Carteira Alvo. Abaixo da meta, o método compra mais dele.",
  },
  {
    id: "teto-metodo",
    term: "teto",
    aliases: ["preço teto"],
    scope: "geral",
    common: true,
    definition:
      "O preço máximo que o método aceita pagar, cadastrado na sua Carteira Alvo. No teto ou acima dele, o ativo não recebe aporte.",
  },
  {
    id: "lista-metodo",
    term: "lista do método",
    aliases: ["ranking"],
    scope: "geral",
    common: true,
    definition:
      "A ordem de preferência dos ativos na sua Carteira Alvo (o rank). O método atende primeiro os mais bem colocados.",
  },
];

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

export const glossaryEntry = (id: string): GlossaryEntry | undefined => BY_ID.get(id);

export type GlossarySegment =
  { kind: "text"; value: string } | { kind: "term"; value: string; id: string };

const foldChar = (char: string) => char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const fold = (text: string) => [...text].map(foldChar).join("");
const isWord = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** O texto sem acento e sem caixa, com o índice original de cada unidade do texto dobrado. */
function folded(text: string): { value: string; origin: number[] } {
  let value = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const piece = foldChar(text[i]);
    for (let k = 0; k < piece.length; k++) origin.push(i);
    value += piece;
  }
  return { value, origin };
}

const inScope = (entry: GlossaryEntry, cls: GlossaryClass | null) =>
  cls === null || entry.scope === "geral" || entry.scope === "cenario" || entry.scope === cls;

/** Os apelidos do escopo, dobrados, do mais longo ao mais curto. */
function aliasesFor(cls: GlossaryClass | null) {
  return GLOSSARY.filter((entry) => inScope(entry, cls))
    .flatMap((entry) =>
      [entry.term, ...entry.aliases].map((alias) => ({ alias: fold(alias), id: entry.id })),
    )
    .sort((a, b) => b.alias.length - a.alias.length);
}

/** Todas as ocorrências (início e fim no texto original), sem sobreposição. */
function matches(text: string, cls: GlossaryClass | null) {
  const { value, origin } = folded(text);
  const aliases = aliasesFor(cls);
  const found: { start: number; end: number; id: string }[] = [];
  let i = 0;
  while (i < value.length) {
    if (isWord(value[i - 1])) {
      i += 1;
      continue;
    }
    const hit = aliases.find(
      ({ alias }) => value.startsWith(alias, i) && !isWord(value[i + alias.length]),
    );
    if (!hit) {
      i += 1;
      continue;
    }
    const end = i + hit.alias.length;
    found.push({ start: origin[i], end: origin[end - 1] + 1, id: hit.id });
    i = end;
  }
  return found;
}

/**
 * O texto em pedaços: os termos do glossário (só a primeira ocorrência de cada um, só do escopo
 * da classe; null aceita todos) e o resto como texto. Juntar os `value` devolve o texto.
 */
export function glossarySegments(text: string, cls: GlossaryClass | null): GlossarySegment[] {
  const segments: GlossarySegment[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last?.kind === "text") last.value += value;
    else segments.push({ kind: "text", value });
  };
  const seen = new Set<string>();
  let cursor = 0;
  for (const match of matches(text, cls)) {
    pushText(text.slice(cursor, match.start));
    const value = text.slice(match.start, match.end);
    if (seen.has(match.id)) pushText(value);
    else {
      seen.add(match.id);
      segments.push({ kind: "term", value, id: match.id });
    }
    cursor = match.end;
  }
  pushText(text.slice(cursor));
  return segments;
}

/** Os ids dos termos do texto, distintos, na ordem em que aparecem. */
export const glossaryIdsIn = (text: string, cls: GlossaryClass | null): string[] =>
  glossarySegments(text, cls).flatMap((s) => (s.kind === "term" ? [s.id] : []));

/** O texto com cada termo do glossário (todas as ocorrências) trocado por espaços. */
export function stripGlossary(text: string, cls: GlossaryClass | null): string {
  let result = "";
  let cursor = 0;
  for (const match of matches(text, cls)) {
    result += text.slice(cursor, match.start) + " ".repeat(match.end - match.start);
    cursor = match.end;
  }
  return result + text.slice(cursor);
}
