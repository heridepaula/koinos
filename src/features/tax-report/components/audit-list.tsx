"use client";

import { AlertTriangleIcon, CircleCheckIcon, InfoIcon, OctagonAlertIcon } from "lucide-react";
import { Sensitive } from "@/shared/components/sensitive";
import { cn } from "@/shared/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { moneySegments } from "../domain/money-segments";
import type {
  AuditFinding,
  FindingSeverity,
  FiscalYearReport,
  TaxNarrativesView,
} from "../domain/types";
import { GenerateNarrativesButton } from "./generate-narratives-button";
import { monthText } from "./parts";

const SEVERITIES: {
  id: FindingSeverity;
  title: string;
  tone: string;
  icon: typeof InfoIcon;
}[] = [
  { id: "CRITICO", title: "Críticos", tone: "text-loss", icon: OctagonAlertIcon },
  {
    id: "ATENCAO",
    title: "Atenção",
    tone: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangleIcon,
  },
  { id: "INFO", title: "Informativos", tone: "text-muted-foreground", icon: InfoIcon },
];

/** Texto com os valores em R$ escondidos no modo privado. */
function MoneyText({ text }: { text: string }) {
  return (
    <>
      {moneySegments(text).map((segment, index) =>
        segment.money ? (
          <Sensitive key={index}>{segment.text}</Sensitive>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function Finding({ finding, note }: { finding: AuditFinding; note?: string }) {
  return (
    <li className="py-2">
      <p>
        <MoneyText text={finding.message} />
      </p>
      {finding.ticker || finding.month ? (
        <p className="text-footnote text-muted-foreground">
          {[finding.ticker, finding.month ? monthText(finding.month) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {note ? (
        <p className="mt-1 text-footnote text-muted-foreground">
          <MoneyText text={note} />
        </p>
      ) : null}
    </li>
  );
}

/**
 * Aba "Resumo e auditoria": o estado das pendências e os achados das regras, por severidade. A
 * explicação de cada tipo de achado (texto da IA, sem número) aparece uma vez, no primeiro achado
 * daquele tipo; a mensagem de cada achado vem sempre das regras. O botão "Gerar textos com IA"
 * fica no cabeçalho das pendências.
 */
export function AuditList({
  report,
  narratives,
}: {
  report: FiscalYearReport;
  narratives: TaxNarrativesView;
}) {
  const firstOfCode = new Map<string, AuditFinding>();
  for (const finding of report.findings) {
    if (!firstOfCode.has(finding.code)) firstOfCode.set(finding.code, finding);
  }
  const noteOf = (finding: AuditFinding) =>
    firstOfCode.get(finding.code) === finding ? narratives.codes[finding.code] : undefined;
  const hasNotes = Object.keys(narratives.codes).length > 0;
  const count = (code: AuditFinding["code"]) =>
    report.findings.filter((f) => f.code === code).length;
  const missingCnpj = count("CNPJ_AUSENTE");
  const lossPending = count("SALDO_PREJUIZO_NAO_INFORMADO") > 0;

  const pending: { ok: boolean; text: string }[] = [
    {
      ok: missingCnpj === 0,
      text:
        missingCnpj === 0
          ? "Todos os ativos têm CNPJ."
          : `${missingCnpj} ${missingCnpj === 1 ? "ativo sem CNPJ" : "ativos sem CNPJ"}: informe em Bens e Direitos.`,
    },
    {
      ok: !lossPending,
      text: lossPending
        ? "Saldo de prejuízo anterior não informado: informe em Vendas e apuração (zero vale)."
        : "Saldo de prejuízo anterior informado.",
    },
  ];

  return (
    <div className="grid gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pendências</CardTitle>
          <CardDescription>O que falta para os números do ano ficarem completos.</CardDescription>
          <CardAction>
            <GenerateNarrativesButton year={report.year} narratives={narratives} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          {narratives.status === "failed" ? (
            <p className="flex items-start gap-2 text-footnote" role="status">
              <AlertTriangleIcon
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              Os textos automáticos estão indisponíveis agora. Os textos fixos e as mensagens das
              regras seguem valendo.
            </p>
          ) : null}
          <ul className="grid gap-2">
            {pending.map((item) => (
              <li key={item.text} className="flex items-start gap-2">
                {item.ok ? (
                  <CircleCheckIcon
                    className="mt-0.5 size-4 shrink-0 text-gain"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                    aria-hidden="true"
                  />
                )}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Auditoria</CardTitle>
          <CardDescription>
            Regras do Koinos sobre o que você precisa conferir antes de declarar.
            {hasNotes ? " As explicações em cinza foram geradas por IA e não trazem números." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {report.findings.length === 0 ? (
            <p className="text-muted-foreground">Nenhum achado neste ano.</p>
          ) : (
            SEVERITIES.map(({ id, title, tone, icon: Icon }) => {
              const items = report.findings.filter((f) => f.severity === id);
              if (items.length === 0) return null;
              return (
                <section key={id} className="grid gap-1">
                  <h3 className={cn("flex items-center gap-1.5 text-headline", tone)}>
                    <Icon className="size-4" aria-hidden="true" />
                    {title} ({items.length})
                  </h3>
                  <ul className="grid divide-y divide-border">
                    {items.map((finding, index) => (
                      <Finding
                        key={`${finding.code}-${finding.ticker}-${finding.month}-${index}`}
                        finding={finding}
                        note={noteOf(finding)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
