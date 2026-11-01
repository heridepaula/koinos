// Laboratório da skill conselho-investidores: roda os motores de aporte do Koinos sobre a carteira
// gravada no banco, como a tela de Recomendações. SÓ LEITURA: não grava nada e não chama brapi,
// Yahoo nem B3; usa as cotações, os proventos e o P/VP que já estão no banco.
//
// Da raiz do repositório:
//   npx tsx --conditions=react-server --env-file=.env.local \
//     .claude/skills/conselho-investidores/scripts/lab.mts <comando> [opções]
//
// Comandos:
//   snapshot     as estratégias de FIIs e de ações hoje, a composição e o frescor dos dados
//   recomendar   --valor 10000 [--fiis 100]: o que a tela recomenda agora
//   projetar     --valor 10000 --periodos 8 [--fiis 100]: executa cada recomendação e repete, com
//                preços, proventos, P/VP e Carteira Alvo parados
//   choque       --valor 10000 [--fiis 100] [--cenarios 5000] [--comum 0.025] [--proprio 0.03]
//                [--semente 20261031]: sorteia preços (fator comum + próprio, log-normal) e mede
//                quanto a recomendação muda
//   mes          --mes 2026-10: as compras do mês × o motor sobre a carteira do fim do mês anterior
//   comparar     --a 3.0 --b 3.1 [--valor 10000] [--periodos 12] [--fiis 100] [--cenarios 300]
//                [--semente 20261031]: o primeiro aporte das duas versões lado a lado e a tabela de
//                notas das lentes (preços parados e preços sorteados)
// Opções comuns: --email (padrão: o primeiro e-mail de ALLOWED_EMAILS no .env.local) e, em
// recomendar, projetar, choque e mes, --versao 3.0|3.1 (padrão: CURRENT_ENGINE, a da tela).
import { parseArgs } from "node:util";
import { findDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import { assetClassOf, type AssetClass } from "@/features/market-data";
import { getAssetSnapshots, readCatalogTypes } from "@/features/market-data/repo";
import { buildSnapshot } from "@/features/portfolio";
import {
  CURRENT_ENGINE,
  ENGINE_VERSIONS,
  randomPricePaths,
  scorecard,
  splitAmount,
  stockSmartBuy,
  sunoCascade,
  type CascadeAsset,
  type CascadeResult,
  type EngineOptions,
  type EngineVersion,
  type Scorecard,
  type SimulationInput,
  type StockBuyAsset,
  type StockBuyResult,
} from "@/features/smart-buy";
import { listTargetAssets } from "@/features/strategy/repo";
import { listDividends, listTransactions } from "@/features/transactions/repo";

type Ledger = Awaited<ReturnType<typeof listTransactions>>;
type Ranked = { ticker: string; rank: number | null };
type OrderLike = { ticker: string; quantity: number; total: number };
// Uma versão do motor com as opções que ela liga.
type Engine = { version: EngineVersion; options: EngineOptions };
// O que as duas carteiras têm em comum no resultado de um aporte.
type ClassResult = {
  amount: number;
  spent: number;
  leftover: number;
  orders: readonly OrderLike[];
  excluded: readonly { ticker: string; reason: string }[];
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "-"
    : `${(value * 100).toFixed(digits)}%`;
const fixed = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(digits);
const row = (...cells: [unknown, number][]) =>
  cells
    .map(([value, width]) => String(value ?? "-").padEnd(width))
    .join("")
    .trimEnd();
const day = (date: Date) => date.toISOString().slice(0, 10);
const round2 = (value: number) => Math.round(value * 100) / 100;
const byRank = (a: Ranked, b: Ranked) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.ticker.localeCompare(b.ticker);
function sum<T>(items: readonly T[], value: (item: T) => number) {
  return items.reduce((total, item) => total + value(item), 0);
}

// O valor de cada posição como cada motor calcula: o FII sem cotação vale pelo preço médio; a ação
// sem cotação vale zero.
const fiiValue = (asset: CascadeAsset) => asset.quantity * (asset.price ?? asset.averagePrice ?? 0);
const stockValue = (asset: StockBuyAsset) =>
  asset.price !== null ? asset.quantity * asset.price : 0;
const marginToCeiling = (ceiling: number | null, price: number | null) =>
  ceiling !== null && price !== null && ceiling > 0 ? (ceiling - price) / ceiling : null;

async function load(email: string) {
  const userId = await findUserIdByEmail(email);
  if (!userId) throw new Error(`Nenhum usuário com o e-mail ${email}.`);
  const portfolioId = await findDefaultPortfolioId(userId);
  if (!portfolioId) throw new Error("O usuário não tem carteira.");
  const [transactions, targets, dividends] = await Promise.all([
    listTransactions(portfolioId),
    listTargetAssets(portfolioId),
    listDividends(portfolioId),
  ]);
  const tickers = [
    ...new Set([...transactions.map((entry) => entry.ticker), ...targets.map((t) => t.ticker)]),
  ];
  const [assets, catalog] = await Promise.all([getAssetSnapshots(tickers), readCatalogTypes()]);
  const classes = new Map<string, AssetClass | null>(
    tickers.map((ticker) => [ticker, assetClassOf(ticker, catalog.get(ticker) ?? null)]),
  );
  const now = new Date();
  // O mesmo cálculo de getPortfolioSnapshot na visão Geral, sem a sessão.
  const snapshotOf = (entries: Ledger) =>
    buildSnapshot({ now, transactions: entries, targets, dividends, prices: assets, classes });
  return { now, transactions, assets, classes, snapshotOf, snapshot: snapshotOf(transactions) };
}
type Data = Awaited<ReturnType<typeof load>>;

// Quem ficou de fora, uma linha por motivo.
function excludedLines(excluded: readonly { ticker: string; reason: string }[]) {
  const byReason = new Map<string, string[]>();
  for (const item of excluded) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item.ticker]);
  }
  return [...byReason].map(([reason, tickers]) => `fora (${reason}): ${tickers.join(", ")}`);
}

