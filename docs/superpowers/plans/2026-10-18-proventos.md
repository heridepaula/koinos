# Proventos (ciclo 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar os proventos do extrato de Movimentação da B3, prever os do mês pelo Yahoo, mostrar tudo em `/proventos` e somar os proventos ao resultado de cada FII e da carteira.

**Architecture:**
- O plano puro da importação da B3 passa a extrair os proventos. O serviço os grava numa coleção nova, `dividends`, na mesma transação dos lançamentos.
- O `refreshDividends` do Yahoo guarda os anúncios recentes no ativo.
- Um módulo puro, `portfolio/domain/dividends.ts`, calcula:
  - o "a receber";
  - os totais do mês;
  - os agrupamentos do histórico;
  - o resultado ajustado.
- O snapshot e as telas só consomem esse módulo.

**Tech Stack:** Next.js 16 (Cache Components), Mongoose, yahoo-finance2, Recharts, nuqs, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-18-proventos-design.md`

**Regras do repositório:**
- Não há suíte de testes, por decisão do dono. Cada tarefa verifica com um script descartável no scratchpad, rodado com `npx tsx --conditions=react-server`, mais `npm run lint` e `npm run typecheck`.
- O `.env.local` aponta para o banco de **produção**. Scripts que gravam usam `MONGODB_URI` com o banco `koinos_preview`.
- O trabalho fica no branch `feat/proventos`, e o commit é feito ao fim de cada tarefa.
- Os commits terminam com as linhas de atribuição da sessão.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/features/transactions/domain/types.ts` | Modificar | Tipo `DividendEntry` e `DIVIDEND_KINDS` |
| `src/features/transactions/index.ts` | Modificar | Exportar os tipos novos |
| `src/features/transactions/import/b3/types.ts` | Modificar | `PlannedDividend`, `B3ImportPlan.dividends`, `B3ImportPreview.dividendChanges` |
| `src/features/transactions/import/b3/plan.ts` | Modificar | `extractDividends` |
| `src/features/transactions/server/dividend.model.ts` | Criar | Coleção `dividends` |
| `src/features/transactions/server/dividend-repo.ts` | Criar | `listDividends(portfolioId)` |
| `src/features/transactions/server/transaction-repo.ts` | Modificar | `applyTransactionChanges` também troca os proventos |
| `src/features/transactions/server/b3-import.ts` | Modificar | Comparação dos proventos, prévia e confirmação |
| `src/features/transactions/server/transactions-dal.ts`, `server.ts`, `repo.ts` | Modificar | `getMyDividends` e a exportação para os scripts |
| `src/features/transactions/components/b3-import/preview-sections.tsx` | Modificar | Linha "proventos novos" |
| `scripts/import-b3.ts` | Modificar | Relatório e gravação dos proventos |
| `src/features/market-data/server/models.ts`, `history-service.ts`, `assets-read.ts` | Modificar | `dividendAnnouncements` |
| `src/features/portfolio/domain/dividends.ts` | Criar | Regras puras (§4 do spec) |
| `src/features/portfolio/domain/types.ts`, `snapshot.ts` | Modificar | Resultado ajustado e anúncios no `PriceInfo` |
| `src/features/portfolio/server/snapshot.ts` | Modificar | Passar os proventos ao snapshot e `getDividendsView` |
| `src/features/portfolio/server.ts`, `index.ts`, `ui.ts` | Modificar | Exportações |
| `src/features/portfolio/components/summary-cards.tsx`, `positions-table.tsx`, `closed-positions.tsx` | Modificar | Dashboard |
| `src/features/portfolio/components/dividends/*.tsx` | Criar | Componentes da tela `/proventos` |
| `src/app/(app)/proventos/page.tsx` | Criar | Rota |
| `src/shared/components/app-sidebar.tsx` | Modificar | Item "Proventos" |

---

### Task 1: Tipos de provento e regras puras

**Goal:** criar o tipo `DividendEntry` e o módulo puro `portfolio/domain/dividends.ts`, com o "a receber", os totais do mês, os agrupamentos e o resultado ajustado.

**Files:**
- Modify: `src/features/transactions/domain/types.ts`
- Modify: `src/features/transactions/index.ts`
- Create: `src/features/portfolio/domain/dividends.ts`
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/index.ts`

**Acceptance Criteria:**
- [ ] `upcomingDividends` usa as cotas da véspera da data ex e descarta o anúncio que já tem um provento da B3 pago na data ex ou depois dela.
- [ ] `adjustedResult(-60000, 20000, -5000)` devolve `{ withDividends: -40000, total: -45000 }`.
- [ ] `groupByYear` calcula a média mensal só sobre os meses que tiveram provento.
- [ ] `npm run lint` e `npm run typecheck` passam.

**Verify:** `npx tsx --conditions=react-server <scratchpad>/check-dividends-domain.ts` imprime `OK` em todas as linhas.

**Steps:**

- [ ] **Step 1: tipo no domínio de transactions**

Acrescente ao fim de `src/features/transactions/domain/types.ts`:

```ts
/** Provento recebido, como a B3 informa no extrato de Movimentação. */
export const DIVIDEND_KINDS = ["RENDIMENTO", "REEMBOLSO"] as const;
export type DividendKind = (typeof DIVIDEND_KINDS)[number];

export type DividendEntry = {
  ticker: string;
  /** Data do pagamento (meia-noite UTC, como as datas de negócio). */
  paidAt: Date;
  kind: DividendKind;
  amount: number;
  quantity: number | null;
  perShare: number | null;
};
```

Em `src/features/transactions/index.ts`, troque a linha de tipos do domínio por:

```ts
export type {
  DividendEntry,
  DividendKind,
  LedgerEntry,
  Oversell,
  Position,
  TransactionType,
} from "./domain/types";
```

E inclua `DIVIDEND_KINDS` no bloco que já exporta `PRICE_SOURCES`:

```ts
export {
  DIVIDEND_KINDS,
  PRICE_SOURCES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
  type PriceSource,
  type TransactionKind,
  type TransactionSource,
} from "./domain/types";
```

- [ ] **Step 2: tipos de saída em `portfolio/domain/types.ts`**

Acrescente ao `PriceInfo`:

```ts
  /** Anúncios recentes do Yahoo (data ex e valor por cota), para o "a receber". */
  dividendAnnouncements: { exDate: Date; perShare: number }[];
```

Acrescente ao fim do arquivo:

```ts
export type AdjustedResult = { withDividends: number; total: number };

export type UpcomingDividend = {
  ticker: string;
  exDate: Date;
  quantity: number;
  perShare: number;
  amount: number;
  /** Estimativa: o Yahoo não informa a data de pagamento. */
  payBy: Date;
};

export type DividendMonthSummary = {
  month: string;
  received: number;
  upcoming: number;
  total: number;
};

export type DividendMonthGroup = {
  month: string;
  total: number;
  byTicker: { ticker: string; amount: number }[];
};

export type DividendYearGroup = {
  year: string;
  total: number;
  months: number;
  monthlyAverage: number;
};

export type DividendTickerGroup = {
  ticker: string;
  total: number;
  payments: number;
  lastPaidAt: Date;
};
```

- [ ] **Step 3: criar `src/features/portfolio/domain/dividends.ts`**

```ts
import { sortLedger, type DividendEntry, type LedgerEntry } from "@/features/transactions";
import { addMonths, currentMonthKey, monthKeyOfTradeDate } from "@/shared/lib/time";
import type {
  AdjustedResult,
  DividendMonthGroup,
  DividendMonthSummary,
  DividendTickerGroup,
  DividendYearGroup,
  UpcomingDividend,
} from "./types";

// Regras: docs/superpowers/specs/2026-10-18-proventos-design.md (§4).

const DAY = 86_400_000;
const EPSILON = 1e-9;
/** FIIs costumam pagar de 5 a 15 dias depois da data com. */
const PAY_WINDOW_DAYS = 15;

