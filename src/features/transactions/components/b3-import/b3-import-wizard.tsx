"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { formatQuantity } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Spinner } from "@/shared/ui/spinner";
import { confirmB3ImportAction, previewB3ImportAction } from "../../actions";
import type { B3ImportPreview, B3ImportResult } from "../../import/b3/types";
import { emptyDraft, toAnswers, type AnswersDraft } from "./answers";
import { FilePicker } from "./file-picker";
import { isOpen, PendingList } from "./pending-list";
import { DividendCheck, IgnoredAndWarnings, PreviewSummary, TickerTable } from "./preview-sections";

/** Mensagem do aviso depois de importar: só cita o que mudou de fato (as contagens da prévia). */
function importedMessage(result: B3ImportResult | undefined): string {
  const nothing = "Nada mudou: a carteira já está igual aos extratos.";
  if (!result) return nothing;
  const parts: string[] = [];
  const { changes, dividendChanges } = result;
  if (changes.added + changes.removed > 0) {
    parts.push(
      `Lançamentos: ${formatQuantity(changes.added)} novos, ${formatQuantity(changes.removed)} saíram`,
    );
  }
  if (dividendChanges.added + dividendChanges.removed > 0) {
    parts.push(
      `Proventos: ${formatQuantity(dividendChanges.added)} novos, ${formatQuantity(dividendChanges.removed)} saíram`,
    );
  }
  return parts.length > 0 ? `Importado. ${parts.join(" · ")}.` : nothing;
}

/** Importação dos extratos da B3: arquivos → prévia (com pendências) → importar. */
export function B3ImportWizard() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<AnswersDraft>(emptyDraft);
  const [preview, setPreview] = useState<B3ImportPreview | null>(null);
  const [dirty, setDirty] = useState(false);

  const toForm = () => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("answers", JSON.stringify(toAnswers(draft, preview)));
    form.append("acceptDivergences", String(draft.acceptDivergences));
    return form;
  };
  const previewAction = useAction(previewB3ImportAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      setPreview(data);
      setDirty(false);
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });
  const confirmAction = useAction(confirmB3ImportAction, {
    onSuccess: ({ data }) => {
      toast.success(importedMessage(data));
      router.push("/transacoes");
    },
    onError: ({ error }) => toast.error(actionErrorMessage(error)),
  });

  const change = (next: AnswersDraft) => {
    setDraft(next);
    setDirty(true);
  };
  const busy = previewAction.isPending || confirmAction.isPending;
  const divergent = (preview?.check.unexplained.length ?? 0) > 0;
  const canImport =
    preview !== null && !preview.blocked && !dirty && (!divergent || draft.acceptDivergences);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Arquivos</CardTitle>
          <CardDescription>
            Na Área do Investidor da B3, em Extratos, baixe Negociação e Movimentação em Excel,
            cobrindo todo o período que você quer importar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FilePicker
            files={files}
            onChange={(next) => {
              setFiles(next);
              setPreview(null);
              setDraft(emptyDraft());
              setDirty(false);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={preview ? "outline" : "default"}
              disabled={files.length < 2 || busy}
              onClick={() => previewAction.execute(toForm())}
            >
              {previewAction.isPending ? <Spinner /> : null}
              {preview ? "Atualizar prévia" : "Gerar prévia"}
            </Button>
            {preview ? (
              <Button
                type="button"
                disabled={!canImport || busy}
                onClick={() => confirmAction.execute(toForm())}
              >
                {confirmAction.isPending ? <Spinner /> : null}
                Importar
              </Button>
            ) : null}
          </div>
          {preview && dirty ? (
            <p className="text-sm text-muted-foreground">
              Você mudou respostas: atualize a prévia para conferir antes de importar.
            </p>
          ) : null}
          {preview?.blocked && !dirty ? (
            <p className="text-sm text-muted-foreground">
              Responda as pendências (ou deixe o FII de fora) para liberar a importação.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <>
          <PreviewSummary preview={preview} />
          {preview.pending.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Pendências</CardTitle>
                <CardDescription>
                  O que a B3 não informa e só você sabe. {preview.pending.filter(isOpen).length} sem
                  resposta; as demais já vêm preenchidas (da sua planilha ou de um envio anterior) e
                  podem ser corrigidas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PendingList preview={preview} draft={draft} onChange={change} />
              </CardContent>
            </Card>
          ) : null}
          <DividendCheck
            preview={preview}
            accepted={draft.acceptDivergences}
            onAccept={(value) => setDraft({ ...draft, acceptDivergences: value })}
          />
          <TickerTable preview={preview} />
          <IgnoredAndWarnings preview={preview} />
        </>
      ) : null}
    </div>
  );
}
