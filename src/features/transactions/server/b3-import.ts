import "server-only";
import readXlsxFile from "read-excel-file/node";
import { ActionError, type Tenant } from "@/features/auth/server";
import { readCatalogTypes } from "@/features/market-data/server";
import { withLock } from "@/shared/db/lock";
import { detectB3File } from "../import/b3/detect";
import { B3ImportError, planB3Import } from "../import/b3/plan";
import { readMovimentacao } from "../import/b3/read-movimentacao";
import { readNegociacao } from "../import/b3/read-negociacao";
import type {
  B3FileKind,
  B3ImportChanges,
  B3ImportPlan,
  B3ImportPreview,
  PlannedTransaction,
} from "../import/b3/types";
import { parsePlanilha, type SheetInput } from "../import/parse-planilha";
import type { B3ImportRequest } from "../schemas";
import {
  applyTransactionChanges,
  listTransactions,
  type TransactionRecord,
} from "./transaction-repo";

// Importação dos extratos da B3 pela tela (spec importacao-b3, §8, §10 e §11). Os arquivos são
// lidos em memória e descartados; a cada chamada, tudo é recalculado no servidor.

const MAX_FILES = 3;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 50_000;
const LOCK_TTL_MS = 60_000;
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const FILE_LABELS: Record<B3FileKind, string> = {
  NEGOCIACAO: "Negociação",
  MOVIMENTACAO: "Movimentação",
  PLANILHA: "planilha",
};

async function readSheets(file: File): Promise<SheetInput[]> {
  if (file.size > MAX_FILE_BYTES) throw new ActionError(`${file.name} passa de 2 MB.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new ActionError(`${file.name} não é uma planilha .xlsx.`);
  }
  return (await readXlsxFile(bytes)) as unknown as SheetInput[];
}

async function recognize(files: readonly File[]) {
  if (files.length === 0 || files.length > MAX_FILES) {
    throw new ActionError(
      "Envie os extratos de Negociação e de Movimentação e, se quiser, a sua planilha.",
    );
  }
  const found = new Map<B3FileKind, SheetInput[]>();
  let rows = 0;
  for (const file of files) {
    const sheets = await readSheets(file);
    rows += sheets.reduce((sum, sheet) => sum + sheet.data.length, 0);
    if (rows > MAX_ROWS) throw new ActionError("Os arquivos passam de 50.000 linhas.");
    const kind = detectB3File(sheets);
    if (!kind) {
      throw new ActionError(
        `Não reconheci ${file.name}. Envie os extratos baixados da Área do Investidor da B3.`,
      );
    }
    if (found.has(kind)) throw new ActionError(`Chegaram dois arquivos de ${FILE_LABELS[kind]}.`);
    found.set(kind, sheets);
  }
  const negociacao = found.get("NEGOCIACAO");
  const movimentacao = found.get("MOVIMENTACAO");
  if (!negociacao || !movimentacao) {
    throw new ActionError(`Falta o extrato de ${negociacao ? "Movimentação" : "Negociação"}.`);
  }
  return {
    negociacao,
    movimentacao,
    planilha: found.get("PLANILHA") ?? null,
    kinds: [...found.keys()],
  };
}

async function buildPlan(tenant: Tenant, request: B3ImportRequest) {
  const files = await recognize(request.files);
  const [existing, assetTypes] = await Promise.all([
    listTransactions(tenant.portfolioId),
    readCatalogTypes(),
  ]);
  if (assetTypes.size === 0) {
    throw new ActionError(
      "O catálogo de tickers ainda não foi carregado. Tente de novo em alguns minutos.",
    );
  }
  try {
    const plan = planB3Import({
      negociacao: readNegociacao(files.negociacao),
      movimentacao: readMovimentacao(files.movimentacao),
      planilha: files.planilha ? parsePlanilha(files.planilha) : null,
      existing,
      assetTypes,
      answers: request.answers,
    });
    return { plan, existing, kinds: files.kinds };
  } catch (error) {
    // Erros de conteúdo dos arquivos já vêm com mensagem para o usuário.
    if (error instanceof B3ImportError) throw new ActionError(error.message);
    throw error;
  }
}

type Comparable = Pick<
  PlannedTransaction,
  | "ticker"
  | "type"
  | "quantity"
  | "unitPrice"
  | "fees"
  | "date"
  | "kind"
  | "priceSource"
  | "relatedTicker"
  | "notes"
>;

const signature = (entry: Comparable) =>
  [
    entry.ticker,
    entry.type,
    entry.quantity,
    entry.unitPrice,
    entry.fees,
    entry.date.toISOString(),
    entry.kind,
    entry.priceSource ?? "",
    entry.relatedTicker ?? "",
    entry.notes ?? "",
  ].join("|");

/** Quantos lançamentos realmente mudam: o plano troca tudo, mas um reenvio igual não muda nada. */
function compare(plan: B3ImportPlan, existing: readonly TransactionRecord[]): B3ImportChanges {
  const removing = new Set(plan.removeIds);
  const pool = new Map<string, number>();
  for (const entry of existing) {
    if (!removing.has(entry.id) || entry.source !== "B3") continue;
    const key = signature(entry);
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  let unchanged = 0;
  for (const insert of plan.inserts) {
    const key = signature(insert);
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      unchanged++;
    }
  }
  return {
    added: plan.inserts.length - unchanged,
    removed: plan.removeIds.length - unchanged,
    unchanged,
  };
}

const isBlocked = (plan: B3ImportPlan) => plan.tickers.some((item) => item.status === "PENDENTE");

/** A prévia não leva os lançamentos nem os ids a remover: só as contagens. */
function withoutEntries(
  plan: B3ImportPlan,
): Omit<B3ImportPlan, "inserts" | "removeIds" | "dividends"> {
  return {
    period: plan.period,
    priorDate: plan.priorDate,
    tickers: plan.tickers,
    pending: plan.pending,
    removedBySource: plan.removedBySource,
    ignored: plan.ignored,
    warnings: plan.warnings,
    check: plan.check,
    totals: plan.totals,
  };
}

export async function previewB3Import(
  tenant: Tenant,
  request: B3ImportRequest,
): Promise<B3ImportPreview> {
  const { plan, existing, kinds } = await buildPlan(tenant, request);
  return {
    ...withoutEntries(plan),
    files: kinds,
    changes: compare(plan, existing),
    // Task 3 compara os proventos de verdade.
    dividendChanges: { added: 0, removed: 0, unchanged: 0 },
    blocked: isBlocked(plan),
  };
}

export async function confirmB3Import(
  tenant: Tenant,
  request: B3ImportRequest,
): Promise<{ removed: number; inserted: number }> {
  const result = await withLock(`import:${tenant.portfolioId}`, LOCK_TTL_MS, async () => {
    const { plan, existing } = await buildPlan(tenant, request);
    if (isBlocked(plan)) {
      throw new ActionError("A prévia mudou e há pendências sem resposta. Gere a prévia de novo.");
    }
    if (plan.check.unexplained.length > 0 && !request.acceptDivergences) {
      throw new ActionError(
        "A conferência pelos rendimentos tem divergências. Confirme que revisou para importar mesmo assim.",
      );
    }
    const changes = compare(plan, existing);
    if (changes.added === 0 && changes.removed === 0) return { removed: 0, inserted: 0 };
    return applyTransactionChanges(tenant.portfolioId, {
      removeIds: plan.removeIds,
      inserts: plan.inserts,
      source: "B3",
    });
  });
  if (!result) {
    throw new ActionError(
      "Outra importação desta carteira está em andamento. Tente de novo em instantes.",
    );
  }
  return result;
}
