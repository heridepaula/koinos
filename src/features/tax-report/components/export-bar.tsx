"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { reportToCopyText, reportToJson } from "../domain/export";
import type { FiscalYearReport } from "../domain/types";
import { CopyButton } from "./copy-button";

const PRIVACY_NOTICE =
  "O arquivo, o texto copiado e a impressão contêm seus valores, mesmo com o modo privado ligado.";

/**
 * Copiar tudo, baixar o JSON e imprimir. O conteúdo exportado sai completo, sem as máscaras do
 * modo privado (que só valem na tela); `generatedAt` é a hora do clique.
 */
export function ExportBar({ report }: { report: FiscalYearReport }) {
  function downloadJson() {
    const blob = new Blob([reportToJson(report, new Date())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `koinos-ir-${report.year}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.info(PRIVACY_NOTICE);
  }

  function print() {
    toast.info(PRIVACY_NOTICE);
    // Dá um respiro para o aviso não ficar por cima do diálogo de impressão.
    setTimeout(() => window.print(), 150);
  }

  return (
    <div className="grid gap-2" data-print-hide>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton
          label="Copiar tudo"
          text={() => reportToCopyText(report, new Date())}
          onCopied={() => toast.info(PRIVACY_NOTICE)}
        />
        <Button type="button" variant="outline" size="sm" onClick={downloadJson}>
          <DownloadIcon />
          Baixar JSON
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={print}>
          <PrinterIcon />
          Imprimir
        </Button>
      </div>
      <p className="text-footnote text-muted-foreground">{PRIVACY_NOTICE}</p>
    </div>
  );
}
