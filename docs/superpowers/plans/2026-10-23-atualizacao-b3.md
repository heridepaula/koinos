# Atualização da B3 (três extratos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/atualizacao-b3`. Ela exige os extratos de Negociação, Movimentação e Eventos, mostra a prévia do que é novo e das inconsistências, e grava só a diferença (a B3 tem prioridade). O "a receber" oficial da B3 passa a valer em `/proventos`.

**Architecture:**
- **Leitura e plano:** o leitor puro do Eventos e o plano puro (`planB3Import`) ganham a foto do "a receber".
- **Diferença:** uma função pura calcula a diferença exata entre o plano e o que está gravado.
- **Gravação:** o serviço grava, numa transação, só os novos e os substituídos, e troca a foto.
- **`/proventos`:** usa a foto da B3 como fonte do "a receber", e o Yahoo só completa o que foi anunciado depois do envio.

**Tech Stack:** Next.js 16 (Cache Components), Mongoose, next-safe-action + Zod, read-excel-file, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-23-atualizacao-b3-design.md`. Os números esperados estão nos critérios de sucesso, no §1.

**Regras do repositório:**
- **Verificação:** não há suíte de testes. Cada tarefa verifica com um script descartável no scratchpad (`npx tsx --conditions=react-server`), mais `npm run lint` e `npm run typecheck`.
- **Banco:** o `.env.local` deste worktree aponta para `koinos_preview`.
  - O `D:\workspace\koinos\.env.local` é o da produção e só pode ser lido.
  - Só a Task 6 grava em produção, e só depois do backup.
- **Commit:** `node <scratchpad>/check-secrets.mjs && git commit …`, sem pipe e com caminhos explícitos.
- **Extratos:** ficam em `D:\Downloads`. São dados pessoais: só leitura, nunca no repositório.
  - Novos: `eventos-2026-10-23-12-13-47.xlsx`, `negociacao-2026-10-23-12-13-35.xlsx` e `movimentacao-2026-10-23-12-13-22.xlsx`.
  - Histórico de 17/10: `negociacao-2026-10-17-19-40-57.xlsx` e `movimentacao-2026-10-17-19-39-54.xlsx`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
| --- | --- | --- |
| `transactions/import/b3/types.ts` | Modificar | `EVENTOS`, `EventoRow`, `EventosData`, `PlannedForecast`, `PlannedUpcoming`, `ForecastMismatch`, a prévia nova |
| `transactions/import/b3/detect.ts` | Modificar | Reconhecer o Eventos |
| `transactions/import/b3/read-eventos.ts` | Criar | Leitor puro |
| `transactions/import/b3/plan.ts` | Modificar | `upcoming`, preço anterior PLANILHA, `forecastMismatches` |
| `transactions/import/b3/changes.ts` | Criar | Diferença pura de lançamentos e proventos (absorve `dividend-changes.ts`) |
| `transactions/server/dividend-forecast.model.ts` | Criar | Coleção `dividend_forecasts` |
| `transactions/server/dividend-repo.ts` | Modificar | Proventos com id (só para o serviço), leitura e gravação da foto |
| `transactions/server/transaction-repo.ts` | Modificar | `applyB3Update`: a diferença e a foto numa transação |
| `transactions/server/b3-import.ts` | Modificar | Três arquivos, a prévia nova e a confirmação pela diferença |
| `transactions/server/transactions-dal.ts`, `server.ts` | Modificar | `getMyDividendForecast` |
| `portfolio/domain/dividends.ts`, `types.ts` | Modificar | O "a receber" com a foto da B3 |
| `portfolio/server/dividends-view.ts` | Modificar | Ler a foto |
| `portfolio/components/dividends/upcoming-list.tsx`, `month-cards.tsx` | Modificar | Origem e data oficial |
| `transactions/components/b3-import/*` | Modificar | Três arquivos e as seções novas da prévia |
| `app/(app)/atualizacao-b3/page.tsx` | Criar | Página |
| `app/(app)/transacoes/importar/page.tsx` | Modificar | Redireciona |
| `shared/components/app-sidebar.tsx`, `src/proxy.ts`, `app/globals.css` | Modificar | Item do menu, matcher e azulejo |
| Botões "Importar da B3" (Transações, carteira vazia, Proventos vazio) | Modificar | Apontar para `/atualizacao-b3` |
| `CLAUDE.md`, `README.md` | Modificar | O fluxo novo |

---

### Task 1: leitor do extrato de Eventos

**Goal:** reconhecer e ler o extrato "Proventos a Receber" sem interpretar as linhas.

**Files:**
- Modify: `src/features/transactions/import/b3/types.ts`
- Modify: `src/features/transactions/import/b3/detect.ts`
- Create: `src/features/transactions/import/b3/read-eventos.ts`
- Modify: `src/features/transactions/index.ts`

**Acceptance Criteria:**
- [ ] `detectB3File` devolve `EVENTOS` para o arquivo real de 23/10 e continua devolvendo `NEGOCIACAO` e `MOVIMENTACAO` para os outros.
- [ ] `readEventos` lê 8 linhas do arquivo real. Ignora a linha "Total líquido" e as vazias.
  - BTLG11, SNAG11, SNCI11 e XPML11 vêm como "RENDIMENTO" com data 2026-10-23.
  - As 3 de PETR4 e a de EGIE3 vêm com os dados delas. A data do EGIE3 é null.
- [ ] Com um cabeçalho desconhecido, devolve `rowErrors` com "Cabeçalho do extrato não reconhecido.".

**Verify:** `npx tsx --conditions=react-server <scratchpad>/ciclo3/check-eventos.mts` imprime as 8 linhas e `OK`.

**Steps:**

- [ ] **Step 1: tipos em `types.ts`.** Troque `B3FileKind` por `"NEGOCIACAO" | "MOVIMENTACAO" | "EVENTOS" | "PLANILHA"` e acrescente:

```ts
/** Uma linha do extrato de Eventos ("Proventos a Receber"), sem interpretação. */
export type EventoRow = {
  row: number;
  /** Código do produto (antes de " - "), ex.: BTLG11 ou PETR4. */
  code: string;
  /** Tipo do evento, como a B3 escreve (ex.: "RENDIMENTO", "Reembolso - DIVIDENDO"). */
  eventType: string;
  /** Previsão de pagamento; null quando a B3 ainda não informou ("-"). */
  payDate: Date | null;
  quantity: number | null;
  unitPrice: number | null;
  value: number | null;
};

