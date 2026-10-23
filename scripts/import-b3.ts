// Importa os extratos da B3 (Negociação + Movimentação) para a carteira de um usuário, com a
// planilha FII's.xlsx como complemento. Usa o mesmo plano da tela de importação (planB3Import).
// Também troca os proventos (Rendimento e Reembolso de FIIs) do extrato de Movimentação.
//
//   npm run import:b3 -- --negociacao n.xlsx --movimentacao m.xlsx [--planilha "FII's.xlsx"] --dry-run
//   npm run import:b3 -- --negociacao n.xlsx --movimentacao m.xlsx --email voce@gmail.com --respostas r.json
//
// respostas.json responde as pendências que a prévia lista (ids sub:…, prev:… e conv:…):
//   { "prices": { "sub:KISU11:2021-05-26:226": 98.5 }, "estimated": ["sub:KISU11:2021-05-26:226"],
//     "conversions": { "conv:PMLL11:2025-07-23:197": "MALL11" }, "exclude": [] }
// Só grava sem nenhuma pendência aberta e com a conferência pelos rendimentos sem divergência
// inexplicada (ou com --aceitar-divergencias).
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import readXlsxFile from "read-excel-file/node";
import { ensureDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import { readCatalogTypes } from "@/features/market-data/repo";
import { upsertTargetAsset } from "@/features/strategy/repo";
import {
  B3ImportError,
  computePositions,
  detectB3File,
  findOversells,
  parsePlanilha,
  planB3Import,
  readMovimentacao,
  readNegociacao,
  type B3FileKind,
  type B3ImportAnswers,
  type SheetInput,
} from "@/features/transactions";
import { applyTransactionChanges, listTransactions } from "@/features/transactions/repo";
import { mongoClient } from "@/shared/db/mongo";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";

const OUT_OF_STRATEGY_RANK = 99;

async function readSheets(path: string, expected: B3FileKind): Promise<SheetInput[]> {
  const sheets = (await readXlsxFile(path)) as unknown as SheetInput[];
  const kind = detectB3File(sheets);
  if (kind !== expected) {
    throw new B3ImportError(
      `${path}: era esperado o arquivo ${expected}, mas veio ${kind ?? "um arquivo não reconhecido"}.`,
    );
  }
  return sheets;
}

async function main() {
  const { values } = parseArgs({
    options: {
      negociacao: { type: "string" },
      movimentacao: { type: "string" },
      planilha: { type: "string" },
      email: { type: "string" },
      respostas: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "aceitar-divergencias": { type: "boolean", default: false },
      alvo: { type: "boolean", default: false },
    },
  });
  if (!values.negociacao || !values.movimentacao) {
    throw new B3ImportError(
      "Informe --negociacao e --movimentacao (arquivos .xlsx da Área do Investidor).",
    );
  }
  const dryRun = values["dry-run"];
  if (!dryRun && !values.email)
    throw new B3ImportError("Informe o e-mail do usuário: --email <e-mail>");

  const negociacao = readNegociacao(await readSheets(values.negociacao, "NEGOCIACAO"));
  const movimentacao = readMovimentacao(await readSheets(values.movimentacao, "MOVIMENTACAO"));
  const planilha = values.planilha
    ? parsePlanilha(await readSheets(values.planilha, "PLANILHA"))
    : null;
  const answers: B3ImportAnswers = values.respostas
    ? (JSON.parse(await readFile(values.respostas, "utf8")) as B3ImportAnswers)
    : {};

  const assetTypes = await readCatalogTypes();
  if (assetTypes.size === 0) {
    throw new B3ImportError(
      "O catálogo de tickers está vazio: abra o app ou rode o cron uma vez antes.",
    );
  }

  let portfolioId: string | null = null;
  if (values.email) {
    const userId = await findUserIdByEmail(values.email);
    if (!userId) {
      throw new B3ImportError(
        `Nenhum usuário com o e-mail ${values.email}. Entre uma vez no app e rode de novo.`,
      );
    }
    portfolioId = await ensureDefaultPortfolioId(userId);
  }
  const existing = portfolioId ? await listTransactions(portfolioId) : [];

  const plan = planB3Import({ negociacao, movimentacao, planilha, existing, assetTypes, answers });

  // --- Relatório ---------------------------------------------------------------------------
  console.log(
    `Período: ${formatTradeDate(plan.period.start)} a ${formatTradeDate(plan.period.end)} · posição anterior em ${formatTradeDate(plan.priorDate)}`,
  );
  console.log(
    `Lançamentos atuais: ${existing.length} · a remover: ${plan.removeIds.length} ${JSON.stringify(plan.removedBySource)} · a inserir: ${plan.inserts.length}`,
  );
  console.log(`Por tipo (todos os FIIs): ${JSON.stringify(plan.totals)}`);
  const dividendsTotal = plan.dividends.inserts.reduce((sum, item) => sum + item.amount, 0);
  console.log(
    `Proventos: ${plan.dividends.inserts.length} (${formatBRL(dividendsTotal)}) em ${new Set(plan.dividends.inserts.map((item) => item.ticker)).size} FIIs · trocados em ${plan.dividends.tickers.length} FIIs`,
  );

  console.log("\nFII       situação   cotas      preço médio  L/P realizado   lançamentos");
  for (const item of plan.tickers) {
    const counts = Object.entries(item.counts)
      .map(([kind, count]) => `${kind.toLowerCase()} ${count}`)
      .join(", ");
    console.log(
      `${item.ticker.padEnd(9)} ${item.status.padEnd(9)} ${formatQuantity(item.quantity).padStart(7)} ${formatBRL(item.averagePrice).padStart(14)} ${formatBRL(item.realizedPnL).padStart(15)}   ${counts}${item.outOfCatalog ? " · fora do catálogo" : ""}${item.unconfirmed ? ` · ${item.unconfirmed} sem confirmação da B3` : ""}`,
    );
    for (const reason of item.reasons) console.log(`          - ${reason}`);
  }

  const open = plan.pending.filter((item) =>
    item.type === "CONVERSAO" ? item.source === null : item.price === null,
  );
  console.log(`\nPendências: ${plan.pending.length} (abertas: ${open.length})`);
  for (const item of plan.pending) {
    if (item.type === "CONVERSAO") {
      console.log(
        `  ${item.source === null ? "ABERTA " : "ok     "} ${item.id} → origem ${item.source ?? "?"} (sugestão: ${item.suggestion ?? "nenhuma"}; candidatos: ${item.candidates.join(", ") || "nenhum"})`,
      );
    } else {
      console.log(
        `  ${item.price === null ? "ABERTA " : "ok     "} ${item.id} · ${formatQuantity(item.quantity)} cotas · ${item.price === null ? "sem preço" : `${formatBRL(item.price)} (${item.priceSource})`}`,
      );
    }
  }

  console.log("\nIgnorados:");
  for (const group of plan.ignored)
    console.log(
      `  ${group.reason}: ${group.codes.length} (${group.codes.slice(0, 12).join(", ")}${group.codes.length > 12 ? "…" : ""})`,
    );
  if (plan.warnings.length) {
    console.log("\nAvisos:");
    for (const warning of plan.warnings) console.log(`  - ${warning}`);
  }

  const { check } = plan;
  console.log(
    `\nConferência pelos rendimentos: ${check.matched} de ${check.months} meses batem · explicados: ${check.explained.length} · sem explicação: ${check.unexplained.length}`,
  );
  for (const item of check.explained)
    console.log(
      `  explicado   ${item.ticker} ${item.month}: oficial ${formatQuantity(item.official)} × reconstruído ${formatQuantity(item.rebuilt)} (${item.reason})`,
    );
  for (const item of check.unexplained)
    console.log(
      `  DIVERGE     ${item.ticker} ${item.month}: oficial ${formatQuantity(item.official)} × reconstruído ${formatQuantity(item.rebuilt)}`,
    );

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado.");
    return;
  }

  // --- Gravação ------------------------------------------------------------------------------
  if (open.length > 0)
    throw new B3ImportError(`Há ${open.length} pendência(s) aberta(s): responda em --respostas.`);
  if (check.unexplained.length > 0 && !values["aceitar-divergencias"]) {
    throw new B3ImportError(
      "A conferência pelos rendimentos tem divergências sem explicação. Revise ou use --aceitar-divergencias.",
    );
  }
  const result = await applyTransactionChanges(portfolioId!, {
    removeIds: plan.removeIds,
    inserts: plan.inserts,
    source: "B3",
    dividends: plan.dividends,
  });
  console.log(
    `\nGravado: ${result.removed} removidos e ${result.inserted} inseridos · proventos: ${result.dividendsRemoved} removidos e ${result.dividendsInserted} inseridos.`,
  );

  // Conferência depois de gravar: as mesmas regras do app, lendo do banco.
  const saved = await listTransactions(portfolioId!);
  const oversells = findOversells(saved);
  const positions = new Map(computePositions(saved).map((position) => [position.ticker, position]));
  const mismatches = plan.tickers.filter((item) => {
    if (item.status !== "OK") return false;
    const position = positions.get(item.ticker);
    const quantity = position?.quantity ?? 0;
    const average = position?.averagePrice ?? 0;
    return (
      Math.abs(quantity - item.quantity) > 1e-6 || Math.abs(average - item.averagePrice) > 1e-4
    );
  });
  console.log(
    `Conferência no banco: ${saved.length} lançamentos · vendas sem cobertura: ${oversells.length} · FIIs diferentes do plano: ${mismatches.length}${mismatches.length ? ` (${mismatches.map((item) => item.ticker).join(", ")})` : ""}`,
  );

  // Carteira Alvo: rank e preço teto da planilha, para os FIIs importados (como no importador da planilha).
  if (values.alvo && planilha) {
    const accepted = new Set(
      plan.tickers.filter((item) => item.status === "OK").map((item) => item.ticker),
    );
    let configured = 0;
    for (const target of planilha.targets) {
      if (!accepted.has(target.ticker)) continue;
      const inStrategy = target.rank !== null && target.rank !== OUT_OF_STRATEGY_RANK;
      await upsertTargetAsset(portfolioId!, target.ticker, {
        inStrategy,
        sunoRank: inStrategy ? target.rank : null,
        ceilingPrice: target.ceiling,
      });
      configured++;
    }
    console.log(
      `Carteira Alvo: ${configured} FIIs configurados com rank e preço teto da planilha.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(`\nErro: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => mongoClient.close());
