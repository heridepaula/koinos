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
// Opção comum: --email (padrão: o primeiro e-mail de ALLOWED_EMAILS no .env.local).
import { parseArgs } from "node:util";
import { findDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import { assetClassOf, type AssetClass } from "@/features/market-data";
import { getAssetSnapshots, readCatalogTypes } from "@/features/market-data/repo";
import { buildSnapshot } from "@/features/portfolio";
import {
  splitAmount,
  stockSmartBuy,
  sunoCascade,
  type CascadeAsset,
  type CascadeResult,
  type StockBuyAsset,
  type StockBuyResult,
} from "@/features/smart-buy";
import { listTargetAssets } from "@/features/strategy/repo";
import { listDividends, listTransactions } from "@/features/transactions/repo";

type Ledger = Awaited<ReturnType<typeof listTransactions>>;
type Ranked = { ticker: string; rank: number | null };
type OrderLike = { ticker: string; quantity: number; total: number };

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

function printExcluded(excluded: readonly { ticker: string; reason: string }[]) {
  const byReason = new Map<string, string[]>();
  for (const item of excluded) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item.ticker]);
  }
  for (const [reason, tickers] of byReason)
    console.log(`  fora (${reason}): ${tickers.join(", ")}`);
}

function printFii(result: CascadeResult) {
  console.log(
    `\nFIIs: aporte ${brl(result.amount)} | gasto ${brl(result.spent)} | sobra ${brl(result.leftover)} | travas: FII ${brl(result.caps.asset)}, setor ${brl(result.caps.sector)}, macro ${brl(result.caps.macro)}`,
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
  console.log(
    `\nAções: aporte ${brl(result.amount)} | gasto ${brl(result.spent)} | sobra ${brl(result.leftover)} | base ${brl(result.base)}`,
  );
  console.log(
    row(
      ["ticker", 8],
      ["rank", 5],
      ["qtd", 5],
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

function recommendCommand(data: Data, amount: number, fiisPercent: number) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  console.log(`aporte ${brl(amount)}: FIIs ${brl(fii)} (${fiisPercent}%) | ações ${brl(stock)}`);
  if (fii > 0) printFii(sunoCascade(fii, data.snapshot.cascadeInput));
  if (stock > 0) printStock(stockSmartBuy(stock, data.snapshot.stockBuyInput));
}

function projectCommand(data: Data, amount: number, periods: number, fiisPercent: number) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  let fiis = data.snapshot.cascadeInput.map((asset) => ({ ...asset }));
  let stocks = data.snapshot.stockBuyInput.map((asset) => ({ ...asset }));
  const received = new Map<string, { periods: number; total: number }>();
  const text = (orders: readonly OrderLike[]) =>
    orders.map((o) => `${o.ticker}×${o.quantity}(${Math.round(o.total)})`).join(" ") || "-";
  console.log(
    `por período: FIIs ${brl(fii)} | ações ${brl(stock)} | ${periods} períodos, com preços, proventos, P/VP e Carteira Alvo parados`,
  );
  for (let period = 1; period <= periods; period++) {
    const fiiResult = fii > 0 ? sunoCascade(fii, fiis) : null;
    const stockResult = stock > 0 ? stockSmartBuy(stock, stocks) : null;
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
) {
  const { fii, stock } = splitAmount(amount, fiisPercent);
  let state = Math.max(1, Math.floor(Math.abs(seed))) % 2147483647 || 1;
  const uniform = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  const run = (fiis: readonly CascadeAsset[], stocks: readonly StockBuyAsset[]): OrderLike[] => [
    ...(fii > 0 ? sunoCascade(fii, fiis).orders : []),
    ...(stock > 0 ? stockSmartBuy(stock, stocks).orders : []),
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
    `${runs} cenários | fator comum σ ${pct(common)} + próprio σ ${pct(own)} | FIIs ${brl(fii)} | ações ${brl(stock)}`,
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

function monthCommand(data: Data, month: string) {
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
  const fiiResult = fiiSpent > 0 ? sunoCascade(round2(fiiSpent), before.cascadeInput) : null;
  const stockResult =
    stockSpent > 0 ? stockSmartBuy(round2(stockSpent), before.stockBuyInput) : null;
  const engine = new Map<string, OrderLike>(
    [...(fiiResult?.orders ?? []), ...(stockResult?.orders ?? [])].map((order) => [
      order.ticker,
      order,
    ]),
  );
  console.log(
    `\no motor sobre a carteira de ${day(new Date(start.getTime() - 86_400_000))}, com os mesmos valores (preços e Carteira Alvo de hoje): comprado × motor`,
  );
  for (const ticker of [...new Set([...bought.keys(), ...engine.keys()])].sort()) {
    const mine = bought.get(ticker);
    const suggested = engine.get(ticker);
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

const USAGE =
  "uso: lab.mts <snapshot|recomendar|projetar|choque|mes> [--valor 10000] [--fiis 100] [--periodos 8] [--cenarios 5000] [--comum 0.025] [--proprio 0.03] [--semente 20261031] [--mes AAAA-MM] [--email voce@exemplo.com]";

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
      email: { type: "string" },
    },
  });
  const command = positionals[0];
  if (!["snapshot", "recomendar", "projetar", "choque", "mes"].includes(command ?? "")) {
    console.log(USAGE);
    return 1;
  }
  const email = values.email ?? process.env.ALLOWED_EMAILS?.split(",")[0]?.trim();
  if (!email) throw new Error("Passe --email (ou defina ALLOWED_EMAILS no .env.local).");
  const amount = toNumber(values.valor, 10_000, "valor", 0.01, 1e9);
  const fiisPercent = toNumber(values.fiis, 100, "fiis", 0, 100);
  const data = await load(email);
  switch (command) {
    case "snapshot":
      snapshotCommand(data);
      break;
    case "recomendar":
      recommendCommand(data, amount, fiisPercent);
      break;
    case "projetar":
      projectCommand(
        data,
        amount,
        Math.round(toNumber(values.periodos, 8, "periodos", 1, 240)),
        fiisPercent,
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
      );
      break;
    case "mes":
      monthCommand(data, values.mes ?? "");
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
