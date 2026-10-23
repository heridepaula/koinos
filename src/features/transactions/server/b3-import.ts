import "server-only";
import readXlsxFile from "read-excel-file/node";
import { ActionError, type Tenant } from "@/features/auth/server";
import { readCatalogTypes } from "@/features/market-data/server";
import { withLock } from "@/shared/db/lock";
import { todayTradeDate } from "@/shared/lib/time";
import type { DividendEntry } from "../domain/types";
import {
  diffDividends,
  diffLedger,
  hasDividendOutsideScope,
  sameForecast,
} from "../import/b3/changes";
import { detectB3File } from "../import/b3/detect";
import { B3ImportError, planB3Import } from "../import/b3/plan";
import { readEventos } from "../import/b3/read-eventos";
import { readMovimentacao } from "../import/b3/read-movimentacao";
import { readNegociacao } from "../import/b3/read-negociacao";
import type {
  B3FileKind,
  B3ImportPlan,
  B3ImportPreview,
  B3ImportResult,
  ExistingDividend,
  StoredLedgerRow,
} from "../import/b3/types";
import type { SheetInput } from "../import/parse-planilha";
import type { B3ImportRequest } from "../schemas";
import { getDividendForecast, listDividendRecords } from "./dividend-repo";
import { applyB3Update, listTransactions, type TransactionRecord } from "./transaction-repo";

// Atualização pela B3 (spec atualizacao-b3): os três extratos da Área do Investidor, lidos em
// memória e descartados. A cada chamada, tudo é recalculado no servidor, e a confirmação grava só
// a diferença: o que já está igual fica com o mesmo `_id`.