export type EventosData = { rows: EventoRow[]; rowErrors: RowError[] };
```

- [ ] **Step 2: `read-eventos.ts`**

```ts
import type { RowError, SheetInput } from "../parse-planilha";
import { cellText, findColumns, parseB3Date, parseB3Number } from "./cells";
import type { EventoRow, EventosData } from "./types";

const SHEET = "Proventos a Receber";
const COLUMNS = {
  product: "Produto",
  eventType: "Tipo de Evento",
  payDate: "Previsão de pagamento",
  quantity: "Quantidade",
  price: "Preço unitário",
  value: "Valor líquido",
};

/**
 * Extrato de Eventos ("Proventos a Receber"): o que a B3 já anunciou e ainda não pagou.
 * Lê todas as linhas, sem interpretar; quem decide o que entra é o plano (`plan.ts`).
 * A última linha ("Total líquido") não tem produto e fica de fora.
 */
export function readEventos(sheets: readonly SheetInput[]): EventosData {
  const data = sheets[0]?.data ?? [];
  const columns = findColumns(data[0] ?? [], COLUMNS);
  if (!columns) {
    return {
      rows: [],
      rowErrors: [
        { sheet: SHEET, row: 1, ticker: null, message: "Cabeçalho do extrato não reconhecido." },
      ],
    };
  }
  const rows: EventoRow[] = [];
  const rowErrors: RowError[] = [];
  data.slice(1).forEach((cells, index) => {
    const product = cellText(cells[columns.product]);
    if (!product) return; // linha vazia ou o "Total líquido"
    rows.push({
      row: index + 2,
      code: product.split(" - ")[0]!.trim().toUpperCase(),
      eventType: cellText(cells[columns.eventType]),
      payDate: parseB3Date(cells[columns.payDate]),
      quantity: parseB3Number(cells[columns.quantity]),
      unitPrice: parseB3Number(cells[columns.price]),
      value: parseB3Number(cells[columns.value]),
    });
  });
  return { rows, rowErrors };
}
```

- [ ] **Step 3: `detect.ts`.** Antes da checagem da planilha, acrescente:

```ts
  if (has(header, "Produto", "Tipo de Evento", "Previsão de pagamento")) {
    return "EVENTOS";
  }