/** Cotas de `ticker` no fim do dia anterior a `exDate`. */
export function quantityBefore(
  entries: readonly LedgerEntry[],
  ticker: string,
  exDate: Date,
): number {
  let quantity = 0;
  for (const entry of sortLedger(entries.filter((item) => item.ticker === ticker))) {
    if (entry.date.getTime() >= exDate.getTime()) break;
    quantity += entry.type === "BUY" ? entry.quantity : -entry.quantity;
    if (quantity < EPSILON) quantity = 0;
  }
  return quantity;
}

/**
 * Proventos anunciados e ainda não recebidos: data ex no mês atual ou no anterior, até hoje,
 * sem provento da B3 do mesmo FII pago na data ex ou depois.
 */
export function upcomingDividends(input: {
  now: Date;
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  announcements: ReadonlyMap<string, readonly { exDate: Date; perShare: number }[]>;
}): UpcomingDividend[] {
  const month = currentMonthKey(input.now);
  const firstMonth = addMonths(month, -1);
  const result: UpcomingDividend[] = [];
  for (const [ticker, list] of input.announcements) {
    for (const announcement of list) {
      const exMonth = monthKeyOfTradeDate(announcement.exDate);
      if (exMonth < firstMonth || exMonth > month) continue;
      if (announcement.exDate.getTime() > input.now.getTime()) continue;
      const paid = input.received.some(
        (item) =>
          item.ticker === ticker && item.paidAt.getTime() >= announcement.exDate.getTime(),
      );
      if (paid) continue;
      const quantity = quantityBefore(input.transactions, ticker, announcement.exDate);
      if (quantity <= 0) continue;
      result.push({
        ticker,
        exDate: announcement.exDate,
        quantity,
        perShare: announcement.perShare,
        amount: quantity * announcement.perShare,
        payBy: new Date(announcement.exDate.getTime() + PAY_WINDOW_DAYS * DAY),
      });
    }
  }
  return result.sort(
    (a, b) => a.exDate.getTime() - b.exDate.getTime() || a.ticker.localeCompare(b.ticker),
  );
}

export function monthSummary(
  now: Date,
  received: readonly DividendEntry[],
  upcoming: readonly UpcomingDividend[],
): DividendMonthSummary {
  const month = currentMonthKey(now);
  const receivedTotal = received
    .filter((item) => monthKeyOfTradeDate(item.paidAt) === month)
    .reduce((sum, item) => sum + item.amount, 0);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amount, 0);
  return {
    month,
    received: receivedTotal,
    upcoming: upcomingTotal,
    total: receivedTotal + upcomingTotal,
  };
}