const REQUIRED_FILES: readonly B3FileKind[] = ["NEGOCIACAO", "MOVIMENTACAO", "EVENTOS"];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 50_000;
const LOCK_TTL_MS = 60_000;
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const FILE_LABELS: Record<B3FileKind, string> = {
  NEGOCIACAO: "Negociação",
  MOVIMENTACAO: "Movimentação",
  EVENTOS: "Eventos",
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

/** Exatamente os três extratos (spec atualizacao-b3, §5): falta, sobra ou planilha bloqueiam. */
async function recognize(files: readonly File[]) {
  if (files.length === 0 || files.length > REQUIRED_FILES.length) {
    throw new ActionError("Envie os três extratos da B3: Negociação, Movimentação e Eventos.");
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
    if (kind === "PLANILHA") {
      throw new ActionError("A planilha não é mais usada: envie só os três extratos da B3.");
    }
    if (found.has(kind)) throw new ActionError(`Chegaram dois arquivos de ${FILE_LABELS[kind]}.`);
    found.set(kind, sheets);
  }
  const missing = REQUIRED_FILES.filter((kind) => !found.has(kind)).map(
    (kind) => FILE_LABELS[kind],
  );
  if (missing.length === 1) throw new ActionError(`Falta o extrato de ${missing[0]}.`);
  if (missing.length > 1) {
    throw new ActionError(`Faltam os extratos de ${missing.join(" e de ")}.`);
  }
  return {
    negociacao: found.get("NEGOCIACAO")!,
    movimentacao: found.get("MOVIMENTACAO")!,
    eventos: found.get("EVENTOS")!,
  };
}

async function buildUpdate(tenant: Tenant, request: B3ImportRequest) {
  const files = await recognize(request.files);
  const [existing, existingDividends, storedForecast, assetTypes] = await Promise.all([
    listTransactions(tenant.portfolioId),
    listDividendRecords(tenant.portfolioId),
    getDividendForecast(tenant.portfolioId),
    readCatalogTypes(),
  ]);
  if (assetTypes.size === 0) {
    throw new ActionError(
      "O catálogo de tickers ainda não foi carregado. Tente de novo em alguns minutos.",
    );
  }
  const asOf = todayTradeDate(new Date());
  let plan: B3ImportPlan;
  try {
    plan = planB3Import({
      negociacao: readNegociacao(files.negociacao),
      movimentacao: readMovimentacao(files.movimentacao),
      eventos: readEventos(files.eventos),
      asOf,
      planilha: null,
      existing,
      assetTypes,
      answers: request.answers,
    });
  } catch (error) {
    // Erros de conteúdo dos arquivos já vêm com mensagem para o usuário.
    if (error instanceof B3ImportError) throw new ActionError(error.message);
    throw error;
  }
  const upcoming = plan.upcoming ?? { asOf, items: [] };
  const entries = diffLedger(plan, existing);
  const dividends = diffDividends(plan.dividends, existingDividends);
  const forecastChanged = !storedForecast || !sameForecast(storedForecast.items, upcoming.items);
  const changed =
    entries.insert.length > 0 ||
    entries.removeIds.length > 0 ||
    dividends.insert.length > 0 ||
    dividends.removeIds.length > 0 ||
    forecastChanged;
  return { plan, upcoming, entries, dividends, forecastChanged, changed };
}

type Update = Awaited<ReturnType<typeof buildUpdate>>;

const isBlocked = (plan: B3ImportPlan) => plan.tickers.some((item) => item.status === "PENDENTE");

// A prévia vai para o navegador: só os campos que a tela mostra, sem ids internos.
const storedRow = (entry: TransactionRecord): StoredLedgerRow => ({
  ticker: entry.ticker,
  type: entry.type,
  quantity: entry.quantity,
  unitPrice: entry.unitPrice,
  fees: entry.fees,
  date: entry.date,
  kind: entry.kind,
  priceSource: entry.priceSource,
  relatedTicker: entry.relatedTicker,
  notes: entry.notes,
  source: entry.source,
});
const storedDividend = (item: ExistingDividend): DividendEntry => ({
  ticker: item.ticker,
  paidAt: item.paidAt,
  kind: item.kind,
  amount: item.amount,
  quantity: item.quantity,
  perShare: item.perShare,
});

function counts(update: Update): B3ImportResult {
  return {
    entries: {
      added: update.entries.added.length,
      replaced: update.entries.replaced.length,
      unchanged: update.entries.unchanged,
    },
    dividends: {
      added: update.dividends.added.length,
      replaced: update.dividends.replaced.length,
      unchanged: update.dividends.unchanged,
    },
    upcoming: { items: update.upcoming.items.length, changed: update.forecastChanged },
  };
}

export async function previewB3Import(
  tenant: Tenant,
  request: B3ImportRequest,
): Promise<B3ImportPreview> {
  const update = await buildUpdate(tenant, request);
  const { plan, entries, dividends, upcoming } = update;
  return {
    period: plan.period,
    priorDate: plan.priorDate,
    tickers: plan.tickers,
    pending: plan.pending,
    ignored: plan.ignored,
    warnings: plan.warnings,
    check: plan.check,
    files: [...REQUIRED_FILES],
    entries: {
      added: entries.added,
      replaced: entries.replaced.map(({ before, after }) => ({ before: storedRow(before), after })),
      unchanged: entries.unchanged,
    },
    dividends: {
      period: plan.dividends.period,
      added: dividends.added,
      replaced: dividends.replaced.map(({ before, after }) => ({
        before: storedDividend(before),
        after,
      })),
      unchanged: dividends.unchanged,
    },
    upcoming: {
      ...upcoming,
      total: upcoming.items.reduce((sum, item) => sum + item.amount, 0),
      changed: update.forecastChanged,
    },
    forecastMismatches: plan.forecastMismatches,
    nothingNew: !update.changed,
    blocked: isBlocked(plan),
  };
}

export async function confirmB3Import(
  tenant: Tenant,
  request: B3ImportRequest,
): Promise<B3ImportResult> {
  const result = await withLock(`import:${tenant.portfolioId}`, LOCK_TTL_MS, async () => {
    const update = await buildUpdate(tenant, request);
    const { plan, entries, dividends, upcoming } = update;
    if (isBlocked(plan)) {
      throw new ActionError("A prévia mudou e há pendências sem resposta. Gere a prévia de novo.");
    }
    if (plan.check.unexplained.length > 0 && !request.acceptDivergences) {
      throw new ActionError(
        "A conferência pelos rendimentos tem divergências. Confirme que revisou para importar mesmo assim.",
      );
    }
    // Fora do escopo, o provento não seria comparado num reenvio e ficaria repetido.
    if (hasDividendOutsideScope(plan.dividends))
      throw new Error("Provento fora do escopo da troca.");
    if (update.changed) {
      await applyB3Update(tenant.portfolioId, {
        removeIds: entries.removeIds,
        inserts: entries.insert,
        dividendRemoveIds: dividends.removeIds,
        dividendInserts: dividends.insert,
        forecast: upcoming,
      });
    }
    return counts(update);
  });
  if (!result) {
    throw new ActionError(
      "Outra atualização desta carteira está em andamento. Tente de novo em instantes.",
    );
  }
  return result;
}