```

- [ ] **Step 4: exportar** `readEventos` e os tipos `EventoRow` e `EventosData` em `transactions/index.ts`, ao lado de `readMovimentacao`.

- [ ] **Step 5: script `check-eventos.mts`.** Ele lê os três arquivos de 23/10 com `read-excel-file/node` e imprime `detectB3File` de cada um. Depois imprime as linhas de `readEventos` (código, tipo, data, quantidade, preço, valor) e confere os critérios.

- [ ] **Step 6:** `npm run lint && npm run typecheck`. Faça o commit `feat(b3-update): read the B3 Eventos statement (Proventos a Receber)`.

---

### Task 2: o plano com o "a receber", o preço da planilha e as inconsistências

**Goal:** fazer o `planB3Import` devolver a foto do "a receber" (FIIs, Rendimento e Reembolso) e as diferenças de quantidade contra a carteira. Ele também passa a reaproveitar os preços de subscrição gravados com origem PLANILHA.

**Files:**
- Modify: `src/features/transactions/import/b3/types.ts`
- Modify: `src/features/transactions/import/b3/plan.ts`
- Modify: `scripts/import-b3.ts`, que passa `eventos: null`

**Acceptance Criteria:**
- [ ] `PlanInput` ganha `eventos: EventosData | null` e `asOf: Date`.
- [ ] `B3ImportPlan` ganha `upcoming: PlannedUpcoming | null` e `forecastMismatches: ForecastMismatch[]`.
- [ ] **Os quatro FIIs dos arquivos de 23/10:**
  - `upcoming.items` tem BTLG11 (292,41), SNAG11 (1.200), SNCI11 (1.000) e XPML11 (249,32), com `payDate` 2026-10-23 e kind RENDIMENTO;
  - `forecastMismatches` fica vazio, porque as quantidades batem com a carteira.
- [ ] PETR4 e EGIE3 entram em `ignored` ("Ações e units"). Uma linha de FII com evento que não é rendimento entra no motivo "Eventos de FII que não são rendimento".
- [ ] Um preço de subscrição gravado com `priceSource` PLANILHA vale como resposta anterior. O histórico de 17/10, sem a planilha, contra a carteira de produção dá 0 pendências abertas.
- [ ] O script `import:b3` continua compilando e funcionando (`eventos: null`).

**Verify:** `npx tsx --conditions=react-server --env-file=D:\workspace\koinos\.env.local <worktree>/plan-tmp.ts`. É só leitura da produção. O script imprime `upcoming`, `forecastMismatches` e as pendências do histórico completo sem a planilha.

**Steps:**

- [ ] **Step 1: tipos.**

```ts
/** Provento anunciado pela B3 e ainda não pago (extrato de Eventos). */
export type PlannedForecast = {
  ticker: string;
  kind: DividendKind;
  /** Previsão de pagamento; null quando a B3 ainda não informou. */
  payDate: Date | null;
  quantity: number | null;
  perShare: number | null;
  amount: number;
};

/** A foto do "a receber" da B3 no dia do envio: cada envio troca a foto inteira. */
export type PlannedUpcoming = { asOf: Date; items: PlannedForecast[] };

/** Quantidade do "a receber" que não bate com a posição da carteira (só aviso). */
export type ForecastMismatch = { ticker: string; quantity: number; held: number };
```

Acrescente `upcoming: PlannedUpcoming | null` e `forecastMismatches: ForecastMismatch[]` em `B3ImportPlan`.

- [ ] **Step 2: `plan.ts`.**
  - **Preço anterior:** em `previousSubscription`, a condição passa a aceitar `entry.priceSource === "PLANILHA"`. Comentário: "o preço que veio da planilha num envio anterior também vale: a página não recebe mais a planilha".
  - **Assinatura:** `PlanInput` ganha `eventos: EventosData | null` e `asOf: Date`.
  - **Extração:** depois de `extractDividends`, acrescente:

```ts
// --- A receber (spec atualizacao-b3, §3) ---------------------------------------------------

// Map, e não objeto, pelo mesmo motivo de DIVIDEND_ROW_KINDS.
const FORECAST_EVENT_KINDS = new Map<string, DividendKind>([
  ["rendimento", "RENDIMENTO"],
  ["reembolso - rendimento", "REEMBOLSO"],
]);

