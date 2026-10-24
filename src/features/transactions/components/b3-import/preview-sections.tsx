import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DividendKind, TransactionKind } from "../../domain/types";
import type {
  B3ImportPreview,
  PlannedDividend,
  PlannedTransaction,
  StoredLedgerRow,
} from "../../import/b3/types";
import { isOpen } from "./pending-list";
import { ToneBadge, ToneBanner, ToneIcon, ToneTitle, type Tone } from "./tone";

const FILE_LABELS = {
  NEGOCIACAO: "Negociação",
  MOVIMENTACAO: "Movimentação",
  EVENTOS: "Eventos",
  PLANILHA: "Sua planilha",
} as const;
const KIND_LABELS: Record<Exclude<TransactionKind, "NEGOCIO">, string> = {
  SUBSCRICAO: "Subscrição",
  DESDOBRO: "Desdobro",
  INCORPORACAO: "Incorporação",
  FRACAO: "Leilão de fração",
  POSICAO_ANTERIOR: "Posição anterior",
};
const DIVIDEND_LABELS: Record<DividendKind, string> = {
  RENDIMENTO: "Rendimento",
  REEMBOLSO: "Reembolso",
};
const SOURCE_LABELS: Record<StoredLedgerRow["source"], string> = {
  MANUAL: "manual",
  PLANILHA: "da planilha",
  B3: "da B3",
};
const STATUS: Record<B3ImportPreview["tickers"][number]["status"], { label: string; tone: Tone }> =
  {
    OK: { label: "ok", tone: "ok" },
    PENDENTE: { label: "pendente", tone: "warn" },
    FORA: { label: "de fora", tone: "bad" },
  };
// A primeira e a última célula de cada linha encostam na margem do card.
const ROW_EDGES = "[&>td:first-child]:pl-6 [&>td:last-child]:pr-6";

/** "1 novo" ou "N novos", com o separador de milhar em pt-BR. */
export const novos = (count: number) =>
  `${formatQuantity(count)} ${count === 1 ? "novo" : "novos"}`;
/** "1 substituído" ou "N substituídos". */
export const substituidos = (count: number) =>
  `${formatQuantity(count)} ${count === 1 ? "substituído" : "substituídos"}`;
/** "1 item" ou "N itens". */
export const itens = (count: number) =>
  `${formatQuantity(count)} ${count === 1 ? "item" : "itens"}`;
const iguais = (count: number) => `${formatQuantity(count)} ${count === 1 ? "igual" : "iguais"}`;

const entryType = (entry: PlannedTransaction) =>
  entry.kind === "NEGOCIO"
    ? entry.type === "BUY"
      ? "Compra"
      : "Venda"
    : `${KIND_LABELS[entry.kind]} (${entry.type === "BUY" ? "entrada" : "saída"})`;

/** Os avisos da §5 do spec que não bloqueiam: FIIs de fora e "a receber" fora da carteira. */
const warningsOf = (preview: B3ImportPreview) => ({
  outside: preview.tickers.filter((item) => item.status === "FORA"),
  mismatches: preview.forecastMismatches,
});