function printExcluded(excluded: readonly { ticker: string; reason: string }[]) {
  for (const line of excludedLines(excluded)) console.log(`  ${line}`);
}

// O mínimo por ordem dos FIIs, que só existe a partir da 3.1.
const minimumText = (minimum: number) => (minimum > 0 ? ` | mínimo por ordem ${brl(minimum)}` : "");

function printFii(result: CascadeResult) {
  console.log(
    `\nFIIs: aporte ${brl(result.amount)} | gasto ${brl(result.spent)} | sobra ${brl(result.leftover)} | travas: FII ${brl(result.caps.asset)}, setor ${brl(result.caps.sector)}, macro ${brl(result.caps.macro)}${minimumText(result.minimum)}`,
  );
  console.log(
    row(
      ["ticker", 8],
      ["rank", 5],
      ["qtd", 5],
      ["sobra", 6],
      ["preço", 8],
      ["total", 10],
      ["antes", 7],
      ["depois", 7],
      ["meta", 7],
      ["encher", 7],
      ["faltava", 10],
      ["tensores v×p×s×vac", 23],
      ["pedido", 10],
      ["trava", 7],
      ["falta depois", 0],
    ),
  );
  for (const order of result.orders) {
    const t = order.tensors;
    console.log(
      row(
        [order.ticker, 8],
        [order.rank, 5],
        [order.quantity, 5],
        [order.fromLeftover, 6],
        [fixed(order.price), 8],
        [brl(order.total), 10],
        [pct(order.weightBefore), 7],
        [pct(order.weightAfter), 7],
        [pct(order.targetWeight), 7],
        [pct(order.fillBefore), 7],
        [brl(order.gapBefore), 10],
        [`${fixed(t.valuation)}×${fixed(t.dividends)}×${fixed(t.safety)}×${fixed(t.vacancy)}`, 23],
        [brl(order.need), 10],
        [order.limitedBy ?? "-", 7],
        [brl(order.gapAfter), 0],
      ),
    );
  }
  printExcluded(result.excluded);
}

function printStock(result: StockBuyResult) {
  const lot = result.orders[0]?.lot ?? 1;
  console.log(
    `\nAções: aporte ${brl(result.amount)} | gasto ${brl(result.spent)} | sobra ${brl(result.leftover)} | base ${brl(result.base)}${lot > 1 ? ` | lote ${lot}` : ""}`,
  );
  console.log(
    row(
      ["ticker", 8],
      ["rank", 5],
      ["qtd", 5],
      ["sobra", 6],
      ["preço", 8],
      ["total", 10],
      ["MS", 7],
      ["faltava", 10],
      ["meta R$", 11],
      ["antes", 7],
      ["depois", 7],
      ["meta", 0],
    ),
  );
  for (const order of result.orders) {
    console.log(
      row(
        [order.ticker, 8],
        [order.rank, 5],
        [order.quantity, 5],
        [order.fromLeftover, 6],
        [fixed(order.price), 8],
        [brl(order.total), 10],
        [pct(order.marginOfSafety), 7],
        [brl(order.deficitBefore), 10],
        [brl(order.targetValue), 11],
        [pct(order.weightBefore), 7],
        [pct(order.weightAfter), 7],
        [pct(order.targetWeight), 0],
      ),
    );
  }
  printExcluded(result.excluded);
}