function extractUpcoming(
  eventos: EventosData,
  asOf: Date,
  managed: (code: string) => boolean,
  addIgnored: (reason: string, code: string) => void,
): PlannedUpcoming {
  const items: PlannedForecast[] = [];
  for (const row of eventos.rows) {
    // Ações e units já entraram nos ignorados pela classificação (o laço de `classificationOf`).
    // Como na Movimentação, o direito ou recibo (…12 a …19) é levado ao FII da família.
    if (!FII_FAMILY_CODE.test(row.code)) continue;
    const ticker = fiiOf(row.code);
    if (!managed(ticker)) continue;
    const kind = FORECAST_EVENT_KINDS.get(normalizeHeader(row.eventType));
    if (!kind || row.value === null || row.value <= 0) {
      addIgnored("Eventos de FII que não são rendimento", row.code);
      continue;
    }
    items.push({
      ticker,
      kind,
      payDate: row.payDate,
      quantity: row.quantity,
      perShare: row.unitPrice,
      amount: row.value,
    });
  }
  return { asOf, items };
}
```

  - **No `planB3Import`:**
    - **Classificação:** chame `classificationOf(row.code)` para cada linha do Eventos, junto com as linhas da Movimentação, para os códigos não gerenciados entrarem nos ignorados.
    - **Foto:** calcule `upcoming = eventos ? extractUpcoming(eventos, input.asOf, managed, addIgnored) : null`. O `addIgnored` acrescenta ao mapa `ignored`.
    - **Diferenças de quantidade:** para cada item, `held = final.states.get(ticker)?.quantity ?? 0`. Entra em `forecastMismatches` quando a quantidade do item difere de `held` em mais de `EPSILON`, ou quando o item não tem quantidade e `held` é 0 ("a receber" de FII sem posição).
    - **Retorno:** devolva os dois campos.

- [ ] **Step 3: `scripts/import-b3.ts`.** Passe `eventos: null, asOf: new Date()` ao `planB3Import`.

- [ ] **Step 4: script de conferência.** É só leitura da produção, com o `.env.local` principal. Ele roda o plano com os três arquivos de 23/10 e `asOf` 2026-10-23, e roda de novo com o histórico de 17/10 sem planilha. Imprime `upcoming.items`, `forecastMismatches`, `ignored` e o número de pendências abertas, que deve ser 0.

- [ ] **Step 5:** lint e typecheck. Faça o commit `feat(b3-update): plan the B3 forecast, reuse spreadsheet prices and flag forecast mismatches`.

---

### Task 3: gravação só da diferença e a foto da B3

**Goal:** a prévia e a confirmação passam a usar a diferença exata.
- O que está igual fica com o mesmo `_id`.
- Só os novos e os substituídos são gravados.
- A foto do "a receber" é trocada.
- A importação exige os três extratos.

**Files:**
- Create: `src/features/transactions/import/b3/changes.ts`, a partir de `dividend-changes.ts`, que é removido
- Create: `src/features/transactions/server/dividend-forecast.model.ts`
- Modify: `src/features/transactions/server/dividend-repo.ts`
- Modify: `src/features/transactions/server/transaction-repo.ts`
- Modify: `src/features/transactions/server/b3-import.ts`
- Modify: `src/features/transactions/import/b3/types.ts`
- Modify: `src/features/transactions/server/transactions-dal.ts`, `src/features/transactions/server.ts`

**Acceptance Criteria:**
- [ ] **`diffLedger(plan, existing)`** devolve `{ insert, removeIds, unchanged, added, replaced }`:
  - um lançamento B3 do período com igual no plano não é removido nem reinserido;
  - um lançamento sem igual é substituído (removido) e o novo, inserido;
  - as repetições contam, como multiconjunto;
  - **pares da prévia:** cada removido forma par (`{ before, after }`) com o primeiro inserido ainda livre do mesmo FII, tipo e data; sem par, `after` é null ("a B3 não mostra mais"). Os inseridos sem par são os `added` ("novos").
- [ ] **`diffDividends(planned, existingWithIds)`** faz o mesmo no escopo e no período dos proventos, com o par pelo FII, tipo e data de pagamento.
- [ ] **`applyB3Update`:**
  - numa transação, apaga pelos ids (com `portfolioId`), insere os novos e troca a foto da carteira (`dividend_forecasts`, um documento por carteira, upsert);
  - um id que não existe mais aborta tudo.
- [ ] **O serviço:**
  - recusa o envio sem os três extratos, com a mensagem de qual falta;
  - recusa a planilha, com a mensagem "A planilha não é mais usada: envie só os três extratos da B3.";
  - recusa dois arquivos do mesmo tipo.
- [ ] **A prévia nova:**
  - os lançamentos e proventos novos e os substituídos, como linhas sem id;
  - a contagem dos iguais;
  - `upcoming` (os itens e `changed`, que diz se a foto difere da gravada);
  - `forecastMismatches` e `nothingNew`.
- [ ] **Na prévia isolada (cópia da produção com o estado de 17/10):** aplicar a diferença dos arquivos de 23/10 insere 3 proventos e a foto com 4 itens. Os 587 `_id` de lançamentos e os 1.284 de proventos continuam os mesmos. Reaplicar não grava nada.

**Verify:** o script `<scratchpad>/ciclo3/check-diff.ts`, copiado para a raiz do worktree, com `--env-file=<scratchpad>/ciclo3/preview.env`. Ele recusa rodar fora de `koinos_preview`. Imprime as contagens, as duas rodadas e a conferência dos ids.

**Steps:**

- [ ] **Step 1: `changes.ts`.** Mova `dividendSignature`, `compareDividends` e `hasDividendOutsideScope` de `dividend-changes.ts` para cá e apague o arquivo antigo, ajustando os imports de `b3-import.ts` e `transaction-repo.ts`. Depois, acrescente:

```ts
/** Linha de lançamento como a prévia mostra (sem id). */
export type LedgerRow = Pick<
  PlannedTransaction,
  "ticker" | "type" | "quantity" | "unitPrice" | "fees" | "date" | "kind" | "priceSource" | "notes"
