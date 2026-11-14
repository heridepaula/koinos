import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import type { MergedOrder } from "../../domain/merge-orders";
import { RISK_CAPS } from "../../domain/risk";
import type { StockBuyOrder, StockExclusionReason } from "../../domain/stock-buy";
import type { CascadeOrder, ExclusionReason } from "../../domain/fii-cascade";

/** A classe de uma ordem ou de um ativo de fora: FII ou ação. */
export type OrderKind = MergedOrder["kind"];

/** "cota(s)" nos FIIs e "ação(ões)" nas ações, conforme a quantidade. */
export function unitOf(kind: OrderKind, quantity: number): string {
  if (kind === "FII") return quantity === 1 ? "cota" : "cotas";
  return quantity === 1 ? "ação" : "ações";
}

/** O motivo só existe nas ações: o mesmo texto nas três tabelas de ajuda. */
const LESS_THAN_A_LOT_HELP =
  "O que faltava para a meta não chegava a um lote de 100 ações. Pode receber pela sobra, se for a mais abaixo da meta.";

/** O texto de ajuda de cada motivo quando só há FIIs nele. */
export const REASON_HELP: Record<ExclusionReason, string> = {
  ACIMA_DO_TETO: "Preço igual ou acima do teto: a regra é só comprar abaixo dele.",
  AGUARDAR: "Marcado como Aguardar na Carteira Alvo: não recebe aporte.",
  PROVENTO_SUSPENSO:
    "Pagava com regularidade e está há mais de 45 dias sem data ex, ou há mais de um ano sem pagar. Fica fora do aporte até voltar a pagar.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO:
    "Falta pouco para a meta, ou os freios de provento e vacância cortaram o pedido: não chega a uma cota.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  ABAIXO_DO_MINIMO:
    "O pedido não chegava ao mínimo por ordem (aporte ÷ nº de FIIs da estratégia, até 12,5% do aporte). O dinheiro foi para os próximos da fila; no próximo aporte o pedido cresce.",
  LIMITE_ATIVO: `Uma cota custa mais que o limite de ${formatPercent(RISK_CAPS.asset, 0)} do aporte por FII.`,
  LIMITE_SETOR: `O setor já levou ${formatPercent(RISK_CAPS.sector, 0)} do aporte.`,
  LIMITE_MACRO: `Papel ou tijolo já levou ${formatPercent(RISK_CAPS.macro, 0)} do aporte.`,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  SEM_RANKING: "Sem ranking cadastrado na Carteira Alvo.",
  SEM_COTACAO: "Ainda sem cotação.",
};

export const REASON_ORDER: ExclusionReason[] = [
  "SEM_SALDO",
  "LIMITE_SETOR",
  "LIMITE_MACRO",
  "LIMITE_ATIVO",
  "ABAIXO_DO_MINIMO",
  "PEDIDO_PEQUENO",
  "MENOS_DE_UM_LOTE",
  "NA_META",
  "PROVENTO_SUSPENSO",
  "AGUARDAR",
  "ACIMA_DO_TETO",
  "SEM_TETO",
  "SEM_RANKING",
  "SEM_COTACAO",
];

/** Os mesmos motivos quando só há ações neles (as ações não têm os motivos só de FIIs). */
export const STOCK_REASON_HELP: Record<StockExclusionReason, string> = {
  SEM_COTACAO: "Ainda sem cotação.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  ACIMA_DO_TETO: "Preço acima do teto: a regra é só comprar abaixo dele.",
  AGUARDAR: "Marcada como Aguardar na Carteira Alvo: não recebe aporte.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO: "Falta pouco para a meta: não chega a uma ação.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
};

