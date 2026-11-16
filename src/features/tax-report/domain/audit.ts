import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { formatMoney } from "./format";
import type { ApurationMonth, AssetFiscalPosition, AuditFinding, FiscalClass } from "./types";
import type { YearDividends } from "./year-dividends";

/** A retenção de 10% da Lei 15.270/2025 vale para pagamentos de 2026 em diante, acima disso no mês. */
export const DIVIDEND_RETENTION_FLOOR = 50_000;

const monthOf = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

/** Achados do relatório, todos por regra de código: o texto da IA nunca decide um achado. */
export function auditReport(input: {
  year: number;
  positions: readonly AssetFiscalPosition[];
  dividends: YearDividends;
  rawDividends: readonly DividendEntry[];
  entries: readonly LedgerEntry[];
  months: readonly ApurationMonth[];
  openingLossInformed: boolean;
  classOf: (ticker: string) => FiscalClass | null;
  cnpjOf: (ticker: string) => string | null;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const noCnpj = new Set<string>();

  for (const p of input.positions) {
    if (!p.cnpj) noCnpj.add(p.ticker);
    for (const flag of p.flags) {
      out.push({
        code: flag,
        severity: "INFO",
        ticker: p.ticker,
        month: null,
        message:
          flag === "PRECO_ESTIMADO"
            ? `${p.ticker}: o custo usa preço de compra estimado; confira a nota de corretagem.`
            : `${p.ticker}: parte da posição vem da posição anterior de 2019 e não tem data de compra.`,
      });
    }
  }
  for (const item of [...input.dividends.exempt, ...input.dividends.exclusive]) {
    if (!item.cnpj) for (const t of item.tickers) noCnpj.add(t);
  }
  for (const ticker of [...noCnpj].sort()) {
    out.push({
      code: "CNPJ_AUSENTE",
      severity: "CRITICO",
      ticker,
      month: null,
      message: `${ticker}: sem CNPJ do emissor. Informe o CNPJ para gerar o texto e agrupar os proventos.`,
    });
  }

  if (!input.openingLossInformed) {
    out.push({
      code: "SALDO_PREJUIZO_NAO_INFORMADO",
      severity: "INFO",
      ticker: null,
      month: null,
      message:
        "Saldo de prejuízo a compensar de anos anteriores não informado: a apuração assume zero.",
    });
  }

  for (const u of input.dividends.unclassified) {
    const reimbursement = u.kind === "REEMBOLSO";
    out.push({
      code: reimbursement ? "PROVENTO_REEMBOLSO" : "ALUGUEL_NAO_CLASSIFICADO",
      severity: "ATENCAO",
      ticker: u.ticker,
      month: u.month,
      message: reimbursement
        ? `${u.ticker}: reembolso de R$ ${formatMoney(u.amount)} em ${u.month} ficou fora das fichas; confira de qual provento ele é.`
        : `${u.ticker}: aluguel de ativos de R$ ${formatMoney(u.amount)} em ${u.month} ficou fora das fichas; confira como declarar.`,
    });
  }

  for (const ticker of input.dividends.jcpOffRange) {
    out.push({
      code: "JCP_FORA_DA_FAIXA",
      severity: "ATENCAO",
      ticker,
      month: null,
      message: `${ticker}: o JCP líquido não corresponde a 85% de um valor bruto ao centavo; confira com o informe.`,
    });
  }

  if (input.year >= 2026) {
    const bySource = new Map<string, number>();
    for (const d of input.rawDividends) {
      if (
        d.paidAt.getUTCFullYear() !== input.year ||
        d.kind !== "DIVIDENDO" ||
        input.classOf(d.ticker) !== "ACAO"
      )
        continue;
      const month = monthOf(input.year, d.paidAt.getUTCMonth());
      const key = `${input.cnpjOf(d.ticker) ?? d.ticker}|${month}`;
      bySource.set(key, (bySource.get(key) ?? 0) + d.amount);
    }
    for (const [key, total] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) {
      if (total <= DIVIDEND_RETENTION_FLOOR) continue;
      const [source, month] = key.split("|");
      out.push({
        code: "RETENCAO_DIVIDENDO_POSSIVEL",
        severity: "ATENCAO",
        ticker: null,
        month,
        message: `${source}: R$ ${formatMoney(total)} em dividendos no mês passa de R$ 50.000; pode haver retenção de 10% (Lei 15.270/2025). Confira com o informe.`,
      });
    }
  }

  const isTrade = (e: LedgerEntry) => e.kind === undefined || e.kind === "NEGOCIO";
  const buyDays = new Set(
    input.entries
      .filter((e) => e.type === "BUY" && isTrade(e))
      .map((e) => `${e.ticker}|${e.date.getTime()}`),
  );
  const dayTrades = new Set<string>();
  for (const e of input.entries) {
    if (e.type !== "SELL" || !isTrade(e)) continue;
    if (e.date.getUTCFullYear() !== input.year || !buyDays.has(`${e.ticker}|${e.date.getTime()}`))
      continue;
    dayTrades.add(`${e.ticker}|${monthOf(input.year, e.date.getUTCMonth())}`);
  }
  for (const key of [...dayTrades].sort()) {
    const [ticker, month] = key.split("|");
    out.push({
      code: "DAY_TRADE_NAO_APURADO",
      severity: "ATENCAO",
      ticker,
      month,
      message: `${ticker}: houve compra e venda no mesmo dia em ${month}. Day trade ainda não é apurado aqui (20%, à parte do swing trade).`,
    });
  }

  for (const m of input.months) {
    if (m.assetClass === "ACAO" && !m.exempt && m.tax > 0) {
      out.push({
        code: "VENDA_ACIMA_ISENCAO",
        severity: "INFO",
        ticker: null,
        month: m.month,
        message: `${m.month}: vendas de ações de R$ ${formatMoney(m.sold)} passaram de R$ 20.000; imposto estimado de R$ ${formatMoney(m.tax)} (DARF 6015).`,
      });
    }
  }
  return out;
}
