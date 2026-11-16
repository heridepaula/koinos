"use client";

import { AlertTriangleIcon, CircleCheckIcon, InfoIcon, OctagonAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import type { AuditFinding, FindingSeverity, FiscalYearReport } from "../domain/types";
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

function Finding({ finding }: { finding: AuditFinding }) {
  return (
    <li className="py-2">
      <p>{finding.message}</p>
      {finding.ticker || finding.month ? (
        <p className="text-footnote text-muted-foreground">
          {[finding.ticker, finding.month ? monthText(finding.month) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Aba "Resumo e auditoria": o estado das pendências e os achados das regras, por severidade. O
 * `actions` do cabeçalho é o lugar do "Gerar textos com IA" (ainda sem botão).
 */
export function AuditList({ report, actions }: { report: FiscalYearReport; actions?: ReactNode }) {
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
          {actions ? <CardAction>{actions}</CardAction> : null}
        </CardHeader>
        <CardContent>
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