function snapshotCommand({ now, transactions, assets, snapshot }: Data) {
  const fiis = [...snapshot.cascadeInput].sort(byRank);
  const stocks = [...snapshot.stockBuyInput].sort(byRank);
  const fetched = [...fiis, ...stocks]
    .map((asset) => assets.get(asset.ticker)?.quoteFetchedAt?.getTime())
    .filter((time): time is number => typeof time === "number");
  const lastDate = (entries: Ledger) =>
    entries.reduce<Date | null>((max, e) => (max === null || e.date > max ? e.date : max), null);
  const last = lastDate(transactions);
  const lastB3 = lastDate(transactions.filter((entry) => entry.source === "B3"));
  console.log(`agora ${now.toISOString()}`);
  console.log(
    `cotações das estratégias: ${
      fetched.length > 0
        ? `${new Date(Math.min(...fetched)).toISOString()} a ${new Date(Math.max(...fetched)).toISOString()}`
        : "nenhuma"
    }`,
  );
  console.log(
    `último lançamento ${last ? day(last) : "-"} | último vindo da B3 ${lastB3 ? day(lastB3) : "-"}`,
  );
  const fiiTotal = sum(fiis, fiiValue);
  const stockTotal = sum(stocks, stockValue);
  console.log(
    `valor por classe: FIIs ${brl(snapshot.classValues.FII)} | ações ${brl(snapshot.classValues.ACAO)}`,
  );
  console.log(
    `estratégia de FIIs ${brl(fiiTotal)} (${fiis.length} FIIs) | FIIs fora dela ${brl(snapshot.classValues.FII - fiiTotal)}`,
  );
  console.log(
    `estratégia de ações ${brl(stockTotal)} (${stocks.length} ações) | ações fora dela ${brl(snapshot.classValues.ACAO - stockTotal)}`,
  );
  for (const alert of snapshot.alerts) console.log(`alerta: ${alert.title}`);

  console.log(
    "\nFIIs da estratégia (margem = (teto − preço) ÷ teto; prov = último provento ÷ média mensal de 12 meses; mágico = cotas para o provento mensal comprar 1 cota, e quanto disso já existe)",
  );
  console.log(
    row(
      ["ticker", 8],
      ["rank", 5],
      ["teto", 8],
      ["preço", 8],
      ["margem", 8],
      ["meta", 7],
      ["atual", 7],
      ["qtd", 7],
      ["valor", 12],
      ["P/VP", 6],
      ["prov", 6],
      ["vac", 7],
      ["macro", 7],
      ["setor", 14],
      ["viés", 9],
      ["mágico", 0],
    ),
  );
  for (const asset of fiis) {
    const value = fiiValue(asset);
    const ratio =
      asset.lastDividend !== null && asset.dividends12m
        ? asset.lastDividend / (asset.dividends12m / 12)
        : null;
    const magic =
      asset.price !== null && asset.lastDividend
        ? Math.ceil(asset.price / asset.lastDividend)
        : null;
    console.log(
      row(
        [asset.ticker, 8],
        [asset.rank, 5],
        [fixed(asset.ceiling), 8],
        [fixed(asset.price), 8],
        [pct(marginToCeiling(asset.ceiling, asset.price)), 8],
        [pct(asset.weight), 7],
        [pct(fiiTotal > 0 ? value / fiiTotal : 0), 7],
        [asset.quantity, 7],
        [brl(value), 12],
        [fixed(asset.priceToBook), 6],
        [fixed(ratio), 6],
        [pct(asset.vacancy), 7],
        [asset.macro, 7],
        [asset.sector ?? "-", 14],
        [asset.bias ?? "-", 9],
        [magic === null ? "-" : `${magic} (${pct(asset.quantity / magic, 0)})`, 0],
      ),
    );
  }

  const groups = (key: (asset: CascadeAsset) => string | null) => {
    const map = new Map<string, { value: number; weight: number; count: number }>();
    for (const asset of fiis) {
      const name = key(asset);
      if (name === null) continue;
      const group = map.get(name) ?? { value: 0, weight: 0, count: 0 };
      group.value += fiiValue(asset);
      group.weight += asset.weight;
      group.count += 1;
      map.set(name, group);
    }
    return [...map].sort((a, b) => b[1].value - a[1].value);
  };
  console.log("\ncomposição da estratégia de FIIs (atual × meta):");
  for (const [macro, group] of groups((asset) => asset.macro)) {
    console.log(
      `  ${macro}: ${pct(fiiTotal > 0 ? group.value / fiiTotal : 0)} × ${pct(group.weight)} (${group.count} FIIs)`,
    );
  }
  const sectors = groups((asset) => asset.sector);
  if (sectors.length > 0) {
    console.log(
      `  setores (só tijolo com segmento específico): ${sectors
        .map(
          ([name, g]) => `${name} ${pct(fiiTotal > 0 ? g.value / fiiTotal : 0)} × ${pct(g.weight)}`,
        )
        .join(" | ")}`,
    );
  }
  const noSector = fiis.filter((asset) => asset.sector === null).map((asset) => asset.ticker);
  console.log(`  sem setor (não dividem a trava de 35%): ${noSector.join(", ") || "-"}`);

  console.log(
    "\nAções da estratégia (MS = teto ÷ preço − 1, a margem do motor; margem = (teto − preço) ÷ teto, a da Carteira Alvo; DY = proventos de 12 meses ÷ preço)",
  );
  console.log(
    row(
      ["ticker", 8],
      ["rank", 5],
      ["teto", 8],
      ["preço", 8],
      ["MS", 8],
      ["margem", 8],
      ["meta", 7],
      ["atual", 7],
      ["qtd", 6],
      ["valor", 11],
      ["DY", 7],
      ["viés", 0],
    ),
  );
  for (const asset of stocks) {
    const value = stockValue(asset);
    const dividends12m = assets.get(asset.ticker)?.dividends12m ?? null;
    console.log(
      row(
        [asset.ticker, 8],
        [asset.rank, 5],
        [fixed(asset.ceiling), 8],
        [fixed(asset.price), 8],
        [pct(asset.ceiling !== null && asset.price ? asset.ceiling / asset.price - 1 : null), 8],
        [pct(marginToCeiling(asset.ceiling, asset.price)), 8],
        [pct(asset.weight), 7],
        [pct(stockTotal > 0 ? value / stockTotal : 0), 7],
        [asset.quantity, 6],
        [brl(value), 11],
        [pct(dividends12m !== null && asset.price ? dividends12m / asset.price : null), 7],
        [asset.bias ?? "-", 0],
      ),
    );
  }
}

