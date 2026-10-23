import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { B3ImportPreview } from "../../import/b3/types";

const FILE_LABELS = {
  NEGOCIACAO: "Negociação",
  MOVIMENTACAO: "Movimentação",
  EVENTOS: "Eventos",
  PLANILHA: "Sua planilha",
} as const;
const KIND_LABELS: Record<string, [string, string]> = {
  NEGOCIO: ["negócio", "negócios"],
  SUBSCRICAO: ["subscrição", "subscrições"],
  DESDOBRO: ["desdobro", "desdobros"],
  INCORPORACAO: ["lançamento de conversão", "lançamentos de conversão"],
  FRACAO: ["leilão de fração", "leilões de fração"],
  POSICAO_ANTERIOR: ["posição anterior", "posições anteriores"],
};
const kindLabel = (kind: string, count: number) => KIND_LABELS[kind]?.[count === 1 ? 0 : 1] ?? kind;
const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "manuais",
  PLANILHA: "da planilha",
  B3: "da B3",
};
const STATUS = {
  OK: { label: "ok", variant: "secondary" },
  PENDENTE: { label: "pendente", variant: "default" },
  FORA: { label: "de fora", variant: "outline" },
} as const;

export function PreviewSummary({ preview }: { preview: B3ImportPreview }) {
  const totals = Object.entries(preview.totals).filter(([, count]) => count);
  const removedBySource = Object.entries(preview.removedBySource).filter(([, count]) => count);
  const unconfirmed = preview.tickers.filter((item) => item.unconfirmed > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prévia</CardTitle>
        <CardDescription>
          Extratos de {formatTradeDate(preview.period.start)} a{" "}
          {formatTradeDate(preview.period.end)}. Nesse período, os lançamentos de FIIs passam a ser
          os da B3.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {preview.files.map((kind) => (
            <Badge key={kind} variant="secondary">
              {FILE_LABELS[kind]} ✓
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground">
          {totals
            .map(([kind, count]) => `${formatQuantity(count ?? 0)} ${kindLabel(kind, count ?? 0)}`)
            .join(" · ")}
        </p>
        <p>
          <strong>{formatQuantity(preview.changes.added)}</strong> lançamentos novos ·{" "}
          <strong>{formatQuantity(preview.changes.removed)}</strong> saem ·{" "}
          {formatQuantity(preview.changes.unchanged)} já iguais
          {removedBySource.length > 0
            ? ` (a troca inclui ${removedBySource
                .map(([source, count]) => `${count} ${SOURCE_LABELS[source] ?? source}`)
                .join(", ")})`
            : ""}
        </p>
        <p>
          <strong>{formatQuantity(preview.dividendChanges.added)}</strong> proventos novos ·{" "}
          <strong>{formatQuantity(preview.dividendChanges.removed)}</strong> saem ·{" "}
          {formatQuantity(preview.dividendChanges.unchanged)} já iguais
        </p>
        {unconfirmed.length > 0 ? (
          <p className="text-muted-foreground">
            Sem confirmação da B3 no período (saem):{" "}
            {unconfirmed.map((item) => `${item.ticker} (${item.unconfirmed})`).join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TickerTable({ preview }: { preview: B3ImportPreview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Situação por FII</CardTitle>
        <CardDescription>Como cada FII fica depois da importação.</CardDescription>
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
                  <Badge variant={STATUS[item.status].variant}>{STATUS[item.status].label}</Badge>
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
        <CardTitle>Conferência pelos rendimentos</CardTitle>
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
              <li key={`${item.ticker}-${item.month}`}>
                {item.ticker} em {item.month}: a B3 pagou sobre {formatQuantity(item.official)}{" "}
                cotas, e a importação chega a {formatQuantity(item.rebuilt)}.
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
