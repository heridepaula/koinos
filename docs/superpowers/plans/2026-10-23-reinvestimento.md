# Reinvestimento de proventos (ciclo 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o relatório `/proventos/reinvestimento`. Ele divide o aporte de cada mês em dinheiro de proventos e dinheiro do bolso, a partir de uma % reinvestida salva por mês (mês sem % usa 100%).

**Architecture:**
- As regras puras ficam em `portfolio/domain/reinvestment.ts`: compras do mês, divisão e histórico.
- As % ficam numa coleção nova, `reinvestments`, com repositório próprio e uma Server Action com Zod.
- A leitura da tela (`reinvestment-view.ts`) junta, com o tenant da sessão, os lançamentos, os proventos da B3 e as % salvas.
- O mês vem da URL (`?mes=`): o servidor lê `searchParams`, e o seletor usa nuqs com `shallow: false`.

**Tech Stack:** Next.js 16 (Cache Components), Mongoose, next-safe-action + Zod, nuqs, Recharts, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-23-reinvestimento-design.md`

**Regras do repositório:**
- Não há suíte de testes, por decisão do dono. Cada tarefa verifica com um script descartável no scratchpad, rodado com `npx tsx --conditions=react-server`, mais `npm run lint` e `npm run typecheck`.
- O `.env.local` deste worktree aponta para o banco de prévia `koinos_preview`, nunca para a produção.
- O trabalho fica no branch `feat/reinvestimento`.
- **Antes de cada commit:** rodar `node <scratchpad>/check-secrets.mjs && git commit …`, sem pipe, para a falha da checagem barrar o commit.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `src/features/portfolio/domain/types.ts` | Modificar | `MonthPurchase`, `ReinvestmentSplit`, `ReinvestmentMonth`, `ReinvestmentView` |
| `src/features/portfolio/domain/reinvestment.ts` | Criar | Regras puras (§3 do spec) |
| `src/features/portfolio/index.ts` | Modificar | Exportar as regras e os tipos |
| `src/features/portfolio/server/reinvestment.model.ts` | Criar | Coleção `reinvestments` |
| `src/features/portfolio/server/reinvestment-repo.ts` | Criar | Listar, gravar e apagar a % por carteira e mês |
| `src/features/portfolio/schemas.ts` | Criar | Zod da Server Action |
| `src/features/portfolio/actions.ts` | Modificar | `setReinvestmentPercentAction` |
| `src/features/portfolio/server/reinvestment-view.ts` | Criar | DTO da tela |
| `src/features/portfolio/server.ts` | Modificar | Exportar `getReinvestmentView` |
| `src/features/portfolio/components/reinvestment/month-picker.tsx` | Criar | Seletor de mês (cliente) |
| `src/features/portfolio/components/reinvestment/reinvestment-cards.tsx` | Criar | Cards, campo da %, divisão e barra (cliente) |
| `src/features/portfolio/components/reinvestment/purchases-table.tsx` | Criar | Compras do mês (servidor) |
| `src/features/portfolio/components/reinvestment/reinvestment-history.tsx` | Criar | Histórico empilhado de 24 meses (cliente) |
| `src/features/portfolio/ui.ts` | Modificar | Exportar os componentes |
| `src/app/(app)/proventos/reinvestimento/page.tsx` | Criar | Rota |
| `src/app/(app)/proventos/page.tsx` | Modificar | Botão "Reinvestimento" no cabeçalho |

---

### Task 1: regras puras do reinvestimento

**Goal:** criar as regras puras do relatório: compras do mês, proventos do mês, divisão do aporte, histórico e resumo dos 12 meses.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Create: `src/features/portfolio/domain/reinvestment.ts`
- Modify: `src/features/portfolio/index.ts`

**Acceptance Criteria:**
- [ ] `splitAporte(20000, 7000, 100)` → `{ fromDividends: 7000, fromPocket: 13000, unspent: 0, dividendsShare: 0.35 }`.
- [ ] `splitAporte(20000, 7000, 50)` → `fromDividends` 3500 e `fromPocket` 16500.
- [ ] `splitAporte(5000, 7000, 100)` → `fromDividends` 5000, `fromPocket` 0 e `unspent` 2000.
- [ ] `splitAporte(0, 7000, 100)` → `dividendsShare` null e `unspent` 7000.
- [ ] `monthPurchases` só traz BUY de NEGOCIO e SUBSCRICAO do mês. Um lançamento sem `kind` vale como negócio. DESDOBRO, INCORPORACAO, POSICAO_ANTERIOR e vendas ficam de fora.
- [ ] `reinvestmentHistory` usa a % salva do mês ou 100% com `isDefault: true`, e a % de um mês não afeta os outros.
- [ ] `npm run lint` e `npm run typecheck` passam.

**Verify:** `npx tsx --conditions=react-server <scratchpad>/ciclo2/check-domain.mts` imprime só linhas `OK`.

**Steps:**

- [ ] **Step 1: tipos**

Acrescente ao fim de `src/features/portfolio/domain/types.ts`:

```ts
/** Compra paga em dinheiro (negócio ou subscrição), como o relatório de reinvestimento lista. */
export type MonthPurchase = {
  date: Date;
  ticker: string;
  kind: "NEGOCIO" | "SUBSCRICAO";
  quantity: number;
  unitPrice: number;
  fees: number;
  total: number;
};