>;

const ledgerSignature = (entry: LedgerRow & { relatedTicker?: string | null }) =>
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

/**
 * Diferença exata entre o plano e o gravado (spec atualizacao-b3, §4.2): o lançamento B3 do
 * período com um igual no plano fica como está; o resto do que o plano troca sai, e o resto do
 * plano entra. Multiconjunto: repetições contam.
 */
export function diffLedger(
  plan: Pick<B3ImportPlan, "inserts" | "removeIds">,
  existing: readonly (ExistingTransaction & { id: string })[],
) {
  const removing = new Set(plan.removeIds);
  const pool = new Map<string, string[]>();
  for (const entry of existing) {
    if (!removing.has(entry.id) || entry.source !== "B3") continue;
    const key = ledgerSignature(entry);
    pool.set(key, [...(pool.get(key) ?? []), entry.id]);
  }
  const kept = new Set<string>();
  const insert: PlannedTransaction[] = [];
  for (const item of plan.inserts) {
    const id = pool.get(ledgerSignature(item))?.shift();
    if (id) kept.add(id);
    else insert.push(item);
  }
  const removeIds = plan.removeIds.filter((id) => !kept.has(id));
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  const { added, replaced } = pairReplacements(
    removeIds.flatMap((id) => byId.get(id) ?? []),
    insert,
    (entry) => `${entry.ticker}|${entry.type}|${entry.date.toISOString()}`,
  );
  return { insert, removeIds, unchanged: kept.size, added, replaced };
}

/** Uma linha trocada pela B3: a gravada e a do extrato (null quando a B3 não mostra mais). */
export type Replacement<Before, After> = { before: Before; after: After | null };