function recommendCommand(data: Data, amount: number, fiisPercent: number, engine: Engine) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  console.log(`motor ${engine.version}`);
  console.log(`aporte ${brl(amount)}: FIIs ${brl(fii)} (${fiisPercent}%) | ações ${brl(stock)}`);
  if (fii > 0) printFii(sunoCascade(fii, data.snapshot.cascadeInput, engine.options));
  if (stock > 0) printStock(stockSmartBuy(stock, data.snapshot.stockBuyInput, engine.options));
}

function projectCommand(
  data: Data,
  amount: number,
  periods: number,
  fiisPercent: number,
  engine: Engine,
) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  let fiis = data.snapshot.cascadeInput.map((asset) => ({ ...asset }));
  let stocks = data.snapshot.stockBuyInput.map((asset) => ({ ...asset }));
  const received = new Map<string, { periods: number; total: number }>();
  const text = (orders: readonly OrderLike[]) =>
    orders.map((o) => `${o.ticker}×${o.quantity}(${Math.round(o.total)})`).join(" ") || "-";
  console.log(
    `motor ${engine.version} | por período: FIIs ${brl(fii)} | ações ${brl(stock)} | ${periods} períodos, com preços, proventos, P/VP e Carteira Alvo parados`,
  );
  for (let period = 1; period <= periods; period++) {
    const fiiResult = fii > 0 ? sunoCascade(fii, fiis, engine.options) : null;
    const stockResult = stock > 0 ? stockSmartBuy(stock, stocks, engine.options) : null;
    const orders: OrderLike[] = [...(fiiResult?.orders ?? []), ...(stockResult?.orders ?? [])];
    console.log(
      `#${period} FIIs: ${text(fiiResult?.orders ?? [])}${stockResult ? ` | ações: ${text(stockResult.orders)}` : ""} | sobra ${brl((fiiResult?.leftover ?? 0) + (stockResult?.leftover ?? 0))}`,
    );
    for (const order of orders) {
      const item = received.get(order.ticker) ?? { periods: 0, total: 0 };
      item.periods += 1;
      item.total += order.total;
      received.set(order.ticker, item);
    }
    const bought = new Map(orders.map((order) => [order.ticker, order.quantity]));
    fiis = fiis.map((a) => ({ ...a, quantity: a.quantity + (bought.get(a.ticker) ?? 0) }));
    stocks = stocks.map((a) => ({ ...a, quantity: a.quantity + (bought.get(a.ticker) ?? 0) }));
  }
  const report = <T extends Ranked & { weight: number }>(
    label: string,
    initial: readonly T[],
    final: readonly T[],
    value: (asset: T) => number,
  ) => {
    const before = sum(initial, value);
    const after = sum(final, value);
    console.log(`\n${label}: peso no início → no fim × meta | recebido | períodos com ordem`);
    for (const asset of [...final].sort(byRank)) {
      const first = initial.find((item) => item.ticker === asset.ticker);
      const item = received.get(asset.ticker);
      console.log(
        row(
          [asset.ticker, 8],
          [
            `${pct(first && before > 0 ? value(first) / before : 0)} → ${pct(after > 0 ? value(asset) / after : 0)}`,
            17,
          ],
          [`× ${pct(asset.weight)}`, 10],
          [brl(item?.total ?? 0), 12],
          [item?.periods ?? 0, 0],
        ),
      );
    }
  };
  if (fii > 0) report("FIIs", data.snapshot.cascadeInput, fiis, fiiValue);
  if (stock > 0) report("Ações", data.snapshot.stockBuyInput, stocks, stockValue);
}

