import { darfDueDate } from "./darf-due";
import { formatMoney, round2 } from "./format";
import type { FiscalYearReport } from "./types";

/** Aviso fixo de todo relatório e de toda exportação (spec §7). */
export const TAX_DISCLAIMER =
  "Estimativa do Koinos. Não é orientação fiscal nem substitui a conferência com o informe da corretora e o programa da Receita.";

const INTERNAL_KEYS = new Set(["_id", "id", "portfolioId", "entryId"]);

/** Tira de um objeto qualquer as chaves internas, em qualquer profundidade. */
function withoutInternalIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutInternalIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !INTERNAL_KEYS.has(key))
        .map(([key, inner]) => [key, withoutInternalIds(inner)]),
    );
  }
  return value;
}

/** O relatório como JSON legível: ano, data de geração, aviso fixo e os dados, sem ids internos. */
export function reportToJson(report: FiscalYearReport, generatedAt: Date): string {
  return JSON.stringify(
    withoutInternalIds({
      disclaimer: TAX_DISCLAIMER,
      generatedAt: generatedAt.toISOString(),
      ...report,
    }),
    null,
    2,
  );
}

const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const R$ = (value: number) => `R$ ${formatMoney(value)}`;
const isoToBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O relatório em texto simples, para colar: Bens e Direitos (uma linha por ativo e uma pela
 * discriminação), proventos por ficha com os totais, apuração, DARF e achados.
 */
export function reportToCopyText(report: FiscalYearReport, generatedAt: Date): string {
  const { year } = report;
  const out: string[] = [
    `Relatório de IR do ano-calendário ${year} (gerado em ${DATE.format(generatedAt)})`,
    "",
    "BENS E DIREITOS",
  ];

  for (const p of report.positions) {
    out.push(
      `${p.ticker} · Grupo ${p.receita.group} Código ${p.receita.code} · ` +
        `31/12/${year - 1}: ${p.quantityPrevious} ${p.assetClass === "FII" ? "cotas" : "ações"}, ${R$(p.costPrevious)} · ` +
        `31/12/${year}: ${p.quantity} ${p.assetClass === "FII" ? "cotas" : "ações"}, ${R$(p.cost)}`,
    );
    out.push(
      p.discrimination ? p.discrimination : "(discriminação pendente: falta o CNPJ do emissor)",
    );
  }
  out.push(
    `Total em 31/12/${year}: ${R$(round2(report.positions.reduce((s, p) => s + p.cost, 0)))}`,
  );

  out.push("", "RENDIMENTOS ISENTOS");
  for (const i of report.exempt) {
    out.push(`${i.sourceKey} · ${i.tickers.join(", ")} · Código ${i.receita.code}: ${R$(i.net)}`);
  }
  out.push(`Total isentos: ${R$(round2(report.exempt.reduce((s, i) => s + i.net, 0)))}`);

  out.push("", "TRIBUTAÇÃO EXCLUSIVA");
  for (const i of report.exclusive) {
    out.push(
      `${i.sourceKey} · ${i.tickers.join(", ")} · Código ${i.receita.code}: ` +
        `líquido ${R$(i.net)}, bruto ${R$(i.gross)}, retido ${R$(i.withheld)}`,
    );
  }
  out.push(
    `Total exclusiva (líquido): ${R$(round2(report.exclusive.reduce((s, i) => s + i.net, 0)))} ` +
      `(bruto ${R$(round2(report.exclusive.reduce((s, i) => s + i.gross, 0)))}, ` +
      `retido ${R$(round2(report.exclusive.reduce((s, i) => s + i.withheld, 0)))})`,
  );

  if (report.unclassified.length > 0) {
    out.push("", "FORA DAS FICHAS (CONFIRA)");
    for (const u of report.unclassified) {
      out.push(`${u.ticker} · ${u.kind} · ${u.month}: ${R$(u.amount)} (${u.reason})`);
    }
  }

  out.push("", "VENDAS E APURAÇÃO (sem day trade e sem IRRF)");
  out.push(
    `Saldo de prejuízo anterior a nov/2019: FII ${R$(report.apuration.openingLoss.FII)}, ` +
      `ações ${R$(report.apuration.openingLoss.ACAO)}`,
  );
  for (const m of report.apuration.months) {
    out.push(
      `${m.month} · ${m.assetClass === "FII" ? "FII" : "Ações"} · vendido ${R$(m.sold)}, ` +
        `resultado ${R$(m.result)}${m.exempt ? " (isento)" : ""}, ` +
        `prejuízo compensado ${R$(m.lossCompensated)}, base ${R$(m.taxableBase)}, ` +
        `imposto ${R$(m.tax)}, saldo ${R$(m.lossBalanceAfter)}`,
    );
  }
  for (const d of report.apuration.darf) {
    out.push(
      `${d.month} · DARF 6015: ${d.due > 0 ? `${R$(d.due)} até ${isoToBr(darfDueDate(d.month))}` : `nada a pagar, ${R$(d.carriedOut)} segue para o mês seguinte`}`,
    );
  }
  out.push(
    `Saldo de prejuízo ao fim do ano: FII ${R$(report.closingLoss.FII)}, ações ${R$(report.closingLoss.ACAO)}`,
  );

  if (report.findings.length > 0) {
    out.push("", "ACHADOS DA AUDITORIA");
    for (const f of report.findings) out.push(`[${f.severity}] ${f.message}`);
  }

  out.push("", TAX_DISCLAIMER);
  return out.join("\n");
}