/** Pares da prévia: cada removido com o primeiro inserido livre da mesma chave. */
function pairReplacements<Before, After>(
  removed: readonly Before[],
  inserted: readonly After[],
  key: (item: Before | After) => string,
) {
  const free = [...inserted];
  const replaced = removed.map((before) => {
    const index = free.findIndex((item) => key(item) === key(before));
    const after = index >= 0 ? free.splice(index, 1)[0]! : null;
    return { before, after };
  });
  return { added: free, replaced };
}
```

  Escreva `diffDividends(planned: PlannedDividends, existing: readonly (DividendEntry & { id: string })[])` no mesmo formato, `{ insert, removeIds, unchanged, added, replaced }`, usando `dividendSignature`, o `scopeTest` que já existe e a chave `ticker|kind|paidAt`.

- [ ] **Step 2: modelo `dividend-forecast.model.ts`.** Um documento por carteira: `{ portfolioId (único), asOf: Date, items: [{ ticker, kind, payDate|null, quantity|null, perShare|null, amount }] }`, na coleção `dividend_forecasts`, com timestamps.

- [ ] **Step 3: repositório.**
  - **`dividend-repo.ts`:**
    - `listDividendRecords(portfolioId)` devolve os proventos com `id`. É só para o serviço da importação.
    - `getDividendForecast(portfolioId)` devolve `{ asOf, items } | null`.
  - **`transaction-repo.ts`:** `applyB3Update(portfolioId, { removeIds, inserts, dividendRemoveIds, dividendInserts, forecast })`.
    - É uma transação.
    - O `deleteMany` filtra por `_id $in` e `portfolioId`. Se a contagem não bater, lança erro.
    - Faz o `insertMany` dos novos e o `updateOne` da foto com upsert.
    - Mantenha o `applyTransactionChanges` para o script.

- [ ] **Step 4: serviço `b3-import.ts`.**
  - **`recognize`:**
    - exige `NEGOCIACAO`, `MOVIMENTACAO` e `EVENTOS`. Com `PLANILHA`, devolve `ActionError` com a mensagem da planilha;
    - a mensagem do que falta diz "Falta o extrato de X";
    - `MAX_FILES` continua 3;
    - `FILE_LABELS` ganha `EVENTOS: "Eventos"`.
  - **`buildPlan`:**
    - lê com `readEventos`;
    - passa `planilha: null`, `eventos` e `asOf: todayTradeDate(new Date())` (de `@/shared/lib/time`);
    - carrega `listDividendRecords` e `getDividendForecast`.
  - **Prévia (`B3UpdatePreview` em `types.ts`):**
    - os campos de hoje, sem `dividends`, `inserts`, `removeIds` e `upcoming`;
    - `entries: { added, replaced, unchanged }`, com `added: PlannedTransaction[]` e `replaced: Replacement<LedgerRow, PlannedTransaction>[]`. `LedgerRow` é `PlannedTransaction & { source }`, para a prévia dizer de onde veio a linha gravada;
    - `dividends: { period, added, replaced, unchanged }`, com `PlannedDividend` dos dois lados;
    - `upcoming: { asOf, items, total, changed }`;
    - `forecastMismatches`, `nothingNew` e `blocked`.
  - **`changed` do upcoming:** é verdadeiro quando não há foto gravada ou quando os itens diferem dos gravados (ticker, kind, payDate, quantidade, valor por cota e valor, como multiconjunto). Só a data da foto diferente não conta: reenviar os mesmos arquivos noutro dia continua "nada novo".
  - **Seleção dos arquivos:** o reconhecimento continua no servidor. O seletor só exige três arquivos, e a prévia lista os tipos reconhecidos (✓ Negociação · ✓ Movimentação · ✓ Eventos).
  - **Confirmação:** dentro da trava, recalcula tudo. Aplica `applyB3Update` só se houver diferença nos lançamentos ou nos proventos, ou se `upcoming.changed` for verdadeiro. Quando grava, grava também a foto, com o `asOf` do envio. Devolve as contagens.
  - **Resultado:** troque `B3ImportResult` pelas contagens de lançamentos, proventos e a receber. Ajuste a action e o aviso do assistente na Task 5.

- [ ] **Step 5: DAL.** `getMyDividendForecast = cache(async () => getDividendForecast((await getTenant()).portfolioId))`. Exporte em `transactions/server.ts`.

- [ ] **Step 6: conferência na prévia.**
  1. Rode o seed (`<scratchpad>/aporte/seed-preview.ts`, copiado para a raiz e com `--env-file=<scratchpad>/ciclo3/preview.env`).
  2. Rode o `npm run import:b3` com os extratos de 17/10, a planilha e `--email previa@koinos.local`. Isso reproduz a produção.
  3. Rode o `check-diff.ts`. Ele chama o plano com os três arquivos de 23/10 e calcula as diferenças.
     - Antes de aplicar, guarda os ids.
     - Aplica `applyB3Update` e confere: 3 proventos novos, foto com 4 itens, mesmos ids antes e depois.
     - Roda de novo e confere que não há diferença nenhuma e que a foto não mudou.

- [ ] **Step 7:** lint e typecheck. Faça o commit `feat(b3-update): write only the difference and keep the B3 forecast snapshot`.

---

### Task 4: o "a receber" de `/proventos` com a foto da B3

**Goal:** quando há foto da B3, ela é a fonte do "a receber", com a data oficial. O Yahoo só entra com data ex depois do envio.

**Files:**
- Modify: `src/features/portfolio/domain/types.ts`
- Modify: `src/features/portfolio/domain/dividends.ts`
- Modify: `src/features/portfolio/server/dividends-view.ts`
- Modify: `src/features/portfolio/components/dividends/upcoming-list.tsx`
- Modify: `src/features/portfolio/components/dividends/month-cards.tsx`

**Acceptance Criteria:**
- [ ] **`UpcomingDividend`** ganha `source: "B3" | "YAHOO"`. `exDate` e `payBy` passam a aceitar null, porque a B3 não dá a data ex e pode não dar a de pagamento.
- [ ] **`upcomingDividends({ …, forecast })`:**
  - **Com foto:** todos os itens da B3 entram, com `payBy` igual a `payDate` e origem B3. Do Yahoo, só entram anúncios com data ex depois de `forecast.asOf`, pelas regras de hoje.
  - **Sem foto:** fica como hoje.
- [ ] **`monthSummary`:** soma os itens da B3 com `payBy` no mês atual e os do Yahoo pelas regras de hoje. Item sem data ou de outro mês fica fora do total.
- [ ] **Teste sintético:**
  - com a foto de 23/10 (4 itens) e os anúncios do Yahoo de hoje, a lista tem os 4 da B3 e nenhum Yahoo duplicado;
  - um anúncio do Yahoo com data ex em 24/10 entra como estimado;
  - um item da B3 com pagamento em novembro aparece na lista, mas fica fora do total de outubro.
- [ ] **A lista:**
  - **Coluna "Origem":** badge "B3" ou "estimado".
  - **Data ex:** "—" nos itens da B3.
  - **Pagamento:** a data oficial, ou "~ até" no estimado, "a confirmar" quando a data passou e "sem data" quando falta.

**Verify:** `npx tsx --conditions=react-server <scratchpad>/ciclo3/check-upcoming.mts` imprime só `OK`.

**Steps:**

- [ ] **Step 1: tipos e domínio.** Acrescente `forecast?: { asOf: Date; items: readonly ForecastItem[] } | null` à entrada de `upcomingDividends`. `ForecastItem` tem a mesma forma de `PlannedForecast`. Declare o tipo em `portfolio/domain/types.ts`, porque o domínio não importa da importação da B3.
  - **Com foto:** os itens viram `{ ticker, exDate: null, quantity: quantity ?? 0, perShare: perShare ?? 0, amount, payBy: payDate, source: "B3" }`, e os do Yahoo são filtrados por `exDate > forecast.asOf`.
  - **Ordem:** por `payBy`, com os null no fim, e depois por `exDate`.
- [ ] **Step 2: `monthSummary`.** Conta os itens da B3 só quando `payBy` cai no mês atual. Os do Yahoo continuam como hoje.
- [ ] **Step 3: `dividends-view.ts`.**
  - Carrega `getMyDividendForecast()` junto com os outros dados e passa ao domínio.
  - `payByPassed` fica `payBy !== null && payBy < hoje`.
- [ ] **Step 4: telas.**
  - Na lista, acrescente a coluna "Origem", com o Badge "B3" ou "estimado", e trate `exDate`/`payBy` null.
  - Troque a nota do card "A receber" para "Pela B3 (Proventos a Receber), completado com o Yahoo" quando houver foto. Sem foto, a nota fica a de hoje. Leve `forecastAsOf` no `DividendsView`.
- [ ] **Step 5: teste sintético e commit.** Faça o commit `feat(dividends): B3 forecast as the official "a receber", Yahoo only after the upload`.

---

### Task 5: a página `/atualizacao-b3` e a navegação

**Goal:** criar a página nova com os três extratos e as seções da prévia, o item no menu e o redirecionamento da rota antiga.

**Files:**
- Create: `src/app/(app)/atualizacao-b3/page.tsx`
- Modify: `src/app/(app)/transacoes/importar/page.tsx`, que passa a ser um `redirect("/atualizacao-b3")`
- Modify: `src/features/transactions/components/b3-import/{b3-import-wizard,file-picker,preview-sections}.tsx`
- Modify: `src/shared/components/app-sidebar.tsx`, `src/proxy.ts`, `src/app/globals.css`
- Modify: `src/app/(app)/transacoes/page.tsx`, `src/features/portfolio/components/empty-portfolio.tsx`, `src/features/portfolio/components/dividends/empty-dividends.tsx`

**Acceptance Criteria:**
- [ ] O menu ganha "Atualização B3" depois de "Proventos", com azulejo próprio. A rota entra no `matcher` do proxy.
- [ ] `/transacoes/importar` redireciona para `/atualizacao-b3`. Os três botões "Importar da B3" levam para lá.
- [ ] **O seletor:**
  - pede os três extratos e diz quais foram reconhecidos;
  - "Gerar prévia" só libera com 3 arquivos;
  - o texto explica onde baixar cada um na Área do Investidor (Extratos → Negociação, Movimentação e Eventos → "Proventos a Receber").
- [ ] **A prévia mostra:**
  - o resumo: lançamentos, proventos e a receber, cada um com novos, substituídos e iguais;
  - as tabelas dos novos;
  - os substituídos, com o "sai" e o "entra";
  - as inconsistências: as pendências de hoje, os FIIs de fora, as divergências com "Revisei" e os avisos de quantidade do a receber;
  - os ignorados.
  - Com `nothingNew` e nenhuma mudança na foto, ela diz "Nada novo: a carteira já está igual aos extratos" e não oferece "Importar".
- [ ] **O aviso de sucesso** usa as contagens novas. Por exemplo: "Atualizado. Proventos: 3 novos · A receber: 4".
- [ ] O build lista `/atualizacao-b3` como ◐.

**Verify:** `npm run build`. A página é conferida no navegador na Task 6.

**Steps:**
- [ ] Adapte os componentes de `b3-import` à prévia nova da Task 3. Mantenha a lista de pendências e as respostas como estão.
- [ ] Na página, use `PageHeader` com o título "Atualização da B3" e a descrição "Envie os três extratos da Área do Investidor: o que for novo entra, e o que a B3 mostrar diferente substitui o que está gravado.".
- [ ] **Navegação:**
  - no menu, use o ícone `RefreshCwIcon` e o azulejo `--tile-indigo: linear-gradient(180deg, #7d7aff, #5856d6);`;
  - no matcher, acrescente `"/atualizacao-b3/:path*"`;
  - todo `Button` com `render={<Link />}` leva `nativeButton={false}`.
- [ ] Rode `npm run format`, lint, typecheck e build. Faça o commit `feat(b3-update): dedicated /atualizacao-b3 page for the three B3 statements`.

---

### Task 6: ensaio completo, documentação, deploy e a atualização com os arquivos do usuário

**Goal:**
1. conferir na prévia isolada todos os critérios do spec (§1), pela tela;
2. atualizar a documentação e publicar;
3. aplicar em produção os três extratos de 23/10, que o usuário pediu, com backup.

**Files:**
- Modify: `CLAUDE.md` (a seção de importação da B3, os comandos e o fluxo de domínio) e `README.md`.

**Acceptance Criteria:**
- [ ] **Na prévia isolada, que reproduz a produção:**
  - **O envio pela tela:**
    - **A prévia:** os três arquivos dão os números do critério 1.
    - **Depois de importar:** o banco tem 3 proventos novos e a foto com 4 itens, e os ids não mudaram (critério 2).
    - **O reenvio:** dá "Nada novo" (critério 3).
    - **Com 2 arquivos:** a importação fica bloqueada, com a mensagem do extrato que falta (critério 4).
  - **`/proventos`:** mostra os 4 da B3 com data 23/10 e origem B3, sem duplicata do Yahoo (critério 5).
  - **O histórico completo de 17/10 com o Eventos, sem a planilha:** dá 0 pendências (critério 6).
- [ ] Capturas da página nova e de `/proventos` nos dois temas, em 1440 e 390 px, sem rolagem horizontal. O contraste dá 0 falhas.
- [ ] `format:check`, lint, typecheck e build passam. O `CLAUDE.md` e o README descrevem o fluxo novo.
- [ ] Merge com fast-forward e push. O deploy fica Ready.
- [ ] **Em produção, depois do deploy:**
  1. backup da carteira;
  2. dry-run da diferença;
  3. aplicação com o mesmo código: plano, `diffLedger`/`diffDividends` e `applyB3Update`, num script descartável que recusa rodar se o backup não existir;
  4. conferência:
     - **Proventos:** 1.287, dos quais RBRY11, MCCI11 e VGIP11 são os novos.
     - **Foto:** 4 itens.
     - **Lançamentos:** os 587 intactos, com os mesmos `_id`.
- [ ] A prévia isolada é apagada no fim.

**Verify:** a saída dos scripts e as capturas, mostradas ao usuário.