function shockCommand(
  data: Data,
  amount: number,
  fiisPercent: number,
  runs: number,
  common: number,
  own: number,
  seed: number,
  engine: Engine,
) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  let state = Math.max(1, Math.floor(Math.abs(seed))) % 2147483647 || 1;
  const uniform = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  const run = (fiis: readonly CascadeAsset[], stocks: readonly StockBuyAsset[]): OrderLike[] => [
    ...(fii > 0 ? sunoCascade(fii, fiis, engine.options).orders : []),
    ...(stock > 0 ? stockSmartBuy(stock, stocks, engine.options).orders : []),
  ];
  const setKey = (orders: readonly OrderLike[]) =>
    orders
      .map((o) => o.ticker)
      .sort()
      .join(",");
  const exactKey = (orders: readonly OrderLike[]) =>
    orders
      .map((o) => `${o.ticker}:${o.quantity}`)
      .sort()
      .join(",");
  const base = run(data.snapshot.cascadeInput, data.snapshot.stockBuyInput);
  const hits = new Map<string, number[]>();
  let sameSet = 0;
  let sameExact = 0;
  let count = 0;
  for (let i = 0; i < runs; i++) {
    const market = normal() * common;
    const factor = () => Math.exp(market + normal() * own);
    const fiis = data.snapshot.cascadeInput.map((asset) => {
      const f = factor();
      return {
        ...asset,
        price: asset.price === null ? null : round2(asset.price * f),
        // O VP não muda em um mês: o P/VP anda com o preço.
        priceToBook: asset.priceToBook === null ? null : asset.priceToBook * f,
      };
    });
    const stocks = data.snapshot.stockBuyInput.map((asset) => {
      const f = factor();
      return { ...asset, price: asset.price === null ? null : round2(asset.price * f) };
    });
    const orders = run(fiis, stocks);
    if (setKey(orders) === setKey(base)) sameSet++;
    if (exactKey(orders) === exactKey(base)) sameExact++;
    count += orders.length;
    for (const order of orders)
      hits.set(order.ticker, [...(hits.get(order.ticker) ?? []), order.total]);
  }
  const median = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  console.log(
    `motor ${engine.version} | ${runs} cenários | fator comum σ ${pct(common)} + próprio σ ${pct(own)} | FIIs ${brl(fii)} | ações ${brl(stock)}`,
  );
  console.log(`sem choque: ${base.map((o) => `${o.ticker}×${o.quantity}`).join(" ") || "-"}`);
  console.log(
    `mesmo conjunto de ativos: ${pct(sameSet / runs)} | mesmas quantidades: ${pct(sameExact / runs)} | ativos por aporte, em média: ${(count / runs).toFixed(1)}`,
  );
  const line = (assets: readonly Ranked[]) =>
    [...assets]
      .sort(byRank)
      .map((asset) => {
        const totals = hits.get(asset.ticker) ?? [];
        return `${asset.ticker} ${pct(totals.length / runs, 0)}${totals.length > 0 ? ` (~${Math.round(median(totals))})` : ""}`;
      })
      .join(" | ");
  if (fii > 0)
    console.log(`FIIs (frequência e total mediano em R$): ${line(data.snapshot.cascadeInput)}`);
  if (stock > 0) console.log(`ações: ${line(data.snapshot.stockBuyInput)}`);
}

function monthCommand(data: Data, month: string, engine: Engine) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("--mes deve ser AAAA-MM.");
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const entries = data.transactions
    .filter((entry) => entry.date >= start && entry.date < end)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.ticker.localeCompare(b.ticker));
  console.log(`lançamentos de ${month}: ${entries.length}`);
  for (const entry of entries) {
    console.log(
      row(
        [day(entry.date), 11],
        [entry.ticker, 8],
        [data.classes.get(entry.ticker) ?? "?", 5],
        [entry.type, 5],
        [entry.kind, 17],
        [entry.quantity, 7],
        [fixed(entry.unitPrice), 9],
        [brl(entry.quantity * entry.unitPrice + entry.fees), 12],
        [entry.source, 0],
      ),
    );
  }
  const bought = new Map<string, OrderLike>();
  let fiiSpent = 0;
  let stockSpent = 0;
  for (const entry of entries) {
    if (entry.type !== "BUY" || (entry.kind !== "NEGOCIO" && entry.kind !== "SUBSCRICAO")) continue;
    const total = entry.quantity * entry.unitPrice + entry.fees;
    const item = bought.get(entry.ticker) ?? { ticker: entry.ticker, quantity: 0, total: 0 };
    item.quantity += entry.quantity;
    item.total += total;
    bought.set(entry.ticker, item);
    if (data.classes.get(entry.ticker) === "ACAO") stockSpent += total;
    else fiiSpent += total;
  }
  console.log(
    `compras em dinheiro (negócios e subscrições): FIIs ${brl(fiiSpent)} | ações ${brl(stockSpent)}`,
  );
  const before = data.snapshotOf(data.transactions.filter((entry) => entry.date < start));
  const fiiResult =
    fiiSpent > 0 ? sunoCascade(round2(fiiSpent), before.cascadeInput, engine.options) : null;
  const stockResult =
    stockSpent > 0 ? stockSmartBuy(round2(stockSpent), before.stockBuyInput, engine.options) : null;
  const byEngine = new Map<string, OrderLike>(
    [...(fiiResult?.orders ?? []), ...(stockResult?.orders ?? [])].map((order) => [
      order.ticker,
      order,
    ]),
  );
  console.log(
    `\no motor ${engine.version} sobre a carteira de ${day(new Date(start.getTime() - 86_400_000))}, com os mesmos valores (preços e Carteira Alvo de hoje): comprado × motor`,
  );
  for (const ticker of [...new Set([...bought.keys(), ...byEngine.keys()])].sort()) {
    const mine = bought.get(ticker);
    const suggested = byEngine.get(ticker);
    console.log(
      row(
        [ticker, 8],
        [mine ? `${mine.quantity} = ${brl(mine.total)}` : "-", 22],
        [suggested ? `${suggested.quantity} = ${brl(suggested.total)}` : "-", 0],
      ),
    );
  }
  if (fiiResult) printExcluded(fiiResult.excluded);
  if (stockResult) printExcluded(stockResult.excluded);
}

