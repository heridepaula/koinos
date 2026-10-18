// Importa a planilha "FII's.xlsx" para a carteira de um usuário.
//
//   npm run import:planilha -- --file "D:\Downloads\FII's.xlsx" --dry-run
//   npm run import:planilha -- --file "D:\Downloads\FII's.xlsx" --email voce@gmail.com [--replace]
//
// Só entram os ativos "corretos": histórico consistente e quantidade final igual à da planilha.
// Os demais são listados com o motivo; corrija a planilha e rode de novo com --replace.
import { parseArgs } from "node:util";
import readXlsxFile from "read-excel-file/node";
import { ensureDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import { upsertTargetAsset } from "@/features/strategy/repo";
import { parsePlanilha, selectValidTickers, type SheetInput } from "@/features/transactions";
import {
  countTransactionsBySource,
  deleteTransactionsBySource,
  insertManyTransactions,
} from "@/features/transactions/repo";
import { mongoClient } from "@/shared/db/mongo";
import { formatQuantity } from "@/shared/lib/format";

const SOURCE = "PLANILHA" as const;
const OUT_OF_STRATEGY_RANK = 99;

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      email: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      replace: { type: "boolean", default: false },
    },
  });
  if (!values.file) throw new Error("Informe o arquivo: --file <caminho do .xlsx>");
  const dryRun = values["dry-run"];
  if (!dryRun && !values.email) throw new Error("Informe o e-mail do usuário: --email <e-mail>");

  const sheets = (await readXlsxFile(values.file)) as unknown as SheetInput[];
  const parsed = parsePlanilha(sheets);
  const { accepted, rejected } = selectValidTickers(parsed);
  const targets = new Map(parsed.targets.map((target) => [target.ticker, target]));

  console.log(
    `Lançamentos lidos: ${parsed.transactions.length} · linhas com erro: ${parsed.rowErrors.length}`,
  );
  for (const error of parsed.rowErrors) {
    console.log(`  ! ${error.sheet}, linha ${error.row}: ${error.message}`);
  }
  console.log(`\nAtivos que entram (${accepted.length}):`);
  for (const item of accepted) {
    const status =
      item.finalQuantity === 0 ? "encerrada" : `${formatQuantity(item.finalQuantity)} cotas`;
    console.log(
      `  ✓ ${item.ticker.padEnd(7)} ${String(item.transactions.length).padStart(3)} lançamentos · ${status}`,
    );
  }
  console.log(`\nAtivos que ficam de fora (${rejected.length}):`);
  for (const item of rejected) {
    console.log(`  ✗ ${item.ticker}`);
    for (const reason of item.reasons) console.log(`      - ${reason}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado.");
    return;
  }

  const userId = await findUserIdByEmail(values.email!);
  if (!userId) {
    throw new Error(
      `Nenhum usuário com o e-mail ${values.email}. Entre uma vez no app com esse e-mail e rode de novo.`,
    );
  }
  const portfolioId = await ensureDefaultPortfolioId(userId);

  const existing = await countTransactionsBySource(portfolioId, SOURCE);
  if (existing > 0 && !values.replace) {
    throw new Error(
      `Já existem ${existing} lançamentos importados da planilha. Use --replace para substituí-los.`,
    );
  }
  if (existing > 0) {
    const removed = await deleteTransactionsBySource(portfolioId, SOURCE);
    console.log(`\nRemovidos ${removed} lançamentos da importação anterior.`);
  }

  const inserted = await insertManyTransactions(
    portfolioId,
    accepted.flatMap((item) =>
      item.transactions.map((transaction) => ({
        ticker: transaction.ticker,
        type: transaction.type,
        quantity: transaction.quantity,
        unitPrice: transaction.unitPrice,
        fees: 0,
        date: transaction.date,
      })),
    ),
    SOURCE,
  );

  // Carteira Alvo só dos ativos importados (os pulados não podem parecer "zerados" para o motor).
  let configured = 0;
  for (const item of accepted) {
    const target = targets.get(item.ticker);
    if (!target) continue;
    const inStrategy = target.rank !== null && target.rank !== OUT_OF_STRATEGY_RANK;
    await upsertTargetAsset(portfolioId, item.ticker, {
      inStrategy,
      sunoRank: inStrategy ? target.rank : null,
      ceilingPrice: target.ceiling,
    });
    configured++;
  }

  console.log(`\nGravados ${inserted} lançamentos e ${configured} ativos na Carteira Alvo.`);
}

main()
  .catch((error: unknown) => {
    console.error(`\nErro: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => mongoClient.close());