export function PreviewSummary({ preview }: { preview: B3ImportPreview }) {
  const { entries, dividends, upcoming } = preview;
  const { outside, mismatches } = warningsOf(preview);
  const inconsistencies =
    preview.pending.filter(isOpen).length +
    preview.check.unexplained.length +
    outside.length +
    mismatches.length;
  const unconfirmed = preview.tickers.filter((item) => item.unconfirmed > 0);
  const open = preview.pending.filter(isOpen).length;
  const rows: { label: string; value: string; tone: Tone }[] = [
    {
      label: "Lançamentos",
      tone: "ok",
      value: `${novos(entries.added.length)} · ${substituidos(entries.replaced.length)} · ${iguais(entries.unchanged)}`,
    },
    {
      label: "Proventos recebidos",
      tone: "ok",
      value: `${novos(dividends.added.length)} · ${substituidos(dividends.replaced.length)} · ${iguais(dividends.unchanged)}`,
    },
    {
      label: "A receber",
      tone: mismatches.length > 0 ? "warn" : "ok",
      value: `${itens(upcoming.items.length)} · ${formatBRL(upcoming.total)} · ${upcoming.changed ? "passa a valer em Proventos" : "igual ao que já está gravado"}`,
    },
    {
      label: "Inconsistências",
      tone: inconsistencies === 0 ? "ok" : "warn",
      value: inconsistencies === 0 ? "nenhuma" : `${formatQuantity(inconsistencies)}: veja abaixo`,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prévia</CardTitle>
        <CardDescription>
          Lançamentos de {formatTradeDate(preview.period.start)} a{" "}
          {formatTradeDate(preview.period.end)} e proventos de{" "}
          {formatTradeDate(dividends.period.start)} a {formatTradeDate(dividends.period.end)}. Nesse
          período, o que a B3 mostra substitui o que está gravado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <SummaryBanner
          nothingNew={preview.nothingNew}
          open={open}
          divergences={preview.check.unexplained.length}
          warnings={outside.length + mismatches.length}
        />
        <div className="flex flex-wrap gap-2">
          {preview.files.map((kind) => (
            <ToneBadge key={kind} tone="ok">
              {FILE_LABELS[kind]}
            </ToneBadge>
          ))}
        </div>
        <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="flex items-center gap-2 font-medium">
                <ToneIcon tone={row.tone} />
                {row.label}
              </dt>
              <dd className="text-muted-foreground tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        {unconfirmed.length > 0 ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <ToneIcon tone="bad" className="mt-0.5" />
            Sem confirmação da B3 no período (saem):{" "}
            {unconfirmed.map((item) => `${item.ticker} (${item.unconfirmed})`).join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const plural = (count: number, one: string, many: string) =>
  `${formatQuantity(count)} ${count === 1 ? one : many}`;

/** A situação da prévia num relance: o que impede, o que vale conferir ou que está tudo certo. */
function SummaryBanner({
  nothingNew,
  open,
  divergences,
  warnings,
}: {
  nothingNew: boolean;
  open: number;
  divergences: number;
  warnings: number;
}) {
  if (open > 0) {
    return (
      <ToneBanner tone="bad" title={`${plural(open, "pendência", "pendências")} sem resposta`}>
        Responda abaixo (ou deixe o FII de fora) para liberar a importação.
      </ToneBanner>
    );
  }
  if (divergences > 0 || warnings > 0) {
    const parts = [
      divergences > 0
        ? `${plural(divergences, "divergência", "divergências")} nos rendimentos`
        : null,
      warnings > 0 ? plural(warnings, "aviso", "avisos") : null,
    ].filter(Boolean);
    return (
      <ToneBanner tone="warn" title={`Vale conferir: ${parts.join(" e ")}`}>
        {divergences > 0
          ? "Revise as divergências e confirme na conferência pelos rendimentos para importar."
          : "Os avisos não bloqueiam a importação."}
      </ToneBanner>
    );
  }
  return nothingNew ? (
    <ToneBanner tone="ok" title="Nada novo: a carteira já está igual aos extratos" />
  ) : (
    <ToneBanner tone="ok" title="Tudo certo nos extratos">
      Nenhuma pendência, divergência ou aviso: dá para importar.
    </ToneBanner>
  );
}

function EntryHead({ label }: { label?: string }) {
  return (
    <TableRow>
      {label ? <TableHead className="pl-6">{label}</TableHead> : null}
      <TableHead className={label ? undefined : "pl-6"}>Data</TableHead>
      <TableHead>FII</TableHead>
      <TableHead className="hidden @min-[480px]:table-cell">Tipo</TableHead>
      <TableHead className="hidden text-right @min-[600px]:table-cell">Cotas</TableHead>
      <TableHead className="hidden text-right @min-[600px]:table-cell">Preço</TableHead>
      <TableHead className="pr-6 text-right">Valor</TableHead>
    </TableRow>
  );
}

function EntryCells({ entry }: { entry: PlannedTransaction }) {
  return (
    <>
      <TableCell className="tabular-nums">{formatTradeDate(entry.date)}</TableCell>
      <TableCell className="font-medium">{entry.ticker}</TableCell>
      <TableCell className="hidden @min-[480px]:table-cell">{entryType(entry)}</TableCell>
      <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
        {formatQuantity(entry.quantity)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
        {formatBRL(entry.unitPrice)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatBRL(entry.quantity * entry.unitPrice + entry.fees)}
      </TableCell>
    </>
  );
}

function DividendHead({ label }: { label?: string }) {
  return (
    <TableRow>
      {label ? <TableHead className="pl-6">{label}</TableHead> : null}
      <TableHead className={label ? undefined : "pl-6"}>Pagamento</TableHead>
      <TableHead>FII</TableHead>
      <TableHead className="hidden @min-[480px]:table-cell">Tipo</TableHead>
      <TableHead className="hidden text-right @min-[600px]:table-cell">Cotas</TableHead>
      <TableHead className="pr-6 text-right">Valor</TableHead>
    </TableRow>
  );
}

function DividendCells({ item }: { item: PlannedDividend }) {
  return (
    <>
      <TableCell className="tabular-nums">{formatTradeDate(item.paidAt)}</TableCell>
      <TableCell className="font-medium">{item.ticker}</TableCell>
      <TableCell className="hidden @min-[480px]:table-cell">{DIVIDEND_LABELS[item.kind]}</TableCell>
      <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
        {item.quantity !== null ? formatQuantity(item.quantity) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatBRL(item.amount)}</TableCell>
    </>
  );
}

/** Lançamentos e proventos que entram sem substituir nada. */
export function NewRows({ preview }: { preview: B3ImportPreview }) {
  const { entries, dividends } = preview;
  return (
    <>
      {entries.added.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <ToneTitle tone="ok">Lançamentos novos</ToneTitle>
            </CardTitle>
            <CardDescription>Entram na carteira com a origem B3.</CardDescription>
          </CardHeader>
          <CardContent className="@container px-0">
            <Table>
              <TableHeader>
                <EntryHead />
              </TableHeader>
              <TableBody>
                {entries.added.map((entry, index) => (
                  <TableRow key={index} className={ROW_EDGES}>
                    <EntryCells entry={entry} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      {dividends.added.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <ToneTitle tone="ok">Proventos novos</ToneTitle>
            </CardTitle>
            <CardDescription>
              Rendimentos e reembolsos que a Movimentação mostra como pagos.
            </CardDescription>
          </CardHeader>
          <CardContent className="@container px-0">
            <Table>
              <TableHeader>
                <DividendHead />
              </TableHeader>
              <TableBody>
                {dividends.added.map((item, index) => (
                  <TableRow key={index} className={ROW_EDGES}>
                    <DividendCells item={item} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

/** Cada linha gravada que a B3 troca, com a do extrato logo abaixo. */
export function Replacements({ preview }: { preview: B3ImportPreview }) {
  const { entries, dividends } = preview;
  if (entries.replaced.length === 0 && dividends.replaced.length === 0) return null;
  const gone = (columns: number) => (
    <TableCell colSpan={columns} className="text-loss">
      <span className="flex items-center gap-2">
        <ToneIcon tone="bad" />A B3 não mostra mais: sai.
      </span>
    </TableCell>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <ToneTitle tone="warn">Substituídos pela B3</ToneTitle>
        </CardTitle>
        <CardDescription>
          Onde o extrato diverge do que está gravado, vale o extrato: a linha gravada sai e a do
          extrato entra.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container grid gap-6 px-0">
        {entries.replaced.length > 0 ? (
          <Table>
            <TableHeader>
              <EntryHead label="Lançamento" />
            </TableHeader>
            <TableBody>
              {entries.replaced.flatMap(({ before, after }, index) => [
                <TableRow key={`${index}-gravado`} className={`border-b-0 ${ROW_EDGES}`}>
                  <TableCell className="text-muted-foreground">
                    Gravado ({SOURCE_LABELS[before.source]})
                  </TableCell>
                  <EntryCells entry={before} />
                </TableRow>,
                <TableRow key={`${index}-extrato`} className={ROW_EDGES}>
                  <TableCell className="font-medium text-gain">Extrato</TableCell>
                  {after ? <EntryCells entry={after} /> : gone(6)}
                </TableRow>,
              ])}
            </TableBody>
          </Table>
        ) : null}
        {dividends.replaced.length > 0 ? (
          <Table>
            <TableHeader>
              <DividendHead label="Provento" />
            </TableHeader>
            <TableBody>
              {dividends.replaced.flatMap(({ before, after }, index) => [
                <TableRow key={`${index}-gravado`} className={`border-b-0 ${ROW_EDGES}`}>
                  <TableCell className="text-muted-foreground">Gravado</TableCell>
                  <DividendCells item={before} />
                </TableRow>,
                <TableRow key={`${index}-extrato`} className={ROW_EDGES}>
                  <TableCell className="font-medium text-gain">Extrato</TableCell>
                  {after ? <DividendCells item={after} /> : gone(5)}
                </TableRow>,
              ])}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** A foto do "a receber" que o extrato de Eventos traz. */
export function UpcomingPreview({ preview }: { preview: B3ImportPreview }) {
  const { upcoming } = preview;
  return (
    <Card>
      <CardHeader>
        <CardTitle>A receber</CardTitle>
        <CardDescription>
          Proventos a Receber da B3 em {formatTradeDate(upcoming.asOf)}.{" "}
          {upcoming.changed
            ? "A lista inteira passa a valer em Proventos, no lugar da anterior."
            : "É a mesma lista que já está gravada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="@container px-0">
        {upcoming.items.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            A B3 não lista nenhum rendimento de FII a receber.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">FII</TableHead>
                <TableHead className="hidden @min-[480px]:table-cell">Tipo</TableHead>
                <TableHead className="hidden text-right @min-[600px]:table-cell">Cotas</TableHead>
                <TableHead className="hidden text-right @min-[600px]:table-cell">
                  Por cota
                </TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="pr-6 text-right">Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.items.map((item, index) => (
                <TableRow key={`${item.ticker}-${index}`} className={ROW_EDGES}>
                  <TableCell className="font-medium">{item.ticker}</TableCell>
                  <TableCell className="hidden @min-[480px]:table-cell">
                    {DIVIDEND_LABELS[item.kind]}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
                    {item.quantity !== null ? formatQuantity(item.quantity) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[600px]:table-cell">
                    {item.perShare !== null ? formatBRL(item.perShare) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(item.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {item.payDate ? formatTradeDate(item.payDate) : "sem data"}
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

/** FIIs que ficam de fora e "a receber" que não bate com a carteira: só avisam. */
export function Inconsistencies({ preview }: { preview: B3ImportPreview }) {
  const { outside, mismatches } = warningsOf(preview);
  if (outside.length === 0 && mismatches.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <ToneTitle tone="warn">Inconsistências</ToneTitle>
        </CardTitle>
        <CardDescription>Não bloqueiam a atualização, mas valem uma conferência.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <ul className="grid gap-2">
          {outside.map((item) => (
            <li key={`fora-${item.ticker}`} className="flex items-start gap-2">
              <ToneIcon tone="bad" className="mt-0.5" />
              <span>
                <span className="font-medium">{item.ticker}</span> fica de fora:{" "}
                {item.reasons.join(" ")}{" "}
                <span className="text-muted-foreground">
                  O que ele já tem na carteira continua como está.
                </span>
              </span>
            </li>
          ))}
          {mismatches.map((item, index) => (
            <li key={`receber-${item.ticker}-${index}`} className="flex items-start gap-2">
              <ToneIcon tone="warn" className="mt-0.5" />
              <span>
                <span className="font-medium">{item.ticker}</span>:{" "}
                {item.held < 1e-6
                  ? "a B3 lista um provento a receber, mas a carteira não tem cotas dele."
                  : `a B3 lista ${formatQuantity(item.quantity ?? 0)} cotas a receber, e a carteira tem ${formatQuantity(item.held)}.`}{" "}
                <span className="text-muted-foreground">
                  Confira: pode ser compra ou venda depois da data com.
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function TickerTable({ preview }: { preview: B3ImportPreview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Situação por FII</CardTitle>
        <CardDescription>Como cada FII fica depois da atualização.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">FII</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Cotas</TableHead>
              <TableHead className="text-right">Preço médio</TableHead>
              <TableHead className="pr-6">Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.tickers.map((item) => (
              <TableRow key={item.ticker}>
                <TableCell className="pl-6 font-medium">{item.ticker}</TableCell>
                <TableCell>
                  <ToneBadge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</ToneBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(item.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.quantity > 0 ? formatBRL(item.averagePrice) : "—"}
                </TableCell>
                <TableCell className="min-w-56 pr-6 text-xs whitespace-normal text-muted-foreground">
                  {[
                    ...item.reasons,
                    item.outOfCatalog ? "Fora do catálogo da bolsa." : null,
                    item.group.length > 1
                      ? `Junto com ${item.group.filter((ticker) => ticker !== item.ticker).join(", ")}.`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function IgnoredAndWarnings({ preview }: { preview: B3ImportPreview }) {
  if (preview.ignored.length === 0 && preview.warnings.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ignorados e avisos</CardTitle>
        <CardDescription>
          O app acompanha só os FIIs: o resto dos extratos fica de fora, agrupado por motivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {preview.ignored.map((group) => (
          <p key={group.reason}>
            <span className="font-medium">{group.reason}:</span>{" "}
            <span className="text-muted-foreground">
              {group.codes.slice(0, 20).join(", ")}
              {group.codes.length > 20 ? ` e mais ${group.codes.length - 20}` : ""}
            </span>
          </p>
        ))}
        {preview.warnings.map((warning, index) => (
          <p key={`${index}-${warning}`} className="text-muted-foreground">
            {warning}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

export function DividendCheck({
  preview,
  accepted,
  onAccept,
}: {
  preview: B3ImportPreview;
  accepted: boolean;
  onAccept: (value: boolean) => void;
}) {
  const { check } = preview;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <ToneTitle tone={check.unexplained.length > 0 && !accepted ? "warn" : "ok"}>
            Conferência pelos rendimentos
          </ToneTitle>
        </CardTitle>
        <CardDescription>
          {formatQuantity(check.matched)} de {formatQuantity(check.months)} meses batem com as cotas
          em que a B3 pagou rendimento · {formatQuantity(check.explained.length)} diferenças
          explicadas (aluguel, recibo pró-rata).
        </CardDescription>
      </CardHeader>
      {check.unexplained.length > 0 ? (
        <CardContent className="grid gap-2 text-sm">
          <ul className="grid gap-1">
            {check.unexplained.map((item) => (
              <li key={`${item.ticker}-${item.month}`} className="flex items-start gap-2">
                <ToneIcon tone="warn" className="mt-0.5" />
                <span>
                  {item.ticker} em {item.month}: a B3 pagou sobre {formatQuantity(item.official)}{" "}
                  cotas, e a importação chega a {formatQuantity(item.rebuilt)}.
                </span>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => onAccept(event.target.checked)}
            />
            Revisei as divergências e quero importar mesmo assim
          </label>
        </CardContent>
      ) : null}
    </Card>
  );
}