// Os desvios do sorteio de preços do `comparar`, os mesmos padrões do `choque`.
const COMPARE_SIGMA = { common: 0.025, own: 0.03 };

// O primeiro aporte de uma versão, aos preços de hoje, como a tela de Recomendações o calcula.
function firstAporte(input: SimulationInput, amount: number, fiisPercent: number, engine: Engine) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  return {
    fii: fii > 0 ? sunoCascade(fii, input.fiis, engine.options) : null,
    stock: stock > 0 ? stockSmartBuy(stock, input.stocks, engine.options) : null,
  };
}

// As ordens das duas versões na mesma linha por ativo (na ordem do ranking), os gastos e quem ficou
// de fora de cada uma.
function printVersus(
  label: string,
  assets: readonly Ranked[],
  results: readonly [ClassResult, ClassResult],
  names: readonly [string, string],
  minimums?: readonly [number, number],
) {
  console.log(`\n${label}: aporte ${brl(results[0].amount)}`);
  results.forEach((result, index) => {
    console.log(
      `  ${names[index]}: ${result.orders.length} ordens | gasto ${brl(result.spent)} | sobra ${brl(result.leftover)}${minimumText(minimums?.[index] ?? 0)}`,
    );
  });
  const cell = (result: ClassResult, ticker: string) => {
    const order = result.orders.find((item) => item.ticker === ticker);
    return order ? `${ticker}×${order.quantity}(${Math.round(order.total)})` : "-";
  };
  const tickers = [...assets]
    .sort(byRank)
    .map((asset) => asset.ticker)
    .filter((ticker) => results.some((result) => result.orders.some((o) => o.ticker === ticker)));
  if (tickers.length === 0) console.log("  nenhuma ordem");
  else {
    console.log(row([`  ${names[0]}`, 30], [names[1], 0]));
    for (const ticker of tickers) {
      console.log(row([`  ${cell(results[0], ticker)}`, 30], [cell(results[1], ticker), 0]));
    }
  }
  results.forEach((result, index) => {
    for (const line of excludedLines(result.excluded)) console.log(`  ${names[index]} ${line}`);
  });
}

type ScoreFormat = "pct" | "int" | "num" | "brl";
type ScoreRow = { label: string; a: number | null; b: number | null; format: ScoreFormat };

// Valor com sinal e o número de casas dado; um resultado que arredonda para zero fica sem sinal.
function signed(value: number, digits: number) {
  const rounded = Number(value.toFixed(digits));
  const text = Math.abs(rounded).toFixed(digits);
  return rounded > 0 ? `+${text}` : rounded < 0 ? `-${text}` : text;
}
// As frações saem em % com uma casa; a diferença de duas frações, em pontos percentuais.
const SCORE_FORMATS: Record<
  ScoreFormat,
  { show: (v: number) => string; diff: (v: number) => string }
> = {
  pct: { show: (v) => pct(v), diff: (v) => `${signed(v * 100, 1)} pp` },
  int: { show: (v) => String(Math.round(v)), diff: (v) => signed(v, 0) },
  num: { show: (v) => v.toFixed(2), diff: (v) => signed(v, 2) },
  brl: {
    show: (v) => brl(v),
    diff: (v) => {
      const rounded = Math.round(v * 100) / 100;
      return rounded > 0 ? `+${brl(rounded)}` : brl(rounded === 0 ? 0 : rounded);
    },
  },
};