/** Divisão do aporte do mês entre proventos reinvestidos e dinheiro do bolso. */
export type ReinvestmentSplit = {
  fromDividends: number;
  fromPocket: number;
  /** Proventos que a % mandaria reinvestir mas que não tiveram compra no mês. */
  unspent: number;
  /** Participação dos proventos no aporte; null sem aporte. */
  dividendsShare: number | null;
};

export type ReinvestmentMonth = ReinvestmentSplit & {
  month: string;
  aporte: number;
  /** Quantas compras em dinheiro o mês teve. */
  purchaseCount: number;
  dividends: number;
  percent: number;
  /** O mês não tem % salva: vale a padrão (100%). */
  isDefault: boolean;
};

/** Tela de reinvestimento: o mês escolhido, as compras dele e o histórico. */
export type ReinvestmentView = {
  month: string;
  /** Meses do seletor (do mais recente ao mais antigo): os com compra ou provento e o atual. */
  months: string[];
  current: ReinvestmentMonth;
  purchases: (MonthPurchase & { name: string | null; logoUrl: string | null })[];
  /** Os últimos 24 meses, do mais antigo ao mais recente. */
  history: ReinvestmentMonth[];
  last12: { aporte: number; fromDividends: number; share: number | null };
};
```

- [ ] **Step 2: regras em `src/features/portfolio/domain/reinvestment.ts`**

```ts
import type { DividendEntry, LedgerEntry } from "@/features/transactions";
import { monthKeyOfTradeDate } from "@/shared/lib/time";
import type { MonthPurchase, ReinvestmentMonth, ReinvestmentSplit } from "./types";

// Regras: docs/superpowers/specs/2026-10-23-reinvestimento-design.md (§3).

/** Mês sem % salva: no método Suno, todo provento volta para a carteira. */
export const DEFAULT_REINVESTMENT_PERCENT = 100;

/** Compras pagas em dinheiro. Lançamento antigo, sem `kind`, vale como negócio. */
const isCashPurchase = (entry: LedgerEntry) =>
  entry.type === "BUY" && (entry.kind === undefined || entry.kind === "NEGOCIO" || entry.kind === "SUBSCRICAO");