/** Por mês, do mais recente para o mais antigo, com o detalhe por FII (maior primeiro). */
export function groupByMonth(received: readonly DividendEntry[]): DividendMonthGroup[] {
  const months = new Map<string, Map<string, number>>();
  for (const item of received) {
    const key = monthKeyOfTradeDate(item.paidAt);
    const tickers = months.get(key) ?? new Map<string, number>();
    tickers.set(item.ticker, (tickers.get(item.ticker) ?? 0) + item.amount);
    months.set(key, tickers);
  }
  return [...months]
    .map(([month, tickers]) => ({
      month,
      total: [...tickers.values()].reduce((sum, value) => sum + value, 0),
      byTicker: [...tickers]
        .map(([ticker, amount]) => ({ ticker, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Por ano: total e média mensal sobre os meses com algum provento. */
export function groupByYear(received: readonly DividendEntry[]): DividendYearGroup[] {
  const years = new Map<string, { total: number; months: Set<string> }>();
  for (const item of received) {
    const month = monthKeyOfTradeDate(item.paidAt);
    const year = month.slice(0, 4);
    const group = years.get(year) ?? { total: 0, months: new Set<string>() };
    group.total += item.amount;
    group.months.add(month);
    years.set(year, group);
  }
  return [...years]
    .map(([year, group]) => ({
      year,
      total: group.total,
      months: group.months.size,
      monthlyAverage: group.total / group.months.size,
    }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

/** Por papel: total acumulado, número de pagamentos e o último (maior total primeiro). */
export function groupByTicker(received: readonly DividendEntry[]): DividendTickerGroup[] {
  const tickers = new Map<string, DividendTickerGroup>();
  for (const item of received) {
    const group = tickers.get(item.ticker) ?? {
      ticker: item.ticker,
      total: 0,
      payments: 0,
      lastPaidAt: item.paidAt,
    };
    group.total += item.amount;
    group.payments += 1;
    if (item.paidAt > group.lastPaidAt) group.lastPaidAt = item.paidAt;
    tickers.set(item.ticker, group);
  }
  return [...tickers.values()].sort((a, b) => b.total - a.total);
}

/** Total recebido por FII, desde sempre. */
export function dividendsByTicker(received: readonly DividendEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of received) totals.set(item.ticker, (totals.get(item.ticker) ?? 0) + item.amount);
  return totals;
}

/** Com proventos = cotação + proventos; total = cotação + proventos + vendas. */
export function adjustedResult(
  unrealized: number,
  dividends: number,
  realized: number,
): AdjustedResult {
  return { withDividends: unrealized + dividends, total: unrealized + dividends + realized };
}
```

- [ ] **Step 4: exportar em `src/features/portfolio/index.ts`**

```ts
export {
  adjustedResult,
  dividendsByTicker,
  groupByMonth,
  groupByTicker,
  groupByYear,
  monthSummary,
  quantityBefore,
  upcomingDividends,
} from "./domain/dividends";
```

Acrescente também `AdjustedResult`, `DividendMonthGroup`, `DividendMonthSummary`, `DividendTickerGroup`, `DividendYearGroup` e `UpcomingDividend` ao `export type` que já existe.

- [ ] **Step 5: corrigir o `toPriceInfo`**

Em `src/features/portfolio/server/snapshot.ts`, inclua `dividendAnnouncements: []` no objeto do `toPriceInfo`, para o typecheck passar até a Task 4.

- [ ] **Step 6: script de conferência**

Grave no scratchpad o arquivo `check-dividends-domain.ts`:

```ts
import {
  adjustedResult,
  groupByYear,
  monthSummary,
  upcomingDividends,
} from "D:/workspace/koinos/src/features/portfolio/index";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ok = (label: string, cond: boolean) => console.log(cond ? "OK  " : "FAIL", label);
const now = new Date("2026-10-18T15:00:00Z");
const tx = [
  { id: "1", ticker: "MXRF11", type: "BUY" as const, quantity: 100, unitPrice: 10, fees: 0, date: d("2026-09-01"), createdAt: d("2026-09-01") },
  { id: "2", ticker: "MXRF11", type: "BUY" as const, quantity: 50, unitPrice: 10, fees: 0, date: d("2026-10-01"), createdAt: d("2026-10-01") },
  { id: "3", ticker: "HGLG11", type: "BUY" as const, quantity: 10, unitPrice: 160, fees: 0, date: d("2026-01-02"), createdAt: d("2026-01-02") },
];
const ann = new Map([
  ["MXRF11", [{ exDate: d("2026-10-01"), perShare: 0.1 }]],
  ["HGLG11", [{ exDate: d("2026-10-01"), perShare: 1.17 }, { exDate: d("2026-09-01"), perShare: 1.17 }]],
]);
const received = [
  { ticker: "HGLG11", paidAt: d("2026-09-15"), kind: "RENDIMENTO" as const, amount: 11.7, quantity: 10, perShare: 1.17 },
];
const up = upcomingDividends({ now, transactions: tx, received, announcements: ann });
ok("MXRF11 usa as 100 cotas da véspera", up.find((u) => u.ticker === "MXRF11")?.quantity === 100);
ok("HGLG11 de setembro já foi recebido", up.filter((u) => u.ticker === "HGLG11").length === 1);
ok("HGLG11 de outubro = 11,70", Math.abs((up.find((u) => u.ticker === "HGLG11")?.amount ?? 0) - 11.7) < 1e-9);
const summary = monthSummary(now, received, up);
ok("mês: recebido 0, a receber 21,70", summary.received === 0 && Math.abs(summary.upcoming - 21.7) < 1e-9);
const r = adjustedResult(-60000, 20000, -5000);
ok("SNFF11: -40k e -45k", r.withDividends === -40000 && r.total === -45000);
const years = groupByYear([...received, { ...received[0]!, paidAt: d("2026-09-20") }]);
ok("média mensal só sobre os meses com provento", years[0]!.months === 1 && Math.abs(years[0]!.monthlyAverage - 23.4) < 1e-9);
```

Run: `npx tsx --conditions=react-server C:/Users/HTN-PC/AppData/Local/Temp/claude/D--workspace-koinos/7c6733cc-e601-4407-a031-5cb5d7f8f716/scratchpad/check-dividends-domain.ts`

Expected: 6 linhas `OK`.

- [ ] **Step 7: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
git add src/features/transactions/domain/types.ts src/features/transactions/index.ts src/features/portfolio
git commit -m "feat(dividends): pure rules for upcoming dividends, grouping and adjusted results"
```

---

### Task 2: proventos no plano de importação da B3

**Goal:** fazer o `planB3Import` devolver os proventos do extrato de Movimentação: só os créditos de Rendimento e Reembolso de FIIs aceitos.

**Files:**
- Modify: `src/features/transactions/import/b3/types.ts`
- Modify: `src/features/transactions/import/b3/plan.ts`
- Modify: `src/features/transactions/index.ts`

**Acceptance Criteria:**
- [ ] `plan.dividends.inserts` tem só créditos `Rendimento` e `Reembolso` cujo código é da família de um FII aceito (status `OK`).
- [ ] `plan.dividends.period` é o período do extrato de Movimentação (`firstDate` a `lastDate`).
- [ ] `plan.dividends.tickers` lista os FIIs aceitos, que são os que terão os proventos substituídos.
- [ ] Com os extratos reais, a contagem e a soma batem com 1.290 Rendimentos + 61 Reembolsos (R$ 298.410,30 no total).
  - Se a contagem for diferente, o script lista os códigos excluídos, e a diferença precisa ser explicada (por exemplo, FIIs fora do catálogo) antes do commit.

**Verify:** `npx tsx --conditions=react-server --env-file=.env.local <scratchpad>/check-plan-dividends.ts` imprime as contagens. É só leitura: usa `readCatalogTypes` e não grava nada.

**Steps:**

- [ ] **Step 1: tipos**

Em `import/b3/types.ts`, importe `DividendKind` de `../../domain/types` e acrescente:

```ts
/** Provento que o plano manda gravar (sempre com `source: "B3"`). */
export type PlannedDividend = {
  ticker: string;
  paidAt: Date;
  kind: DividendKind;
  amount: number;
  quantity: number | null;
  perShare: number | null;
};

export type PlannedDividends = {
  /** Período do extrato de Movimentação: os proventos destes FIIs nele são trocados. */
  period: { start: Date; end: Date };
  tickers: string[];
  inserts: PlannedDividend[];
};

export type B3DividendChanges = { added: number; removed: number; unchanged: number };
```

Acrescente `dividends: PlannedDividends;` ao `B3ImportPlan`.

Troque o `B3ImportPreview` por:

```ts
export type B3ImportPreview = Omit<B3ImportPlan, "inserts" | "removeIds" | "dividends"> & {
  files: B3FileKind[];
  changes: B3ImportChanges;
  dividendChanges: B3DividendChanges;
  /** Algum FII ainda depende de resposta. */
  blocked: boolean;
};
```

Exporte `PlannedDividend` e `PlannedDividends` no `export type` de `import/b3/types` em `transactions/index.ts`.

- [ ] **Step 2: extração no `plan.ts`**

Acrescente depois da função `dividendCheck`:

```ts
// --- Proventos (spec proventos, §3.1) ------------------------------------------------------

const DIVIDEND_ROW_KINDS: Record<string, PlannedDividend["kind"]> = {
  Rendimento: "RENDIMENTO",
  Reembolso: "REEMBOLSO",
};

function extractDividends(
  movimentacao: MovimentacaoData,
  accepted: (ticker: string) => boolean,
  tickers: readonly string[],
): PlannedDividends {
  const inserts: PlannedDividend[] = [];
  for (const row of movimentacao.rows) {
    const kind = DIVIDEND_ROW_KINDS[row.kind];
    if (!row.credit || !kind || !FII_FAMILY_CODE.test(row.code)) continue;
    if (row.value === null || row.value <= 0) continue;
    const ticker = fiiOf(row.code);
    if (!accepted(ticker)) continue;
    inserts.push({
      ticker,
      paidAt: row.date,
      kind,
      amount: row.value,
      quantity: row.quantity,
      perShare: row.unitPrice,
    });
  }
  return {
    period: { start: movimentacao.firstDate!, end: movimentacao.lastDate! },
    tickers: tickers.filter(accepted),
    inserts,
  };
}
```

Importe `PlannedDividend` e `PlannedDividends` no bloco `import type { … } from "./types"`.

No `return` do `planB3Import`, depois de `check:`, acrescente:

```ts
    dividends: extractDividends(movimentacao, accepted, [...tickers].sort()),
```

O `planB3Import` já garante que `firstDate` e `lastDate` existem, porque lança erro antes se faltarem.

- [ ] **Step 3: tirar os proventos da prévia em `b3-import.ts`**

O `withoutEntries` monta o objeto campo a campo, então o campo novo já não vaza para a prévia. Mude só o tipo de retorno para `Omit<B3ImportPlan, "inserts" | "removeIds" | "dividends">`. Até a Task 3, o `previewB3Import` devolve `dividendChanges: { added: 0, removed: 0, unchanged: 0 }`.

- [ ] **Step 4: script de conferência (só leitura)**

Grave no scratchpad o arquivo `check-plan-dividends.ts`:

```ts
import readXlsxFile from "read-excel-file/node";
import { readCatalogTypes } from "D:/workspace/koinos/src/features/market-data/server";
import {
  planB3Import,
  readMovimentacao,
  readNegociacao,
  type SheetInput,
} from "D:/workspace/koinos/src/features/transactions/index";

const sheets = async (path: string) => (await readXlsxFile(path)) as unknown as SheetInput[];
const plan = planB3Import({
  negociacao: readNegociacao(await sheets("D:/Downloads/negociacao-2026-10-17-19-40-57.xlsx")),
  movimentacao: readMovimentacao(await sheets("D:/Downloads/movimentacao-2026-10-17-19-39-54.xlsx")),
  planilha: null,
  existing: [],
  assetTypes: await readCatalogTypes(),
});
const by = (kind: string) => plan.dividends.inserts.filter((item) => item.kind === kind);
const sum = (list: { amount: number }[]) => list.reduce((s, i) => s + i.amount, 0).toFixed(2);
console.log("RENDIMENTO", by("RENDIMENTO").length, sum(by("RENDIMENTO")));
console.log("REEMBOLSO", by("REEMBOLSO").length, sum(by("REEMBOLSO")));
console.log("período", plan.dividends.period, "FIIs", plan.dividends.tickers.length);
console.log("status != OK", plan.tickers.filter((t) => t.status !== "OK").map((t) => `${t.ticker}:${t.status}`));
process.exit(0);
```

Run: `npx tsx --conditions=react-server --env-file=.env.local <scratchpad>/check-plan-dividends.ts`

Expected:
- `RENDIMENTO 1290 290564.42` e `REEMBOLSO 61 7845.88`;
- ou uma diferença explicada pelos FIIs com status diferente de OK, que também são impressos. Sem as respostas das pendências, alguns FIIs ficam PENDENTE.

Se a contagem bater só quando há respostas, rode de novo com o arquivo de respostas usado na carga (`answers` no `planB3Import`), lido de onde o `scripts/import-b3.ts` o lê.

- [ ] **Step 5: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
git add src/features/transactions
git commit -m "feat(import): extract Rendimento and Reembolso credits as dividends in the B3 plan"
```

---

### Task 3: gravar os proventos (modelo, repositório, importação e script)

**Goal:** gravar os proventos na coleção `dividends`, na mesma transação dos lançamentos. A regra "A B3 manda" vale no período e por FII, e reenviar o mesmo extrato não grava nada.

**Files:**
- Create: `src/features/transactions/server/dividend.model.ts`
- Create: `src/features/transactions/server/dividend-repo.ts`
- Modify: `src/features/transactions/server/transaction-repo.ts`
- Modify: `src/features/transactions/server/b3-import.ts`
- Modify: `src/features/transactions/server/transactions-dal.ts`
- Modify: `src/features/transactions/server.ts`
- Modify: `src/features/transactions/repo.ts`
- Modify: `src/features/transactions/components/b3-import/preview-sections.tsx`
- Modify: `scripts/import-b3.ts`

**Acceptance Criteria:**
- [ ] A coleção `dividends` tem o índice `{ portfolioId: 1, ticker: 1, paidAt: 1 }`.
- [ ] Toda consulta e toda remoção filtram por `portfolioId`.
- [ ] Uma importação em `koinos_preview` grava 1.284 proventos (ou o número que a Task 2 explicou).
- [ ] Reimportar os mesmos arquivos dá `dividendChanges = { added: 0, removed: 0 }` e não grava nada.
- [ ] A prévia mostra "N proventos novos · N saem · N já iguais".
- [ ] O script `import:b3` imprime e grava os proventos.

**Verify:** `npx tsx --conditions=react-server --env-file=.env.local <scratchpad>/check-import-dividends.ts`, com `MONGODB_URI` apontando para `koinos_preview`, imprime a primeira importação e depois `reenvio: 0 novos, 0 saem`.

**Steps:**

- [ ] **Step 1: criar `dividend.model.ts`**

```ts
import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";
import { DIVIDEND_KINDS, type DividendKind } from "../domain/types";

export interface DividendDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  ticker: string;
  paidAt: Date;
  kind: DividendKind;
  amount: number;
  quantity: number | null;
  perShare: number | null;
  source: "B3";
  createdAt: Date;
  updatedAt: Date;
}

const dividendSchema = new Schema<DividendDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z0-9]{4}11$/ },
    paidAt: { type: Date, required: true },
    kind: { type: String, required: true, enum: DIVIDEND_KINDS },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: null },
    perShare: { type: Number, default: null },
    source: { type: String, required: true, enum: ["B3"], default: "B3" },
  },
  { timestamps: true },
);

dividendSchema.index({ portfolioId: 1, ticker: 1, paidAt: 1 });

export const DividendModel: Model<DividendDoc> =
  (mongoose.models.Dividend as Model<DividendDoc> | undefined) ??
  mongoose.model<DividendDoc>("Dividend", dividendSchema, "dividends");
```

- [ ] **Step 2: criar `dividend-repo.ts`**

```ts
import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import type { DividendEntry } from "../domain/types";
import { DividendModel, type DividendDoc } from "./dividend.model";

// Mesmo padrão do transaction-repo: o portfolioId explícito vai em todos os filtros.

export async function listDividends(portfolioId: string): Promise<DividendEntry[]> {
  await connectMongo();
  const docs = await DividendModel.find({ portfolioId: new Types.ObjectId(portfolioId) })
    .sort({ paidAt: -1 })
    .lean<DividendDoc[]>();
  return docs.map((doc) => ({
    ticker: doc.ticker,
    paidAt: doc.paidAt,
    kind: doc.kind,
    amount: doc.amount,
    quantity: doc.quantity ?? null,
    perShare: doc.perShare ?? null,
  }));
}
```

- [ ] **Step 3: trocar os proventos na transação de `applyTransactionChanges`**

Em `transaction-repo.ts`, importe `DividendModel` e `PlannedDividends`:

```ts
import { DividendModel } from "./dividend.model";
import type { PlannedDividends } from "../import/b3/types";
```

Acrescente ao objeto `changes` o campo opcional `dividends?: PlannedDividends;`. O retorno passa a ser `{ removed: number; inserted: number; dividendsRemoved: number; dividendsInserted: number }`.

Dentro do `session.withTransaction`, depois dos inserts de lançamentos:

```ts
      dividendsRemoved = 0;
      dividendsInserted = 0;
      if (changes.dividends && changes.dividends.tickers.length > 0) {
        const { period, tickers, inserts } = changes.dividends;
        const result = await DividendModel.deleteMany(
          {
            portfolioId: owner,
            ticker: mongoose.trusted({ $in: tickers }),
            paidAt: mongoose.trusted({ $gte: period.start, $lte: period.end }),
          },
          { session },
        );
        dividendsRemoved = result.deletedCount;
        if (inserts.length > 0) {
          const docs = await DividendModel.insertMany(
            inserts.map((item) => ({ ...item, portfolioId: owner, source: "B3" })),
            { session },
          );
          dividendsInserted = docs.length;
        }
      }
```

Declare `let dividendsRemoved = 0; let dividendsInserted = 0;` ao lado de `removed` e `inserted` e devolva os quatro números.

- [ ] **Step 4: comparação e confirmação em `b3-import.ts`**

Importe `listDividends` de `./dividend-repo` e o tipo `DividendEntry` de `../domain/types`. Em `buildPlan`, carregue os proventos em paralelo:

```ts
  const [existing, existingDividends, assetTypes] = await Promise.all([
    listTransactions(tenant.portfolioId),
    listDividends(tenant.portfolioId),
    readCatalogTypes(),
  ]);
```

Devolva também `existingDividends` no objeto de retorno. Depois, acrescente:

```ts
const dividendSignature = (item: DividendEntry) =>
  [
    item.ticker,
    item.paidAt.toISOString(),
    item.kind,
    item.amount,
    item.quantity ?? "",
    item.perShare ?? "",
  ].join("|");

/** Quantos proventos realmente mudam no escopo da troca (FIIs aceitos, no período). */
function compareDividends(
  plan: B3ImportPlan,
  existing: readonly DividendEntry[],
): B3DividendChanges {
  const { period, tickers, inserts } = plan.dividends;
  const scope = new Set(tickers);
  const pool = new Map<string, number>();
  let inScope = 0;
  for (const item of existing) {
    if (!scope.has(item.ticker) || item.paidAt < period.start || item.paidAt > period.end) continue;
    inScope++;
    const key = dividendSignature(item);
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  let unchanged = 0;
  for (const item of inserts) {
    const key = dividendSignature(item);
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      unchanged++;
    }
  }
  return { added: inserts.length - unchanged, removed: inScope - unchanged, unchanged };
}
```

Importe `B3DividendChanges` com os outros tipos de `../import/b3/types`.

No `previewB3Import`, desestruture `existingDividends` e devolva `dividendChanges: compareDividends(plan, existingDividends)`.

No `confirmB3Import`, troque a condição de "nada mudou" e a chamada:

```ts
    const changes = compare(plan, existing);
    const dividendChanges = compareDividends(plan, existingDividends);
    const nothing =
      changes.added === 0 &&
      changes.removed === 0 &&
      dividendChanges.added === 0 &&
      dividendChanges.removed === 0;
    if (nothing) return { removed: 0, inserted: 0, dividendsInserted: 0 };
    const applied = await applyTransactionChanges(tenant.portfolioId, {
      removeIds: plan.removeIds,
      inserts: plan.inserts,
      source: "B3",
      dividends: plan.dividends,
    });
    return {
      removed: applied.removed,
      inserted: applied.inserted,
      dividendsInserted: applied.dividendsInserted,
    };
```

Mude o tipo de retorno de `confirmB3Import` para `Promise<{ removed: number; inserted: number; dividendsInserted: number }>`. Depois rode `grep -rn "confirmB3Import" src` e ajuste quem lê o resultado, a action e o wizard. A mensagem de sucesso do wizard pode citar os proventos: `${inserted} lançamentos e ${dividendsInserted} proventos gravados`.

- [ ] **Step 5: DAL e exportações**

Em `transactions-dal.ts`, acrescente:

```ts
import type { DividendEntry } from "../domain/types";
import { listDividends } from "./dividend-repo";

/** Proventos recebidos do usuário logado (vindos dos extratos da B3). */
export const getMyDividends = cache(async (): Promise<DividendEntry[]> =>
  listDividends((await getTenant()).portfolioId),
);
```

Em `server.ts`, exporte `getMyDividends`. Em `repo.ts`, exporte `listDividends` de `./server/dividend-repo`, para os scripts.

- [ ] **Step 6: prévia**

Em `preview-sections.tsx`, logo depois do `<p>` de lançamentos novos, acrescente:

```tsx
        <p>
          <strong>{formatQuantity(preview.dividendChanges.added)}</strong> proventos novos ·{" "}
          <strong>{formatQuantity(preview.dividendChanges.removed)}</strong> saem ·{" "}
          {formatQuantity(preview.dividendChanges.unchanged)} já iguais
        </p>
```

- [ ] **Step 7: script `import-b3.ts`**

Depois da linha `Por tipo (todos os FIIs)`, acrescente:

```ts
  console.log(
    `Proventos: ${plan.dividends.inserts.length} (R$ ${plan.dividends.inserts.reduce((s, i) => s + i.amount, 0).toFixed(2)}) em ${plan.dividends.tickers.length} FIIs`,
  );
```

Na chamada de `applyTransactionChanges` do script, passe `dividends: plan.dividends`. Assim, quando a importação não é `--dry-run`, os proventos também são gravados.

- [ ] **Step 8: conferência em `koinos_preview`**

Grave no scratchpad o arquivo `check-import-dividends.ts`. Ele reusa o seed da preview (`aporte/seed-preview.ts`, que cria o usuário de teste e o tenant) e chama o mesmo caminho do serviço: `planB3Import`, depois `applyTransactionChanges` com `dividends`, depois `listDividends`.

```ts
import readXlsxFile from "read-excel-file/node";
import { readCatalogTypes } from "D:/workspace/koinos/src/features/market-data/server";
import {
  planB3Import,
  readMovimentacao,
  readNegociacao,
  type SheetInput,
} from "D:/workspace/koinos/src/features/transactions/index";
import {
  applyTransactionChanges,
  listDividends,
  listTransactions,
} from "D:/workspace/koinos/src/features/transactions/repo";

if (!process.env.MONGODB_URI?.includes("koinos_preview")) throw new Error("use koinos_preview");
const portfolioId = process.argv[2]!;
const sheets = async (path: string) => (await readXlsxFile(path)) as unknown as SheetInput[];
const negociacao = readNegociacao(await sheets("D:/Downloads/negociacao-2026-10-17-19-40-57.xlsx"));
const movimentacao = readMovimentacao(await sheets("D:/Downloads/movimentacao-2026-10-17-19-39-54.xlsx"));
const assetTypes = await readCatalogTypes();
for (const round of ["primeira", "reenvio"]) {
  const existing = await listTransactions(portfolioId);
  const before = await listDividends(portfolioId);
  const plan = planB3Import({ negociacao, movimentacao, planilha: null, existing, assetTypes });
  const result = await applyTransactionChanges(portfolioId, {
    removeIds: plan.removeIds,
    inserts: plan.inserts,
    source: "B3",
    dividends: plan.dividends,
  });
  const after = await listDividends(portfolioId);
  console.log(round, { antes: before.length, depois: after.length, ...result });
}
process.exit(0);
```

Run:
- `node <scratchpad>/aporte/env-exports.mjs` para obter a URI da preview;
- depois `MONGODB_URI=<uri preview> npx tsx --conditions=react-server --env-file=.env.local <scratchpad>/check-import-dividends.ts <portfolioId do seed>`.

Expected: nas duas rodadas, `depois` é igual (1.284), e o total não cresce no reenvio. A comparação por assinatura que evita a gravação está no serviço e é conferida pela tela na Task 7.

- [ ] **Step 9: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
git add src/features/transactions scripts/import-b3.ts
git commit -m "feat(import): persist B3 dividends in the import transaction with no-op re-upload"
```

---

### Task 4: anúncios de proventos do Yahoo

**Goal:** o `refreshDividends` passa a guardar no ativo os anúncios dos últimos 90 dias, e o snapshot os recebe pelo `PriceInfo`.

**Files:**
- Modify: `src/features/market-data/server/models.ts`
- Modify: `src/features/market-data/server/history-service.ts`
- Modify: `src/features/market-data/server/assets-read.ts`
- Modify: `src/features/portfolio/server/snapshot.ts`

**Acceptance Criteria:**
- [ ] O `AssetDoc.dividendAnnouncements` guarda `{ exDate, perShare }[]` com data ex nos últimos 90 dias. A data ex vem normalizada para meia-noite UTC do dia em São Paulo.
- [ ] Depois de rodar `refreshDividends(["MXRF11","HGLG11"], now, { force: true })` na preview, os dois ativos têm o anúncio de 01/10/2026.
- [ ] `getAssetSnapshots` e `toPriceInfo` expõem os anúncios.

**Verify:** `npx tsx --conditions=react-server --env-file=.env.local <scratchpad>/check-announcements.ts`, com `MONGODB_URI` apontando para `koinos_preview`, imprime os anúncios de MXRF11 e HGLG11.

**Steps:**

- [ ] **Step 1: modelo**

Em `AssetDoc`, acrescente:

```ts
  /** Anúncios dos últimos 90 dias (Yahoo): data ex e valor por cota. */
  dividendAnnouncements?: { exDate: Date; perShare: number }[];
```

No schema, depois de `lastDividend`, acrescente:

```ts
    dividendAnnouncements: {
      type: [new Schema({ exDate: Date, perShare: Number }, { _id: false })],
      default: [],
    },
```

- [ ] **Step 2: `refreshDividends`**

Em `history-service.ts`:
- importe `todayTradeDate` de `@/shared/lib/time`;
- acrescente a constante `const ANNOUNCEMENT_WINDOW_MS = 90 * 86_400_000;`;
- acrescente o terceiro parâmetro opcional `options: { force?: boolean } = {}`, e no filtro `due` use `options.force ||` antes da checagem de 20 h.

No `$set`, acrescente:

```ts
              dividendAnnouncements: dividends
                .filter(
                  (dividend) =>
                    dividend.exDate.getTime() >= now.getTime() - ANNOUNCEMENT_WINDOW_MS,
                )
                .map((dividend) => ({
                  exDate: todayTradeDate(dividend.exDate),
                  perShare: dividend.amount,
                })),
```

O `todayTradeDate` converte o horário do Yahoo, como 13:00Z, para a data de São Paulo à meia-noite UTC, no mesmo formato das datas de negócio.

- [ ] **Step 3: leitura**

Em `assets-read.ts`, acrescente `dividendAnnouncements: { exDate: Date; perShare: number }[];` ao `AssetSnapshot`. No map, use:

```ts
        dividendAnnouncements: (doc.dividendAnnouncements ?? []).map((item) => ({
          exDate: item.exDate,
          perShare: item.perShare,
        })),
```

Em `portfolio/server/snapshot.ts`, troque `dividendAnnouncements: []` por `dividendAnnouncements: asset.dividendAnnouncements`.

- [ ] **Step 4: conferência**

Grave no scratchpad o arquivo `check-announcements.ts`:

```ts
import { getAssetSnapshots, refreshDividends } from "D:/workspace/koinos/src/features/market-data/server";
if (!process.env.MONGODB_URI?.includes("koinos_preview")) throw new Error("use koinos_preview");
await refreshDividends(["MXRF11", "HGLG11"], new Date(), { force: true });
const snaps = await getAssetSnapshots(["MXRF11", "HGLG11"]);
for (const [t, s] of snaps) console.log(t, s.dividendAnnouncements.map((a) => [a.exDate.toISOString().slice(0, 10), a.perShare]));
process.exit(0);
```

Expected: `MXRF11 [["2026-08-03",0.1],["2026-09-01",0.1],["2026-10-01",0.1]]`, e o equivalente para o HGLG11 com 1,17.

- [ ] **Step 5: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
git add src/features/market-data src/features/portfolio/server/snapshot.ts
git commit -m "feat(market-data): keep recent Yahoo dividend announcements per asset"
```

---

### Task 5: resultado ajustado no snapshot e no Dashboard

**Goal:** cada posição (aberta ou encerrada) e o resumo da carteira passam a ter proventos, resultado com proventos e resultado total. O Dashboard mostra esses números.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/domain/snapshot.ts`
- Modify: `src/features/portfolio/server/snapshot.ts`
- Modify: `src/features/portfolio/components/summary-cards.tsx`
- Modify: `src/features/portfolio/components/positions-table.tsx`
- Modify: `src/features/portfolio/components/closed-positions.tsx`

**Acceptance Criteria:**
- [ ] `PositionRow` tem `dividends`, `pnlWithDividends` e `totalResult`. `ClosedPosition` tem `dividends` e `totalResult`.
- [ ] `PortfolioSummary` tem `dividendsReceived`, `pnlWithDividends` e `totalResult`.
- [ ] Na carteira, `totalResult` = pnl + proventos de todos os FIIs + realizado.
- [ ] O `cascadeInput` e o `monthlyIncome` continuam idênticos aos de antes.
- [ ] O Dashboard mostra:
  - o card "Proventos recebidos";
  - as colunas "Proventos" e "Resultado c/ proventos", com o tooltip da conta;
  - os proventos e o total nas posições encerradas.

**Verify:** um script descartável compara `buildSnapshot` com e sem proventos sobre os lançamentos de produção (só leitura). O `cascadeInput` e o `monthlyIncome` precisam ser iguais, e o `totalResult` precisa bater com a soma manual.

**Steps:**

- [ ] **Step 1: tipos**

Em `PositionRow`, depois de `pnlPct`, acrescente:

```ts
  /** Proventos recebidos deste FII desde sempre. */
  dividends: number;
  /** L/P da cotação + proventos. */
  pnlWithDividends: number;
  /** L/P da cotação + proventos + vendas. */
  totalResult: number;
  realizedPnL: number;
```

Troque o `ClosedPosition`:

```ts
export type ClosedPosition = {
  ticker: string;
  realizedPnL: number;
  dividends: number;
  totalResult: number;
  lastDate: Date;
};
```

Em `PortfolioSummary`, acrescente `dividendsReceived: number; pnlWithDividends: number; totalResult: number;`.

- [ ] **Step 2: `buildSnapshot`**

- Acrescente ao `SnapshotInput`: `dividends: readonly DividendEntry[];` (importe o tipo de `@/features/transactions`).
- Importe `adjustedResult` e `dividendsByTicker` de `./dividends`.
- No início da função, depois do `replayLedger`: `const received = dividendsByTicker(dividends);`.

No resumo:

```ts
  const realizedPnL = positions.reduce((sum, position) => sum + position.realizedPnL, 0);
  const dividendsReceived = [...received.values()].reduce((sum, value) => sum + value, 0);
  const portfolioAdjusted = adjustedResult(patrimony - invested, dividendsReceived, realizedPnL);
```

Use `realizedPnL` no campo que já existe e acrescente `dividendsReceived`, `pnlWithDividends: portfolioAdjusted.withDividends` e `totalResult: portfolioAdjusted.total`.

Em cada `PositionRow`:

```ts
      const pnl = value - position.totalCost;
      const dividendsOf = received.get(position.ticker) ?? 0;
      const adjusted = adjustedResult(pnl, dividendsOf, position.realizedPnL);
```

Use `pnl` no campo e acrescente `dividends: dividendsOf`, `pnlWithDividends: adjusted.withDividends`, `totalResult: adjusted.total` e `realizedPnL: position.realizedPnL`.

No `closed`:

```ts
      .map((position) => {
        const dividendsOf = received.get(position.ticker) ?? 0;
        return {
          ticker: position.ticker,
          realizedPnL: position.realizedPnL,
          dividends: dividendsOf,
          totalResult: adjustedResult(0, dividendsOf, position.realizedPnL).total,
          lastDate: position.lastDate,
        };
      })
```

- [ ] **Step 3: servidor**

Em `portfolio/server/snapshot.ts`, carregue os proventos junto com os lançamentos e as metas e passe ao snapshot:

```ts
  const [transactions, targets, dividends] = await Promise.all([
    getMyTransactions(),
    getMyTargetAssets(),
    getMyDividends(),
  ]);
  // ...
  return buildSnapshot({
    now: new Date(),
    transactions,
    targets,
    dividends,
    prices: toPriceInfo(assets),
  });
```

Importe `getMyDividends` de `@/features/transactions/server`.

- [ ] **Step 4: card de resumo**

Em `summary-cards.tsx`, troque o grid por `md:grid-cols-2 xl:grid-cols-5`. Acrescente, depois do card de L/P:

```tsx
      <Card className="card-lift">
        <CardHeader>
          <CardDescription>Proventos recebidos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatBRL(summary.dividendsReceived)}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground">
          <span>
            L/P c/ proventos <Delta value={summary.pnlWithDividends} />
          </span>
          <span>
            Resultado total <Delta value={summary.totalResult} />
          </span>
        </CardContent>
      </Card>
```

- [ ] **Step 5: colunas novas na tabela de posições**

Em `positions-table.tsx`:
- acrescente `"proventos"` e `"ajustado"` ao `SORT_KEYS`, depois de `"lp"`;
- no `SORT_VALUE`, acrescente `proventos: (row) => row.dividends` e `ajustado: (row) => row.pnlWithDividends`;
- no `COLUMNS`, depois de `lp`, acrescente:

```ts
  { key: "proventos", label: "Proventos", align: "right" },
  { key: "ajustado", label: "Resultado c/ proventos", align: "right" },
```

No corpo da tabela, depois da célula de L/P:

```tsx
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.dividends)}
                </TableCell>
                <TableCell className="text-right">
                  <AdjustedCell row={row} />
                </TableCell>
```

E o componente, acima do `PositionsTable`:

```tsx
function AdjustedCell({ row }: { row: PositionRow }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Delta value={row.pnlWithDividends} />
      </TooltipTrigger>
      <TooltipContent>
        <div className="grid gap-0.5 tabular-nums">
          <span>Cotação {formatBRL(row.pnl)}</span>
          <span>+ Proventos {formatBRL(row.dividends)}</span>
          <span>= Com proventos {formatBRL(row.pnlWithDividends)}</span>
          <span>+ Vendas {formatBRL(row.realizedPnL)}</span>
          <span className="font-medium">= Resultado total {formatBRL(row.totalResult)}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 6: posições encerradas**

Em `closed-positions.tsx`:
- some `const dividends = rows.reduce((sum, row) => sum + row.dividends, 0);` e `const result = rows.reduce((sum, row) => sum + row.totalResult, 0);`;
- no `summary`, troque o span final por `<span className="ml-auto font-normal">Realizado <Delta value={total} /> · Proventos {formatBRL(dividends)} · Total <Delta value={result} /></span>`;
- em cada `li`, troque o span final por `<span className="ml-auto flex gap-4"><span className="text-muted-foreground tabular-nums">{formatBRL(row.dividends)}</span><Delta value={row.totalResult} /></span>`;
- importe `formatBRL`.

- [ ] **Step 7: conferência (só leitura em produção)**

Grave no scratchpad o arquivo `check-snapshot.ts`. Ele lê os lançamentos e as metas do portfolio de produção pelos repos (`listTransactions`, e os targets via `@/features/strategy/repo`) e os proventos da preview (ou `[]` se a produção ainda não tiver nenhum). Depois:
- roda `buildSnapshot` duas vezes, com `dividends: []` e com a lista;
- compara `JSON.stringify(cascadeInput)` e `monthlyIncome` entre as duas rodadas;
- imprime `summary.totalResult` e `summary.pnl + summary.dividendsReceived + summary.realizedPnL`.

Expected: as duas comparações dão `true`, e os dois totais são iguais.

- [ ] **Step 8: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
git add src/features/portfolio
git commit -m "feat(portfolio): dividends and adjusted results on positions and summary"
```

---

### Task 6: tela `/proventos`

**Goal:** criar a página `/proventos`, com os cards do mês, a lista "A receber" e o histórico com as abas Mês | Ano | Papel, mais o item no menu lateral.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/server/snapshot.ts`
- Modify: `src/features/portfolio/server.ts`
- Create: `src/features/portfolio/components/dividends/month-cards.tsx`
- Create: `src/features/portfolio/components/dividends/upcoming-list.tsx`
- Create: `src/features/portfolio/components/dividends/dividends-history.tsx`
- Create: `src/features/portfolio/components/dividends/empty-dividends.tsx`
- Modify: `src/features/portfolio/ui.ts`
- Create: `src/app/(app)/proventos/page.tsx`
- Modify: `src/shared/components/app-sidebar.tsx`

**Acceptance Criteria:**
- [ ] `/proventos` mostra os cards Recebido, A receber (estimado) e Total do mês.
- [ ] A lista "A receber" mostra FII, data ex, cotas, valor por cota, valor e pagamento ~ até.
- [ ] As abas Mês | Ano | Papel trocam a URL (`?agrupar=mes|ano|papel`).
- [ ] A aba Mês tem o gráfico dos últimos 24 meses e a tabela que se expande por FII.
- [ ] Sem proventos e sem "a receber", a página mostra o vazio com "Importar da B3".
- [ ] O menu lateral tem "Proventos" depois de "Transações", e o item fica ativo em `/proventos`.
- [ ] `npm run build` passa: a página prerenderiza a casca e transmite o conteúdo.

**Verify:** `npm run build` termina sem erro, e na preview isolada (Task 7) as três abas renderizam.

**Steps:**

- [ ] **Step 1: DTO e leitura**

Em `portfolio/domain/types.ts`, acrescente:

```ts
export type DividendsView = {
  month: DividendMonthSummary;
  upcoming: (UpcomingDividend & { name: string | null; logoUrl: string | null })[];
  byMonth: DividendMonthGroup[];
  byYear: DividendYearGroup[];
  byTicker: (DividendTickerGroup & { name: string | null; logoUrl: string | null })[];
  /** Os últimos 24 meses, com zero nos meses sem provento (para o gráfico). */
  chart: { month: string; amount: number }[];
  hasAny: boolean;
};
```

Em `portfolio/server/snapshot.ts`, acrescente:

```ts
const DIVIDEND_CHART_MONTHS = 24;

/** Tela de proventos: recebidos (B3), a receber (Yahoo) e os agrupamentos. */
export async function getDividendsView(): Promise<DividendsView> {
  await connection();
  const now = new Date();
  const [transactions, received] = await Promise.all([getMyTransactions(), getMyDividends()]);
  const tickers = [
    ...new Set([...transactions.map((t) => t.ticker), ...received.map((d) => d.ticker)]),
  ];
  const assets = await getAssetSnapshots(tickers);
  const announcements = new Map(
    [...assets].map(([ticker, asset]) => [ticker, asset.dividendAnnouncements]),
  );
  const meta = (ticker: string) => ({
    name: assets.get(ticker)?.name ?? null,
    logoUrl: assets.get(ticker)?.logoUrl ?? null,
  });
  const upcoming = upcomingDividends({ now, transactions, received, announcements });
  const byMonth = groupByMonth(received);
  const totals = new Map(byMonth.map((group) => [group.month, group.total]));
  const nowMonth = currentMonthKey(now);
  return {
    month: monthSummary(now, received, upcoming),
    upcoming: upcoming.map((item) => ({ ...item, ...meta(item.ticker) })),
    byMonth,
    byYear: groupByYear(received),
    byTicker: groupByTicker(received).map((item) => ({ ...item, ...meta(item.ticker) })),
    chart: monthRange(addMonths(nowMonth, -(DIVIDEND_CHART_MONTHS - 1)), nowMonth).map(
      (month) => ({ month, amount: totals.get(month) ?? 0 }),
    ),
    hasAny: received.length > 0 || upcoming.length > 0,
  };
}
```

Importe:
- de `../domain/dividends`: `groupByMonth`, `groupByTicker`, `groupByYear`, `monthSummary` e `upcomingDividends`;
- de `@/shared/lib/time`: `addMonths` e `monthRange`;
- o tipo `DividendsView`.

Exporte `getDividendsView` em `portfolio/server.ts`. Exporte o tipo `DividendsView` em `portfolio/index.ts`.

- [ ] **Step 2: `month-cards.tsx` (Server Component)**

```tsx
import { formatBRL, formatMonth } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { DividendMonthSummary } from "../../domain/types";

export function DividendMonthCards({ month }: { month: DividendMonthSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="card-lift">
        <CardHeader>
          <CardDescription>Recebido em {formatMonth(month.month)}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatBRL(month.received)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Pelo extrato da B3.</CardContent>
      </Card>
      <Card className="card-lift">
        <CardHeader>
          <CardDescription>A receber (estimado)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatBRL(month.upcoming)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Previsão pelo Yahoo, confirmada quando o extrato da B3 for importado.
        </CardContent>
      </Card>
      <Card className="metal-ring card-lift brushed">
        <CardHeader>
          <CardDescription>Total do mês</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {formatBRL(month.total)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Recebido + a receber.</CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: `upcoming-list.tsx` (Server Component)**

```tsx
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";

export function UpcomingDividends({ rows }: { rows: DividendsView["upcoming"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A receber</CardTitle>
        <CardDescription>
          Cotas na véspera da data ex × valor anunciado. A data de pagamento é estimada.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nenhum provento anunciado a receber.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">FII</TableHead>
                <TableHead>Data ex</TableHead>
                <TableHead className="text-right">Cotas</TableHead>
                <TableHead className="text-right">Por cota</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="pr-6 text-right">Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.ticker}-${row.exDate.toISOString()}`}>
                  <TableCell className="pl-6">
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell>{formatTradeDate(row.exDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(row.perShare)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(row.amount)}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-muted-foreground">
                    ~ até {formatTradeDate(row.payBy)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

`TableHead` já é exportado por `src/shared/ui/table.tsx`.

- [ ] **Step 4: `dividends-history.tsx` (Client Component)**

```tsx
"use client";

import { ChevronDownIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatCompactBRL, formatMonth, formatTradeDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { DividendsView } from "../../domain/types";
import { ChartTooltipRow } from "../chart-tooltip-row";

const GROUPINGS = ["mes", "ano", "papel"] as const;
const LABELS: Record<(typeof GROUPINGS)[number], string> = {
  mes: "Mês",
  ano: "Ano",
  papel: "Papel",
};
const config = { amount: { label: "Proventos", color: "var(--chart-2)" } } satisfies ChartConfig;

export function DividendsHistory({ view }: { view: DividendsView }) {
  const [grouping, setGrouping] = useQueryState(
    "agrupar",
    parseAsStringLiteral(GROUPINGS).withDefault("mes").withOptions({ history: "replace" }),
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Histórico de proventos</CardTitle>
          <CardDescription>Recebidos, pelos extratos da B3.</CardDescription>
        </div>
        <div role="tablist" aria-label="Agrupar por" className="flex gap-1">
          {GROUPINGS.map((key) => (
            <Button
              key={key}
              role="tab"
              aria-selected={grouping === key}
              size="sm"
              variant={grouping === key ? "default" : "outline"}
              onClick={() => void setGrouping(key)}
            >
              {LABELS[key]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className={cn(grouping !== "mes" && "px-0")}>
        {grouping === "mes" ? <ByMonth view={view} /> : null}
        {grouping === "ano" ? <ByYear rows={view.byYear} /> : null}
        {grouping === "papel" ? <ByTicker rows={view.byTicker} /> : null}
      </CardContent>
    </Card>
  );
}

function ByMonth({ view }: { view: DividendsView }) {
  return (
    <div className="grid gap-4">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={view.chart} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactBRL(value)}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(month) => formatMonth(String(month))}
                formatter={(value) => (
                  <ChartTooltipRow
                    color="var(--color-amount)"
                    label="Proventos"
                    value={formatBRL(Number(value))}
                  />
                )}
              />
            }
          />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>
      <ul className="grid gap-1 text-sm">
        {view.byMonth.map((group) => (
          <li key={group.month}>
            <details className="group rounded-md px-2 py-1.5 open:bg-muted/40">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                <span className="font-medium">{formatMonth(group.month)}</span>
                <span className="text-muted-foreground">{group.byTicker.length} FIIs</span>
                <span className="ml-auto tabular-nums">{formatBRL(group.total)}</span>
              </summary>
              <ul className="mt-2 grid gap-1 pl-6">
                {group.byTicker.map((item) => (
                  <li key={item.ticker} className="flex text-muted-foreground">
                    <span className="w-20">{item.ticker}</span>
                    <span className="ml-auto tabular-nums">{formatBRL(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ByYear({ rows }: { rows: DividendsView["byYear"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Ano</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Meses com provento</TableHead>
          <TableHead className="pr-6 text-right">Média mensal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.year}>
            <TableCell className="pl-6 font-medium">{row.year}</TableCell>
            <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.months}</TableCell>
            <TableCell className="pr-6 text-right tabular-nums">
              {formatBRL(row.monthlyAverage)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ByTicker({ rows }: { rows: DividendsView["byTicker"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">FII</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Pagamentos</TableHead>
          <TableHead className="pr-6 text-right">Último</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.ticker}>
            <TableCell className="pl-6">
              <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatBRL(row.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.payments}</TableCell>
            <TableCell className="pr-6 text-right">{formatTradeDate(row.lastPaidAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Os `Date` chegam do Server Component pelo RSC, como já acontece em `ClosedPositions` e no `QuoteRefresher`.

- [ ] **Step 5: `empty-dividends.tsx`**

```tsx
import { CoinsIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";

export function EmptyDividends() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CoinsIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum provento ainda</EmptyTitle>
        <EmptyDescription>
          Os proventos recebidos vêm do extrato de Movimentação da B3. Importe os extratos para ver
          o histórico.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/transacoes/importar" />}>Importar da B3</Button>
      </EmptyContent>
    </Empty>
  );
}
```

- [ ] **Step 6: exportar em `ui.ts`**

```ts
export { DividendMonthCards } from "./components/dividends/month-cards";
export { DividendsHistory } from "./components/dividends/dividends-history";
export { EmptyDividends } from "./components/dividends/empty-dividends";
export { UpcomingDividends } from "./components/dividends/upcoming-list";
```

- [ ] **Step 7: rota `src/app/(app)/proventos/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { getDividendsView } from "@/features/portfolio/server";
import {
  DividendMonthCards,
  DividendsHistory,
  EmptyDividends,
  UpcomingDividends,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { DashboardSkeleton } from "@/shared/components/skeletons";

export const metadata: Metadata = { title: "Proventos" };

export default function DividendsPage() {
  return (
    <>
      <PageHeader title="Proventos" description="Recebidos, a receber e o histórico." />
      <Suspense fallback={<DashboardSkeleton />}>
        <DividendsContent />
      </Suspense>
    </>
  );
}

async function DividendsContent() {
  const view = await getDividendsView();
  if (!view.hasAny) return <EmptyDividends />;
  return (
    <div className="grid gap-6">
      <DividendMonthCards month={view.month} />
      <UpcomingDividends rows={view.upcoming} />
      <DividendsHistory view={view} />
    </div>
  );
}
```

O `DividendsHistory` usa `useQueryState`. Se o build reclamar que `useSearchParams` precisa de Suspense, ele já está dentro do `<Suspense>` do `DividendsContent`.

- [ ] **Step 8: menu lateral**

Em `app-sidebar.tsx`, importe `HandCoinsIcon` de `lucide-react` (o `CoinsIcon` já é a marca do app) e acrescente, depois do item de Transações:

```ts
  {
    href: "/proventos",
    label: "Proventos",
    icon: HandCoinsIcon,
    tile: "[--tile:var(--tile-teal)]",
  },
```

Em `src/app/globals.css`, ao lado de `--tile-green` (linha ~161), acrescente `--tile-teal: linear-gradient(180deg, #40c8e0, #0a9bb5);`. Se os tiles forem redefinidos no tema escuro, acrescente lá também, no mesmo padrão.

- [ ] **Step 9: build, lint, typecheck e commit**

```bash
npm run format && npm run lint && npm run typecheck && npm run build
git add src/features/portfolio src/app/\(app\)/proventos src/shared/components/app-sidebar.tsx src/app/globals.css
git commit -m "feat(dividends): /proventos page with month totals, upcoming list and history"
```

---

### Task 7: verificação ponta a ponta na preview isolada

**Goal:** conferir na preview isolada (`koinos_preview`), com os extratos reais, os critérios de sucesso do spec. Isso inclui a tela de upload, o reenvio sem mudança, a tela `/proventos` e o Dashboard.

**Files:**
- Nenhum arquivo do repositório. Os scripts ficam no scratchpad: `aporte/seed-preview.ts`, `shots-tool/upload-b3.mjs`, `shots-tool/shoot-all.mjs` e `shots-tool/contrast.mjs`.

**Acceptance Criteria:**
- [ ] O upload pela tela mostra a prévia com "1.284 proventos novos" (ou o número explicado na Task 2), e a confirmação grava esses proventos.
- [ ] O segundo upload dos mesmos arquivos mostra "0 proventos novos · 0 saem".
- [ ] O "a receber" de outubro do MXRF11 e do HGLG11 bate com cotas na véspera × R$ 0,10 e × R$ 1,17, conferido no banco da preview.
- [ ] As capturas de tela de `/proventos` (abas mes, ano e papel) e do Dashboard nos temas claro e escuro não têm quebra de layout nem em 390 px de largura.
- [ ] O `contrast.mjs` dá 0 falhas.
- [ ] Para o mesmo aporte, as Recomendações geram as mesmas ordens de antes.
- [ ] `npm run format:check`, `lint`, `typecheck` e `build` passam.

**Verify:** a saída dos scripts e as capturas de tela, mostradas ao usuário.

**Steps:**

- [ ] **Step 1:** rodar `seed-preview.ts` (sem `--sem-carteira`) e subir o `next dev` com `MONGODB_URI` em `koinos_preview`.
- [ ] **Step 2:** rodar `upload-b3.mjs` duas vezes e guardar as capturas da prévia nas duas.
- [ ] **Step 3:** rodar `check-announcements.ts` (Task 4) na preview e conferir à mão o "a receber" mostrado em `/proventos`.
- [ ] **Step 4:** rodar `shoot-all.mjs` com as rotas `/proventos?agrupar=mes`, `/proventos?agrupar=ano`, `/proventos?agrupar=papel` e `/dashboard`, nos dois temas e em 1440 e 390 px.
- [ ] **Step 5:** rodar `contrast.mjs` nas mesmas rotas.
- [ ] **Step 6:** `npm run format:check && npm run lint && npm run typecheck && npm run build`.
- [ ] **Step 7:** rodar `revoke-preview.ts` e apagar o banco `koinos_preview`.
- [ ] **Step 8:** rodar `check-secrets.mjs`. Depois, perguntar ao usuário antes de fazer o fast-forward da `main` e o push, que publicam em produção. Depois do deploy, o usuário reenvia os extratos pela tela para carregar os proventos em produção.