// As notas de scorecard.ts agrupadas pela lente que as lê.
function scoreGroups(a: Scorecard, b: Scorecard): { lens: string; rows: ScoreRow[] }[] {
  const pair = (
    label: string,
    pick: (score: Scorecard) => number | null,
    format: ScoreFormat,
  ): ScoreRow => ({ label, a: pick(a), b: pick(b), format });
  const macros = [...new Set([...a.macro, ...b.macro].map((item) => item.macro))];
  const macroOf = (score: Scorecard, macro: string) =>
    score.macro.find((item) => item.macro === macro);
  return [
    {
      lens: "Tiago Reis (investir o aporte, sem trocar de ativo à toa, dentro do método)",
      rows: [
        pair("investido nos FIIs", (s) => s.investedPct.fii, "pct"),
        pair("investido nas ações", (s) => s.investedPct.stock, "pct"),
        pair("investido no total", (s) => s.investedPct.total, "pct"),
        pair("estabilidade: troca com ruído de 1% (menor é melhor)", (s) => s.stability, "pct"),
        pair("compras fora do método (precisa dar 0)", (s) => s.outsideMethod, "int"),
      ],
    },
    {
      lens: "Baroni (a composição da carteira de FIIs)",
      rows: [
        pair("desvio da meta dos FIIs, no fim", (s) => s.fiiDeviation.final, "pct"),
        pair("desvio da meta dos FIIs, média por período", (s) => s.fiiDeviation.average, "pct"),
        pair("FIIs que receberam ordem", (s) => s.fiisFunded, "num"),
        ...macros.map((macro) =>
          pair(
            `macro ${macro} no fim (meta ${pct((macroOf(a, macro) ?? macroOf(b, macro))?.target)})`,
            (s) => macroOf(s, macro)?.weight ?? null,
            "pct",
          ),
        ),
        pair("ordens de FII por período", (s) => s.fiiOrders.perPeriod, "num"),
        pair("menor ordem de FII (R$)", (s) => s.fiiOrders.smallest, "brl"),
      ],
    },
    {
      lens: "Buffett (rank e qualidade do que se compra)",
      rows: [
        pair("rank médio dos FIIs, pelo dinheiro", (s) => s.rankWeighted.fii, "num"),
        pair("rank médio das ações, pelo dinheiro", (s) => s.rankWeighted.stock, "num"),
        pair("gasto em FII com freio de proventos ou vacância", (s) => s.brakedShare, "pct"),
      ],
    },
    {
      lens: "Barsi (as ações, o caixa parado e o lote)",
      rows: [
        pair("caixa parado nas ações por período (R$)", (s) => s.stockIdle.perPeriod, "brl"),
        pair("caixa parado nas ações (% da parte das ações)", (s) => s.stockIdle.pct, "pct"),
        pair("ordens de ação por período", (s) => s.stockOrders.perPeriod, "num"),
        pair("lotes de ação por período", (s) => s.stockOrders.lotsPerPeriod, "num"),
      ],
    },
  ];
}

function printScoreTable(
  title: string,
  a: Scorecard,
  b: Scorecard,
  names: readonly [string, string],
) {
  console.log(`\n${title}`);
  console.log(row(["métrica", 58], [names[0], 14], [names[1], 14], ["diferença (B − A)", 0]));
  for (const group of scoreGroups(a, b)) {
    console.log(group.lens);
    for (const { label, a: valueA, b: valueB, format } of group.rows) {
      const { show, diff } = SCORE_FORMATS[format];
      console.log(
        row(
          [`  ${label}`, 58],
          [valueA === null ? "-" : show(valueA), 14],
          [valueB === null ? "-" : show(valueB), 14],
          [valueA === null || valueB === null ? "-" : diff(valueB - valueA), 0],
        ),
      );
    }
  }
}