/** Os motivos com FIIs e ações juntos: um texto que serve para as duas classes. */
export const NEUTRAL_REASON_HELP: Record<StockExclusionReason, string> = {
  SEM_COTACAO: "Ainda sem cotação.",
  SEM_TETO: "Sem preço teto cadastrado na Carteira Alvo.",
  ACIMA_DO_TETO:
    "Preço acima do teto (nos FIIs, também igual a ele): a regra é só comprar abaixo dele.",
  AGUARDAR: "Com viés Aguardar na Carteira Alvo: não recebe aporte.",
  NA_META: "Já está na % sugerida (ou passou dela).",
  PEDIDO_PEQUENO:
    "Falta pouco para a meta, ou os freios de provento e vacância dos FIIs cortaram o pedido: não chega a uma cota ou ação.",
  MENOS_DE_UM_LOTE: LESS_THAN_A_LOT_HELP,
  SEM_SALDO: "Está abaixo da meta, mas o valor não alcançou: fica para o próximo aporte.",
};

const isStockReason = (reason: ExclusionReason): reason is StockExclusionReason =>
  Object.hasOwn(STOCK_REASON_HELP, reason);

/**
 * O texto de ajuda de um motivo fala da classe dos ativos que estão nele: só FIIs, só ações ou as
 * duas juntas.
 */
export function reasonHelp(
  reason: ExclusionReason,
  assets: readonly { kind: OrderKind }[],
): string {
  const hasStock = assets.some((asset) => asset.kind === "ACAO");
  if (!hasStock || !isStockReason(reason)) return REASON_HELP[reason];
  const hasFii = assets.some((asset) => asset.kind === "FII");
  return hasFii ? NEUTRAL_REASON_HELP[reason] : STOCK_REASON_HELP[reason];
}

/** Um ativo da estratégia que ficou fora deste aporte, com a sua classe. */
export type ExcludedAsset = { ticker: string; kind: OrderKind };

/**
 * Os de fora das duas carteiras juntos, por motivo: em cada motivo, os FIIs (na ordem da cascata)
 * e depois as ações (na ordem do motor de ações).
 */
export function groupExcluded(
  fii: readonly { ticker: string; reason: ExclusionReason }[],
  stock: readonly { ticker: string; reason: StockExclusionReason }[],
): Map<ExclusionReason, ExcludedAsset[]> {
  const byReason = new Map<ExclusionReason, ExcludedAsset[]>();
  const add = (reason: ExclusionReason, asset: ExcludedAsset) => {
    const assets = byReason.get(reason);
    if (assets) assets.push(asset);
    else byReason.set(reason, [asset]);
  };
  for (const item of fii) add(item.reason, { ticker: item.ticker, kind: "FII" });
  for (const item of stock) add(item.reason, { ticker: item.ticker, kind: "ACAO" });
  return byReason;
}

const onlyLeftover = (order: CascadeOrder) => order.fromLeftover === order.quantity;

function limitText(order: CascadeOrder): string | null {
  switch (order.limitedBy) {
    case "ativo":
      return `limite de ${formatPercent(RISK_CAPS.asset, 0)} do aporte por FII`;
    case "setor":
      return `limite de ${formatPercent(RISK_CAPS.sector, 0)} do aporte em ${order.sector}`;
    case "macro":
      return `limite de ${formatPercent(RISK_CAPS.macro, 0)} do aporte em ${order.macro.toLowerCase()}`;
    case "saldo":
      return "o saldo acabou";
    default:
      return null;
  }
}

/** Os lotes que vieram do passo de sobra (a 3.1); vazio quando a ordem não teve sobra. */
function leftoverText(order: StockBuyOrder): string {
  return order.fromLeftover > 0 ? ` · ${order.fromLeftover / order.lot} lote(s) pela sobra` : "";
}

/** "faltam 5% para a meta", "quase na meta" ou "já na meta". */
function distanceWords(order: CascadeOrder): string {
  const shortfall = 1 - order.fillBefore;
  if (order.gapBefore <= 0) return "já na meta";
  if (shortfall < 0.005) return "quase na meta";
  return `faltam ${formatPercent(shortfall, 0)} para a meta`;
}

/**
 * A linha 1 do "Por quê" (spec por-que-na-tabela §7): a decisão do método em palavras, sem siglas
 * nem tensores. O sinal que mais pesou vem de uma trava, um freio ou do desconto.
 */