/** Compras em dinheiro do mês (AAAA-MM), da mais recente para a mais antiga. */
export function monthPurchases(entries: readonly LedgerEntry[], month: string): MonthPurchase[] {
  return entries
    .filter((entry) => isCashPurchase(entry) && monthKeyOfTradeDate(entry.date) === month)
    .map((entry) => ({
      date: entry.date,
      ticker: entry.ticker,
      kind: entry.kind === "SUBSCRICAO" ? ("SUBSCRICAO" as const) : ("NEGOCIO" as const),
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      fees: entry.fees,
      total: entry.quantity * entry.unitPrice + entry.fees,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.ticker.localeCompare(b.ticker));
}

/** §3.2: o reinvestido pretendido é a % dos proventos, limitado ao que foi comprado. */
export function splitAporte(aporte: number, dividends: number, percent: number): ReinvestmentSplit {
  const intended = (dividends * percent) / 100;
  const fromDividends = Math.min(intended, aporte);
  return {
    fromDividends,
    fromPocket: aporte - fromDividends,
    unspent: intended - fromDividends,
    dividendsShare: aporte > 0 ? fromDividends / aporte : null,
  };
}

/** §3.3: um item por mês pedido, com a % salva ou a padrão. */
export function reinvestmentHistory(input: {
  transactions: readonly LedgerEntry[];
  received: readonly DividendEntry[];
  percents: ReadonlyMap<string, number>;
  months: readonly string[];
}): ReinvestmentMonth[] {
  const aportes = new Map<string, { total: number; count: number }>();
  for (const entry of input.transactions) {
    if (!isCashPurchase(entry)) continue;
    const month = monthKeyOfTradeDate(entry.date);
    const current = aportes.get(month) ?? { total: 0, count: 0 };
    current.total += entry.quantity * entry.unitPrice + entry.fees;
    current.count += 1;
    aportes.set(month, current);
  }
  const dividends = new Map<string, number>();
  for (const item of input.received) {
    const month = monthKeyOfTradeDate(item.paidAt);
    dividends.set(month, (dividends.get(month) ?? 0) + item.amount);
  }
  return input.months.map((month) => {
    const saved = input.percents.get(month);
    const percent = saved ?? DEFAULT_REINVESTMENT_PERCENT;
    const aporte = aportes.get(month)?.total ?? 0;
    const received = dividends.get(month) ?? 0;
    return {
      month,
      aporte,
      purchaseCount: aportes.get(month)?.count ?? 0,
      dividends: received,
      percent,
      isDefault: saved === undefined,
      ...splitAporte(aporte, received, percent),
    };
  });
}

/** Soma do período: aporte, dinheiro de proventos e a participação dos proventos. */
export function summarizeReinvestment(history: readonly ReinvestmentMonth[]) {
  const aporte = history.reduce((sum, month) => sum + month.aporte, 0);
  const fromDividends = history.reduce((sum, month) => sum + month.fromDividends, 0);
  return { aporte, fromDividends, share: aporte > 0 ? fromDividends / aporte : null };
}

/** Meses do seletor: os com compra em dinheiro ou provento, mais o atual; do mais recente ao mais antigo. */
export function reinvestmentMonths(
  transactions: readonly LedgerEntry[],
  received: readonly DividendEntry[],
  currentMonth: string,
): string[] {
  const months = new Set<string>([currentMonth]);
  for (const entry of transactions) if (isCashPurchase(entry)) months.add(monthKeyOfTradeDate(entry.date));
  for (const item of received) months.add(monthKeyOfTradeDate(item.paidAt));
  return [...months].filter((month) => month <= currentMonth).sort().reverse();
}
```

- [ ] **Step 3: exportar em `src/features/portfolio/index.ts`**

Acrescente:

```ts
export {
  DEFAULT_REINVESTMENT_PERCENT,
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
  splitAporte,
  summarizeReinvestment,
} from "./domain/reinvestment";
```

Acrescente também `MonthPurchase`, `ReinvestmentMonth`, `ReinvestmentSplit` e `ReinvestmentView` ao `export type` que já existe.

- [ ] **Step 4: script de conferência em `<scratchpad>/ciclo2/check-domain.mts`**

```ts
import {
  monthPurchases,
  reinvestmentHistory,
  splitAporte,
} from "file:///D:/workspace/koinos/.worktrees/reinvestimento/src/features/portfolio/index.ts";

const ok = (label: string, cond: boolean) => console.log(cond ? "OK  " : "FAIL", label);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

let s = splitAporte(20000, 7000, 100);
ok("critério 1: 7.000 de proventos e 13.000 do bolso", near(s.fromDividends, 7000) && near(s.fromPocket, 13000) && near(s.dividendsShare ?? -1, 0.35));
s = splitAporte(20000, 7000, 50);
ok("critério 2: 3.500 e 16.500", near(s.fromDividends, 3500) && near(s.fromPocket, 16500));
s = splitAporte(5000, 7000, 100);
ok("critério 3: limitado ao aporte, sobra 2.000", near(s.fromDividends, 5000) && near(s.fromPocket, 0) && near(s.unspent, 2000));
s = splitAporte(0, 7000, 100);
ok("sem compras: sem participação, sobra 7.000", s.dividendsShare === null && near(s.unspent, 7000));

const entry = (id: string, kind: string | undefined, type: "BUY" | "SELL", date: string, quantity: number, unitPrice: number, fees = 0) =>
  ({ id, ticker: "AAAA11", type, quantity, unitPrice, fees, date: d(date), createdAt: d(date), ...(kind ? { kind } : {}) }) as never;
const tx = [
  entry("1", "NEGOCIO", "BUY", "2026-09-10", 10, 100, 1),
  entry("2", "SUBSCRICAO", "BUY", "2026-09-20", 5, 90),
  entry("3", undefined, "BUY", "2026-09-25", 1, 100),
  entry("4", "DESDOBRO", "BUY", "2026-09-26", 10, 0),
  entry("5", "INCORPORACAO", "BUY", "2026-09-27", 3, 100),
  entry("6", "POSICAO_ANTERIOR", "BUY", "2026-09-28", 3, 100),
  entry("7", "NEGOCIO", "SELL", "2026-09-29", 2, 100),
  entry("8", "NEGOCIO", "BUY", "2026-10-01", 1, 100),
];
const list = monthPurchases(tx, "2026-09");
ok("só negócio, subscrição e lançamento sem kind", list.length === 3 && near(list.reduce((t, p) => t + p.total, 0), 1001 + 450 + 100));
ok("da mais recente para a mais antiga", list[0]!.date.getTime() === d("2026-09-25").getTime());

const received = [{ ticker: "AAAA11", paidAt: d("2026-09-15"), kind: "RENDIMENTO" as const, amount: 500, quantity: 10, perShare: 50 }];
const history = reinvestmentHistory({ transactions: tx, received, percents: new Map([["2026-10", 50]]), months: ["2026-09", "2026-10"] });
ok("setembro sem % salva usa 100% padrão", history[0]!.isDefault && history[0]!.percent === 100 && near(history[0]!.fromDividends, 500));
ok("outubro com 50% salvo não muda setembro", !history[1]!.isDefault && history[1]!.percent === 50 && near(history[1]!.aporte, 100) && near(history[1]!.fromDividends, 0));
```

- [ ] **Step 5: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
node <scratchpad>/check-secrets.mjs && git add src/features/portfolio && git commit -m "feat(reinvestment): pure rules for the monthly dividends reinvestment split"
```

---

### Task 2: % por mês salva (modelo, repositório e ação) e a leitura da tela

**Goal:** gravar e apagar a % por carteira e mês, com a Server Action validada por Zod, e montar o DTO da tela a partir do tenant da sessão.

**Files:**
- Create: `src/features/portfolio/server/reinvestment.model.ts`
- Create: `src/features/portfolio/server/reinvestment-repo.ts`
- Create: `src/features/portfolio/schemas.ts`
- Modify: `src/features/portfolio/actions.ts`
- Create: `src/features/portfolio/server/reinvestment-view.ts`
- Modify: `src/features/portfolio/server.ts`

**Acceptance Criteria:**
- [ ] A coleção `reinvestments` tem o índice único `{ portfolioId: 1, month: 1 }`.
- [ ] Toda consulta, gravação e remoção filtra por `portfolioId`.
- [ ] `setReinvestmentPercentAction`:
  - recusa mês fora de AAAA-MM, mês futuro, antes de 2000-01 e % fora de 0–100;
  - arredonda a % para uma casa decimal;
  - com `percent: null`, apaga o documento;
  - chama `refresh()`.
- [ ] `getReinvestmentView(mes)`:
  - cai no mês atual quando `mes` é inválido ou futuro;
  - traz as compras do mês com nome e logo, o mês corrente da divisão, 24 meses de histórico e o resumo dos últimos 12;
  - não carrega nenhum id interno.
- [ ] Na prévia: gravar 50% num mês, ler (o mês tem 50%, `isDefault` false), apagar (volta a 100%, `isDefault` true).

**Verify:** `npx tsx --conditions=react-server --env-file=<scratchpad>/ciclo2/preview.env <worktree>/repo-tmp.ts`. O script é copiado na raiz do worktree e apagado depois. Ele recusa rodar fora de `koinos_preview` e imprime o ciclo grava, lê e apaga.

**Steps:**

- [ ] **Step 1: modelo `reinvestment.model.ts`**

```ts
import "server-only";
import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ReinvestmentDoc {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  /** AAAA-MM */
  month: string;
  /** % dos proventos do mês que foi reinvestida, de 0 a 100. */
  percent: number;
  createdAt: Date;
  updatedAt: Date;
}

const reinvestmentSchema = new Schema<ReinvestmentDoc>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

reinvestmentSchema.index({ portfolioId: 1, month: 1 }, { unique: true });

export const ReinvestmentModel: Model<ReinvestmentDoc> =
  (mongoose.models.Reinvestment as Model<ReinvestmentDoc> | undefined) ??
  mongoose.model<ReinvestmentDoc>("Reinvestment", reinvestmentSchema, "reinvestments");
```

- [ ] **Step 2: repositório `reinvestment-repo.ts`**

```ts
import "server-only";
import { Types } from "mongoose";
import { connectMongo } from "@/shared/db/mongo";
import { ReinvestmentModel, type ReinvestmentDoc } from "./reinvestment.model";

// Toda função recebe o portfolioId explícito e o usa em todos os filtros ({ portfolioId, month }).

const toObjectId = (id: string) => new Types.ObjectId(id);

/** % salva de cada mês desta carteira (AAAA-MM → %). */
export async function listReinvestmentPercents(portfolioId: string): Promise<Map<string, number>> {
  await connectMongo();
  const docs = await ReinvestmentModel.find(
    { portfolioId: toObjectId(portfolioId) },
    { month: 1, percent: 1 },
  ).lean<Pick<ReinvestmentDoc, "month" | "percent">[]>();
  return new Map(docs.map((doc) => [doc.month, doc.percent]));
}

export async function setReinvestmentPercent(
  portfolioId: string,
  month: string,
  percent: number,
): Promise<void> {
  await connectMongo();
  await ReinvestmentModel.updateOne(
    { portfolioId: toObjectId(portfolioId), month },
    { $set: { percent }, $setOnInsert: { portfolioId: toObjectId(portfolioId), month } },
    { upsert: true, runValidators: true },
  );
}

/** Volta o mês ao padrão (100%). */
export async function clearReinvestmentPercent(portfolioId: string, month: string): Promise<void> {
  await connectMongo();
  await ReinvestmentModel.deleteOne({ portfolioId: toObjectId(portfolioId), month });
}
```

- [ ] **Step 3: Zod em `src/features/portfolio/schemas.ts`**

```ts
import { z } from "zod";

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido");

export const reinvestmentPercentSchema = z.object({
  month: monthKeySchema,
  percent: z
    .number()
    .min(0, "A % não pode ser negativa")
    .max(100, "A % não pode passar de 100")
    .nullable(),
});

export type ReinvestmentPercentInput = z.infer<typeof reinvestmentPercentSchema>;
```

- [ ] **Step 4: ação em `src/features/portfolio/actions.ts`**

Acrescente os imports `ActionError` (de `@/features/auth/server`), `currentMonthKey` (de `@/shared/lib/time`), `reinvestmentPercentSchema` (de `./schemas`), mais `clearReinvestmentPercent` e `setReinvestmentPercent` (de `./server/reinvestment-repo`). Depois, acrescente a ação:

```ts
/** Salva a % reinvestida de um mês; `null` volta o mês ao padrão (100%). */
export const setReinvestmentPercentAction = authActionClient
  .inputSchema(reinvestmentPercentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { month, percent } = parsedInput;
    if (month < "2000-01" || month > currentMonthKey(new Date())) {
      throw new ActionError("Escolha um mês entre 2000 e o mês atual.");
    }
    if (percent === null) {
      await clearReinvestmentPercent(ctx.tenant.portfolioId, month);
    } else {
      await setReinvestmentPercent(ctx.tenant.portfolioId, month, Math.round(percent * 10) / 10);
    }
    refresh();
    return { ok: true as const };
  });
```

- [ ] **Step 5: leitura da tela `reinvestment-view.ts`**

```ts
import "server-only";
import { getTenant } from "@/features/auth/server";
import { getAssetSnapshots } from "@/features/market-data/server";
import { getMyDividends, getMyTransactions } from "@/features/transactions/server";
import { addMonths, currentMonthKey, monthRange } from "@/shared/lib/time";
import {
  monthPurchases,
  reinvestmentHistory,
  reinvestmentMonths,
  summarizeReinvestment,
} from "../domain/reinvestment";
import type { ReinvestmentView } from "../domain/types";
import { listReinvestmentPercents } from "./reinvestment-repo";

const HISTORY_MONTHS = 24;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Tela de reinvestimento do usuário logado. `requested` vem da URL (?mes=); inválido ou futuro
 * cai no mês atual. O resultado é um DTO sem ids internos.
 */
export async function getReinvestmentView(requested: string | null): Promise<ReinvestmentView> {
  const tenant = await getTenant(); // chama connection(): só em tempo de requisição
  const nowMonth = currentMonthKey(new Date());
  const month = requested && MONTH.test(requested) && requested <= nowMonth ? requested : nowMonth;
  const [transactions, received, percents] = await Promise.all([
    getMyTransactions(),
    getMyDividends(),
    listReinvestmentPercents(tenant.portfolioId),
  ]);
  const purchases = monthPurchases(transactions, month);
  const assets = await getAssetSnapshots([...new Set(purchases.map((item) => item.ticker))]);
  const history = reinvestmentHistory({
    transactions,
    received,
    percents,
    months: monthRange(addMonths(nowMonth, -(HISTORY_MONTHS - 1)), nowMonth),
  });
  const [current] = reinvestmentHistory({ transactions, received, percents, months: [month] });
  return {
    month,
    months: reinvestmentMonths(transactions, received, nowMonth),
    current: current!,
    purchases: purchases.map((item) => ({
      ...item,
      name: assets.get(item.ticker)?.name ?? null,
      logoUrl: assets.get(item.ticker)?.logoUrl ?? null,
    })),
    history,
    last12: summarizeReinvestment(history.slice(-12)),
  };
}
```

Exporte `getReinvestmentView` em `src/features/portfolio/server.ts`.

- [ ] **Step 6: conferência na prévia**

Grave `<scratchpad>/ciclo2/repo-check.ts`. Copie-o para a raiz do worktree como `repo-tmp.ts` antes de rodar, porque ele usa os aliases `@/`, e apague a cópia depois.

```ts
import { findDefaultPortfolioId, findUserIdByEmail } from "@/features/auth/repo";
import {
  clearReinvestmentPercent,
  listReinvestmentPercents,
  setReinvestmentPercent,
} from "@/features/portfolio/server/reinvestment-repo";
import { mongoClient } from "@/shared/db/mongo";
import { redis } from "@/shared/db/redis";

async function main() {
  if (!process.env.MONGODB_URI?.includes("/koinos_preview?")) throw new Error("use só com o banco de prévia");
  const userId = await findUserIdByEmail("previa@koinos.local");
  const portfolioId = await findDefaultPortfolioId(userId!);
  await setReinvestmentPercent(portfolioId!, "2026-09", 50);
  console.log("gravado:", (await listReinvestmentPercents(portfolioId!)).get("2026-09"));
  await setReinvestmentPercent(portfolioId!, "2026-09", 68.1);
  console.log("regravado:", (await listReinvestmentPercents(portfolioId!)).get("2026-09"));
  await clearReinvestmentPercent(portfolioId!, "2026-09");
  console.log("apagado (undefined = padrão):", (await listReinvestmentPercents(portfolioId!)).get("2026-09"));
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoClient.close();
    redis.disconnect();
  });
```

Expected: `gravado: 50`, `regravado: 68.1` e `apagado (undefined = padrão): undefined`.

Confira os nomes `findUserIdByEmail` e `findDefaultPortfolioId` em `src/features/auth/repo.ts` antes de rodar.

- [ ] **Step 7: lint, typecheck e commit**

```bash
npm run lint && npm run typecheck
node <scratchpad>/check-secrets.mjs && git add src/features/portfolio && git commit -m "feat(reinvestment): store the reinvested % per month and build the report view"
```

---

### Task 3: tela `/proventos/reinvestimento`

**Goal:** criar a página `/proventos/reinvestimento` (seletor de mês, cards com o campo da %, divisão com a barra, compras do mês e histórico empilhado) e o botão de acesso em `/proventos`.

**Files:**
- Create: `src/features/portfolio/components/reinvestment/month-picker.tsx`
- Create: `src/features/portfolio/components/reinvestment/reinvestment-cards.tsx`
- Create: `src/features/portfolio/components/reinvestment/purchases-table.tsx`
- Create: `src/features/portfolio/components/reinvestment/reinvestment-history.tsx`
- Modify: `src/features/portfolio/ui.ts`
- Create: `src/app/(app)/proventos/reinvestimento/page.tsx`
- Modify: `src/app/(app)/proventos/page.tsx`

**Acceptance Criteria:**
- [ ] `/proventos/reinvestimento` abre no mês atual. `?mes=AAAA-MM` troca o mês, e as setas e a lista mudam a URL e o conteúdo.
- [ ] Digitar a % atualiza a divisão na hora. "Salvar" grava a %. "Voltar ao padrão" aparece só com % salva e volta a 100%.
- [ ] A divisão mostra dinheiro de proventos e do bolso (valor e %) e uma barra de duas partes. Também mostra a sobra quando existe e "Nenhuma compra no mês" sem aporte.
- [ ] As compras do mês aparecem em tabela, com o total no rodapé, e cabem em 390 px sem rolagem da página.
- [ ] O histórico tem barras empilhadas de 24 meses (bolso em `--chart-1` e proventos em `--chart-2`), com legenda e tooltip, e o resumo dos 12 meses.
- [ ] `/proventos` tem o botão "Reinvestimento". O menu lateral continua marcando "Proventos".
- [ ] O build lista `/proventos/reinvestimento` como ◐ (Partial Prerender).

**Verify:** `npm run build`, depois render na prévia com `next start`. As capturas ficam em `<scratchpad>/ciclo2/shots/`.

**Steps:**

- [ ] **Step 1: `month-picker.tsx` (cliente)**

```tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { formatMonth } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Mês do relatório na URL (?mes=). shallow: false faz o servidor montar a tela do mês novo.
 * `months` vem do mais recente ao mais antigo.
 */
export function MonthPicker({ month, months }: { month: string; months: readonly string[] }) {
  const [, setMonth] = useQueryState(
    "mes",
    parseAsString.withOptions({ shallow: false, history: "replace" }),
  );
  const index = months.indexOf(month);
  const newer = index > 0 ? months[index - 1] : undefined;
  const older = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Mês anterior"
        disabled={!older}
        onClick={() => older && void setMonth(older)}
      >
        <ChevronLeftIcon />
      </Button>
      <select
        aria-label="Mês do relatório"
        className={selectClass}
        value={month}
        onChange={(event) => void setMonth(event.target.value)}
      >
        {months.map((key) => (
          <option key={key} value={key}>
            {formatMonth(key)}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Próximo mês"
        disabled={!newer}
        onClick={() => newer && void setMonth(newer)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: `reinvestment-cards.tsx` (cliente)**

```tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatBRL, formatPercent, formatQuantity } from "@/shared/lib/format";
import { numberToInput, parseNumberInput } from "@/shared/lib/parse-number";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { setReinvestmentPercentAction } from "../../actions";
import { splitAporte } from "../../domain/reinvestment";
import type { ReinvestmentMonth } from "../../domain/types";

/** Cards do mês: aporte, proventos, a % reinvestida (editável) e a divisão do aporte. */
export function ReinvestmentCards({ current }: { current: ReinvestmentMonth }) {
  const [text, setText] = useState(numberToInput(current.percent));
  const typed = parseNumberInput(text);
  const valid = Number.isFinite(typed) && typed >= 0 && typed <= 100;
  // A divisão acompanha o que se digita; inválido mostra a % que está valendo.
  const split = splitAporte(current.aporte, current.dividends, valid ? typed : current.percent);
  const save = useAction(setReinvestmentPercentAction, {
    onSuccess: () => toast.success("% do mês salva."),
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const reset = useAction(setReinvestmentPercentAction, {
    onSuccess: () => {
      setText(numberToInput(100));
      toast.success("O mês voltou ao padrão (100%).");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const busy = save.isPending || reset.isPending;
  const changed = valid && Math.round(typed * 10) / 10 !== current.percent;

  return (
    <div className="@container">
      <div className="grid gap-4 @min-[720px]:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Aporte no mês</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{formatBRL(current.aporte)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {current.purchaseCount === 1 ? "1 compra" : `${formatQuantity(current.purchaseCount)} compras`}
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>Proventos recebidos no mês</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{formatBRL(current.dividends)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Pelo extrato da B3.</CardContent>
        </Card>
        <Card className="card-lift">
          <CardHeader>
            <CardDescription>% dos proventos reinvestida</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid) save.execute({ month: current.month, percent: typed });
              }}
            >
              <Input
                aria-label="% reinvestida"
                inputMode="decimal"
                className="w-24 tabular-nums"
                value={text}
                aria-invalid={!valid}
                onChange={(event) => setText(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button type="submit" size="sm" disabled={!changed || busy}>
                Salvar
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              {!valid ? (
                "Use um número de 0 a 100."
              ) : current.isDefault ? (
                "Padrão (100%): este mês ainda não tem % salva."
              ) : (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={busy}
                  onClick={() => reset.execute({ month: current.month, percent: null })}
                >
                  Voltar ao padrão (100%)
                </Button>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>De onde veio o aporte</CardTitle>
          <CardDescription>Proventos reinvestidos e dinheiro do bolso no mês.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {current.aporte <= 0 ? (
            <p className="text-muted-foreground">Nenhuma compra no mês.</p>
          ) : (
            <>
              <SplitBar fromDividends={split.fromDividends} fromPocket={split.fromPocket} />
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px] bg-(--chart-2)" aria-hidden="true" />
                  Proventos <strong className="tabular-nums">{formatBRL(split.fromDividends)}</strong>
                  <span className="text-muted-foreground tabular-nums">{formatPercent(split.dividendsShare ?? 0, 1)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[2px] bg-(--chart-1)" aria-hidden="true" />
                  Bolso <strong className="tabular-nums">{formatBRL(split.fromPocket)}</strong>
                  <span className="text-muted-foreground tabular-nums">{formatPercent(1 - (split.dividendsShare ?? 0), 1)}</span>
                </span>
              </div>
            </>
          )}
          {split.unspent > 0.005 ? (
            <p className="text-muted-foreground">
              {formatBRL(split.unspent)} dos proventos ficaram sem compra no mês.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Barra de duas partes: proventos (laranja) e bolso (azul), proporcionais ao aporte. */
function SplitBar({ fromDividends, fromPocket }: { fromDividends: number; fromPocket: number }) {
  const total = fromDividends + fromPocket;
  const dividendsWidth = total > 0 ? (fromDividends / total) * 100 : 0;
  return (
    <div
      className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={`Proventos ${formatBRL(fromDividends)}, bolso ${formatBRL(fromPocket)}`}
    >
      {fromDividends > 0 ? <div className="h-full bg-(--chart-2)" style={{ width: `${dividendsWidth}%` }} /> : null}
      {fromPocket > 0 ? <div className="h-full flex-1 bg-(--chart-1)" /> : null}
    </div>
  );
}
```

O componente precisa recomeçar o estado do campo quando o mês muda. Por isso, a página o renderiza com `key={view.month}`.

- [ ] **Step 3: `purchases-table.tsx` (servidor)**

```tsx
import { AssetLabel } from "@/shared/components/asset-label";
import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { ReinvestmentView } from "../../domain/types";

const KIND_LABELS = { NEGOCIO: "Negócio", SUBSCRICAO: "Subscrição" } as const;

/** Compras em dinheiro do mês. As colunas de detalhe saem pela largura do card. */
export function PurchasesTable({ rows }: { rows: ReinvestmentView["purchases"] }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compras do mês</CardTitle>
        <CardDescription>Negócios e subscrições, com taxas.</CardDescription>
      </CardHeader>
      <CardContent className="@container px-0">
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">Nenhuma compra no mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Data</TableHead>
                <TableHead>FII</TableHead>
                <TableHead className="hidden @min-[560px]:table-cell">Tipo</TableHead>
                <TableHead className="hidden text-right @min-[480px]:table-cell">Qtd.</TableHead>
                <TableHead className="hidden text-right @min-[640px]:table-cell">Preço</TableHead>
                <TableHead className="pr-6 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.ticker}-${row.date.toISOString()}-${index}`}>
                  <TableCell className="pl-6 tabular-nums">{formatTradeDate(row.date)}</TableCell>
                  <TableCell>
                    <AssetLabel ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} />
                  </TableCell>
                  <TableCell className="hidden @min-[560px]:table-cell">{KIND_LABELS[row.kind]}</TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[480px]:table-cell">
                    {formatQuantity(row.quantity)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[640px]:table-cell">
                    {formatBRL(row.unitPrice)}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-medium tabular-nums">{formatBRL(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6 font-medium" colSpan={2}>
                  Total
                </TableCell>
                <TableCell className="hidden @min-[560px]:table-cell" />
                <TableCell className="hidden @min-[480px]:table-cell" />
                <TableCell className="hidden @min-[640px]:table-cell" />
                <TableCell className="pr-6 text-right font-semibold tabular-nums">{formatBRL(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: `reinvestment-history.tsx` (cliente)**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBRL, formatCompactBRL, formatMonth, formatPercent } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import type { ReinvestmentView } from "../../domain/types";
import { ChartTooltipRow } from "../chart-tooltip-row";

// Duas séries: bolso no azul dos aportes, proventos no laranja dos proventos (par validado nos
// dois temas, CVD ΔE > 24). Legenda sempre visível: a identidade não depende só da cor.
const config = {
  fromPocket: { label: "Bolso", color: "var(--chart-1)" },
  fromDividends: { label: "Proventos", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ReinvestmentHistory({
  history,
  last12,
}: Pick<ReinvestmentView, "history" | "last12">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>
          {last12.share === null
            ? "Nenhum aporte nos últimos 12 meses."
            : `Nos últimos 12 meses, ${formatPercent(last12.share, 1)} dos aportes vieram de proventos (${formatBRL(last12.fromDividends)} de ${formatBRL(last12.aporte)}).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={history} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tickFormatter={(value: number) => formatCompactBRL(value)} tickLine={false} axisLine={false} width={72} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(month, payload) => {
                    const item = payload?.[0]?.payload as ReinvestmentView["history"][number] | undefined;
                    const detail = item
                      ? ` · total ${formatBRL(item.aporte)} · ${formatPercent(item.percent / 100, 1)}${item.isDefault ? " (padrão)" : ""}`
                      : "";
                    return `${formatMonth(String(month))}${detail}`;
                  }}
                  formatter={(value, name) => (
                    <ChartTooltipRow
                      color={`var(--color-${String(name)})`}
                      label={config[name as keyof typeof config]?.label ?? String(name)}
                      value={formatBRL(Number(value))}
                    />
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="fromPocket" stackId="aporte" fill="var(--color-fromPocket)" maxBarSize={24} />
            <Bar dataKey="fromDividends" stackId="aporte" fill="var(--color-fromDividends)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

Confira a assinatura de `labelFormatter` em `src/shared/ui/chart.tsx`, porque o segundo argumento (`payload`) depende da versão. Se ela não trouxer o payload, monte o rótulo só com o mês e passe a % para uma linha extra do formatter.

- [ ] **Step 5: exportar em `ui.ts`**

```ts
export { MonthPicker } from "./components/reinvestment/month-picker";
export { PurchasesTable } from "./components/reinvestment/purchases-table";
export { ReinvestmentCards } from "./components/reinvestment/reinvestment-cards";
export { ReinvestmentHistory } from "./components/reinvestment/reinvestment-history";
```

- [ ] **Step 6: rota `src/app/(app)/proventos/reinvestimento/page.tsx`**

```tsx
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getReinvestmentView } from "@/features/portfolio/server";
import {
  MonthPicker,
  PurchasesTable,
  ReinvestmentCards,
  ReinvestmentHistory,
} from "@/features/portfolio/ui";
import { PageHeader } from "@/shared/components/page-header";
import { CardSkeleton } from "@/shared/components/skeletons";
import { Button } from "@/shared/ui/button";

export const metadata: Metadata = { title: "Reinvestimento" };

export default function ReinvestmentPage({ searchParams }: PageProps<"/proventos/reinvestimento">) {
  return (
    <>
      <PageHeader
        title="Reinvestimento"
        description="Quanto do aporte do mês veio de proventos e quanto saiu do bolso."
        actions={
          <Button variant="outline" render={<Link href="/proventos" />}>
            <ArrowLeftIcon />
            Proventos
          </Button>
        }
      />
      {/* searchParams é dado da requisição: fica dentro de <Suspense>, como no login. */}
      <Suspense fallback={<CardSkeleton height="h-40" />}>
        <ReinvestmentContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReinvestmentContent({
  searchParams,
}: Pick<PageProps<"/proventos/reinvestimento">, "searchParams">) {
  const params = await searchParams;
  const view = await getReinvestmentView(typeof params.mes === "string" ? params.mes : null);
  return (
    <div className="grid gap-6">
      <MonthPicker month={view.month} months={view.months} />
      <ReinvestmentCards key={view.month} current={view.current} />
      <PurchasesTable rows={view.purchases} />
      <ReinvestmentHistory history={view.history} last12={view.last12} />
    </div>
  );
}
```

- [ ] **Step 7: botão em `/proventos`**

No `PageHeader` de `src/app/(app)/proventos/page.tsx`, acrescente `actions` com `<Button variant="outline" render={<Link href="/proventos/reinvestimento" />}><RepeatIcon />Reinvestimento</Button>`. Importe `Link`, `RepeatIcon` (de `lucide-react`) e `Button`.

- [ ] **Step 8: build, render e commit**

```bash
npm run format && npm run lint && npm run typecheck && npm run build
node <scratchpad>/check-secrets.mjs && git add "src/app/(app)/proventos" src/features/portfolio && git commit -m "feat(reinvestment): /proventos/reinvestimento report with the monthly split and history"
```

---

### Task 4: verificação ponta a ponta e entrega

**Goal:** conferir na prévia isolada, com os dados reais, os critérios do spec, as telas e o contraste, e publicar.

**Files:**
- Nenhum arquivo do repositório. Os scripts e as capturas ficam em `<scratchpad>/ciclo2/`.

**Acceptance Criteria:**
- [ ] Os critérios 1 a 4 do spec passam no script sem banco da Task 1.
- [ ] Na prévia, pela tela:
  - salvar 50% num mês muda a divisão e o histórico só daquele mês;
  - "Voltar ao padrão" devolve 100% e "padrão".
- [ ] Critério 5: em cada um dos 24 meses, o aporte do relatório é igual ao do gráfico "Aportes por mês" do Dashboard. As duas regras rodam sobre os mesmos lançamentos.
- [ ] As capturas de `/proventos/reinvestimento` estão nos dois temas, em 1440 e 390 px, sem rolagem horizontal da página.
- [ ] O contraste dá 0 falhas.
- [ ] `npm run format:check`, `lint`, `typecheck` e `build` passam.
- [ ] Depois do merge e do deploy, `/proventos/reinvestimento` sem sessão redireciona para `/login` (307).

**Verify:** a saída dos scripts e as capturas, mostradas ao usuário.

**Steps:**

- [ ] **Step 1:** recriar a prévia com o seed (`<scratchpad>/aporte/seed-preview.ts`, copiado para a raiz do worktree, com `--env-file=<scratchpad>/ciclo2/preview.env`).
- [ ] **Step 2:** carregar os proventos na prévia pelo script de operação, com o `.env.local` do worktree, que aponta para a prévia: `npm run import:b3 -- --negociacao … --movimentacao … --planilha … --email previa@koinos.local`.
- [ ] **Step 3:** `next start` no worktree, uma sessão nova (`<scratchpad>/task6/new-session.ts`), um Playwright que salva 50% num mês e volta ao padrão, e as capturas.
- [ ] **Step 4:** um script do critério 5 que compara `monthlyContributions` (de `@/features/transactions`) com `reinvestmentHistory` nos 24 meses.
- [ ] **Step 5:** contraste (`<scratchpad>/shots-tool/contrast-proventos.mjs` com a rota nova).
- [ ] **Step 6:** limpeza: revogar a sessão e apagar `koinos_preview`.
- [ ] **Step 7:** revisão final do branch, o merge na `main` com fast-forward, o push (publicação autorizada pelo usuário) e a conferência do deploy e da rota em produção.