function compareCommand(
  data: Data,
  versions: readonly [Engine, Engine],
  params: {
    amount: number;
    fiisPercent: number;
    periods: number;
    scenarios: number;
    seed: number;
  },
) {
  const { amount, fiisPercent, periods, scenarios, seed } = params;
  const [a, b] = versions;
  const names = [`A ${a.version}`, `B ${b.version}`] as const;
  const input: SimulationInput = {
    fiis: data.snapshot.cascadeInput,
    stocks: data.snapshot.stockBuyInput,
  };
  const { fii, stock } = splitAmount(amount, fiisPercent);
  const optionsText = (engine: Engine) =>
    Object.entries(engine.options)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
  console.log(`comparar ${a.version} (A) × ${b.version} (B)`);
  console.log(`  A: ${optionsText(a)}`);
  console.log(`  B: ${optionsText(b)}`);
  console.log(`aporte ${brl(amount)}: FIIs ${brl(fii)} (${fiisPercent}%) | ações ${brl(stock)}`);

  console.log("\nPrimeiro aporte, aos preços de hoje (ordens como TICKER×qtd(R$))");
  const [firstA, firstB] = [a, b].map((engine) => firstAporte(input, amount, fiisPercent, engine));
  if (firstA.fii && firstB.fii) {
    printVersus("FIIs", input.fiis, [firstA.fii, firstB.fii], names, [
      firstA.fii.minimum,
      firstB.fii.minimum,
    ]);
  }
  if (firstA.stock && firstB.stock)
    printVersus("Ações", input.stocks, [firstA.stock, firstB.stock], names);

  const base = { amount, fiisPercent, periods };
  const scoreOf = (engine: Engine, paths?: Parameters<typeof scorecard>[2]) =>
    scorecard(input, { ...base, options: engine.options }, paths);
  const run = `${periods} aportes de ${brl(amount)}`;
  printScoreTable(`Notas, preços parados (${run})`, scoreOf(a), scoreOf(b), names);

  const tickers = [...input.fiis, ...input.stocks].map((asset) => asset.ticker);
  const paths = Array.from({ length: scenarios }, (_, i) =>
    randomPricePaths(seed + i, tickers, periods, COMPARE_SIGMA),
  );
  printScoreTable(
    `Notas, média de ${scenarios} cenários de preço (${run}; fator comum σ ${pct(COMPARE_SIGMA.common)} + próprio σ ${pct(COMPARE_SIGMA.own)}; semente ${seed})`,
    scoreOf(a, paths),
    scoreOf(b, paths),
    names,
  );
}

const USAGE =
  "uso: lab.mts <snapshot|recomendar|projetar|choque|mes|comparar> [--valor 10000] [--fiis 100] [--periodos 8] [--cenarios 5000] [--comum 0.025] [--proprio 0.03] [--semente 20261031] [--mes AAAA-MM] [--versao 3.0|3.1] [--a 3.0 --b 3.1] [--email voce@exemplo.com]";

// A versão do motor pedida: desconhecida dá erro com as válidas; sem opção, a da tela.
function engineOf(raw: string | undefined, name: string, fallback = CURRENT_ENGINE): Engine {
  const version = raw ?? fallback;
  const valid = Object.keys(ENGINE_VERSIONS);
  if (!valid.includes(version)) {
    throw new Error(`--${name} inválida: ${version} (versões: ${valid.join(", ")}).`);
  }
  return { version: version as EngineVersion, options: ENGINE_VERSIONS[version as EngineVersion] };
}

function toNumber(
  raw: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number,
) {
  if (raw === undefined) return fallback;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} inválido: ${raw} (de ${min} a ${max}).`);
  }
  return value;
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      valor: { type: "string" },
      fiis: { type: "string" },
      periodos: { type: "string" },
      cenarios: { type: "string" },
      comum: { type: "string" },
      proprio: { type: "string" },
      semente: { type: "string" },
      mes: { type: "string" },
      versao: { type: "string" },
      a: { type: "string" },
      b: { type: "string" },
      email: { type: "string" },
    },
  });
  const command = positionals[0];
  if (
    !["snapshot", "recomendar", "projetar", "choque", "mes", "comparar"].includes(command ?? "")
  ) {
    console.log(USAGE);
    return 1;
  }
  const email = values.email ?? process.env.ALLOWED_EMAILS?.split(",")[0]?.trim();
  if (!email) throw new Error("Passe --email (ou defina ALLOWED_EMAILS no .env.local).");
  const amount = toNumber(values.valor, 10_000, "valor", 0.01, 1e9);
  const fiisPercent = toNumber(values.fiis, 100, "fiis", 0, 100);
  // As versões são validadas antes de abrir o banco.
  const engine = engineOf(values.versao, "versao");
  const compared = [engineOf(values.a, "a", "3.0"), engineOf(values.b, "b")] as const;
  const data = await load(email);
  switch (command) {
    case "snapshot":
      snapshotCommand(data);
      break;
    case "recomendar":
      recommendCommand(data, amount, fiisPercent, engine);
      break;
    case "projetar":
      projectCommand(
        data,
        amount,
        Math.round(toNumber(values.periodos, 8, "periodos", 1, 240)),
        fiisPercent,
        engine,
      );
      break;
    case "choque":
      shockCommand(
        data,
        amount,
        fiisPercent,
        Math.round(toNumber(values.cenarios, 5_000, "cenarios", 1, 50_000)),
        toNumber(values.comum, 0.025, "comum", 0, 1),
        toNumber(values.proprio, 0.03, "proprio", 0, 1),
        toNumber(values.semente, 20_261_031, "semente", 1, 2_147_483_646),
        engine,
      );
      break;
    case "mes":
      monthCommand(data, values.mes ?? "", engine);
      break;
    case "comparar":
      compareCommand(data, compared, {
        amount,
        fiisPercent,
        periods: Math.round(toNumber(values.periodos, 12, "periodos", 1, 240)),
        scenarios: Math.round(toNumber(values.cenarios, 300, "cenarios", 1, 5_000)),
        seed: toNumber(values.semente, 20_261_031, "semente", 1, 2_147_483_646),
      });
      break;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