export function plainReason(order: CascadeOrder): string {
  if (onlyLeftover(order)) return `Sobra do aporte · ${distanceWords(order)}`;
  const { tensors } = order;
  const parts = [`${order.rank}º na lista do método`, distanceWords(order)];
  if (order.limitedBy === "setor" || order.limitedBy === "macro") {
    parts.push(
      order.limitedBy === "setor" ? "limite do setor" : `limite de ${order.macro.toLowerCase()}`,
    );
  } else if (tensors.dividends < 0.95) {
    parts.push("rendimento caiu");
  } else if (tensors.vacancy < 0.9) {
    parts.push(`vacância de ${formatPercent(order.vacancy ?? 0, 0)}`);
  } else if (order.priceToBook !== null && tensors.valuation >= 1.05) {
    parts.push("desconto no preço");
  } else if (tensors.safety >= 1.1) {
    parts.push("bem abaixo do teto");
  }
  return parts.join(" · ");
}

export type CalcEffect = "mais" | "menos";

/** Uma linha do "Cálculo do Koinos": o rótulo, o valor, o efeito no pedido e o multiplicador. */
export type CalcStep = {
  label: string;
  value: string;
  effect: CalcEffect | null;
  /** "×1,23", para o dono (no `title`); null quando o tensor é neutro. */
  exact: string | null;
  /** O valor traz R$ da carteira: some no modo privacidade. */
  sensitive?: boolean;
};

/** Um pedaço de frase: texto, R$ da carteira (`money`) ou quantidade da carteira (`quantity`). */
export type CalcPart = string | { money: number } | { quantity: number };

/** A frase como texto puro (testes e qualquer uso sem o modo privacidade). */
export function calcText(parts: readonly CalcPart[]): string {
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : "money" in part
          ? formatBRL(part.money)
          : formatQuantity(part.quantity),
    )
    .join("");
}

/** Junta as frases com um espaço, ignorando as nulas. */
const joinSentences = (sentences: readonly (readonly CalcPart[] | null)[]): CalcPart[] =>
  sentences.flatMap((sentence, index) =>
    sentence ? (index > 0 ? [" ", ...sentence] : [...sentence]) : [],
  );

const moved = (tensor: number) => Math.abs(tensor - 1) >= 0.005;
const effectOf = (tensor: number): CalcEffect | null =>
  moved(tensor) ? (tensor > 1 ? "mais" : "menos") : null;
const exactOf = (tensor: number) => (moved(tensor) ? `×${formatQuantity(tensor)}` : null);

/** O cálculo de uma ordem de FII em linhas: posição, distância e cada tensor que mexeu no pedido. */
export function calcSteps(order: CascadeOrder): CalcStep[] {
  const steps: CalcStep[] = [
    { label: "Posição na lista do método", value: `${order.rank}º`, effect: null, exact: null },
    {
      label: "Faltava para a meta",
      value:
        order.gapBefore > 0
          ? `${formatBRL(order.gapBefore)} (${formatPercent(1 - order.fillBefore, 0)})`
          : "já na meta",
      effect: null,
      exact: null,
      sensitive: order.gapBefore > 0,
    },
  ];
  if (order.gapBefore <= 0) return steps;
  const { tensors } = order;
  const step = (label: string, value: string, tensor: number) =>
    steps.push({ label, value, effect: effectOf(tensor), exact: exactOf(tensor) });
  if (order.priceToBook !== null && moved(tensors.valuation)) {
    step(
      "Preço sobre o patrimônio",
      `P/VP ${formatQuantity(order.priceToBook)}`,
      tensors.valuation,
    );
  }
  if (moved(tensors.safety)) {
    step("Margem até o teto", formatPercent(order.marginToCeiling, 0), tensors.safety);
  }
  if (order.dividendRatio !== null && tensors.dividends < 1 && moved(tensors.dividends)) {
    step(
      "Último rendimento",
      `${formatPercent(1 - order.dividendRatio, 0)} abaixo da média de 12 meses`,
      tensors.dividends,
    );
  }
  if (order.macro === "Tijolo" && order.vacancy !== null && moved(tensors.vacancy)) {
    step("Vacância", formatPercent(order.vacancy, 0), tensors.vacancy);
  }
  return steps;
}

/** "a, b e c". */
const listPt = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;

/** A trava como frase; null sem trava. */
function limitSentence(order: CascadeOrder): string | null {
  if (order.limitedBy === "saldo") return "O saldo do aporte acabou antes do pedido.";
  const limit = limitText(order);
  return limit ? `O ${limit} cortou o pedido.` : null;
}

/**
 * A frase que liga a meta ao pedido e à compra (o leitor leigo não entendia "faltava R$ X, pediu
 * R$ Y"): o que aumentou, o que diminuiu, a trava e a sobra.
 */
export function calcSummary(order: CascadeOrder): CalcPart[] {
  const bought: CalcPart[] = [
    { money: order.total },
    ` (`,
    { quantity: order.quantity },
    ` ${unitOf("FII", order.quantity)})`,
  ];
  if (order.gapBefore <= 0) {
    return ["Já estava na meta: comprou ", ...bought, " com a sobra do aporte."];
  }
  const { tensors } = order;
  const up: string[] = [];
  const down: string[] = [];
  if (order.priceToBook !== null && moved(tensors.valuation)) {
    (tensors.valuation > 1 ? up : down).push(
      tensors.valuation > 1 ? "pelo desconto no preço" : "pelo preço acima do patrimônio",
    );
  }
  if (moved(tensors.safety)) up.push("pela margem até o teto");
  if (order.dividendRatio !== null && tensors.dividends < 0.995) down.push("pelo rendimento menor");
  if (order.macro === "Tijolo" && order.vacancy !== null && tensors.vacancy < 0.995) {
    down.push("pela vacância");
  }
  const adjust = [
    up.length ? `mais ${listPt(up)}` : null,
    down.length ? `menos ${listPt(down)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const limit = limitSentence(order);
  return joinSentences([
    ["Faltavam ", { money: order.gapBefore }, " para a meta."],
    [
      "O método pediu ",
      { money: order.need },
      `${adjust ? ` (${adjust})` : ""} e comprou `,
      ...bought,
      ".",
    ],
    limit ? [limit] : null,
    order.fromLeftover > 0 && order.fromLeftover < order.quantity
      ? [{ quantity: order.fromLeftover }, " cota(s) vieram da sobra."]
      : null,
  ]);
}

/** A linha 1 das ações: a margem de segurança e o que faltava, com a sobra em lotes. */
export function plainStockReason(order: StockBuyOrder): string {
  const missing =
    order.deficitBefore <= 0
      ? "já estava na meta"
      : `faltavam ${formatBRL(order.deficitBefore)} para a meta`;
  return `Margem de segurança de ${formatPercent(order.marginOfSafety, 0)} · ${missing}${leftoverText(order)}`;
}

/** O cálculo de uma ordem de ação em linhas: a margem de segurança e o que faltava. */
export function stockCalcSteps(order: StockBuyOrder): CalcStep[] {
  const ceiling = order.price * (1 + order.marginOfSafety);
  return [
    {
      label: "Margem de segurança",
      value: `${formatPercent(order.marginOfSafety, 0)} (teto ${formatBRL(ceiling)})`,
      effect: null,
      exact: null,
    },
    {
      label: "Faltava para a meta",
      value: order.deficitBefore > 0 ? formatBRL(order.deficitBefore) : "já na meta",
      effect: null,
      exact: null,
      sensitive: order.deficitBefore > 0,
    },
  ];
}

/** A frase do cálculo das ações: o que faltava, a compra (em lotes) e os lotes da sobra. */
export function stockCalcSummary(order: StockBuyOrder): CalcPart[] {
  const lots = order.lot > 1 ? `, em lotes de ${order.lot}` : "";
  return joinSentences([
    order.deficitBefore > 0
      ? [
          "Faltavam ",
          { money: order.deficitBefore },
          ` para a meta de ${formatPercent(order.targetWeight, 1)}.`,
        ]
      : ["Já estava na meta."],
    [
      "Comprou ",
      { money: order.total },
      " (",
      { quantity: order.quantity },
      ` ${unitOf("ACAO", order.quantity)}${lots}).`,
    ],
    order.fromLeftover > 0 ? [`${order.fromLeftover / order.lot} lote(s) vieram da sobra.`] : null,
  ]);
}
