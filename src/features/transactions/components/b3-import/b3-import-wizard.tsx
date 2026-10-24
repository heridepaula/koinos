"use client";

import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Spinner } from "@/shared/ui/spinner";
import { confirmB3ImportAction, previewB3ImportAction } from "../../actions";
import type { B3ImportPreview, B3ImportResult } from "../../import/b3/types";
import { emptyDraft, toAnswers, type AnswersDraft } from "./answers";
import { FilePicker } from "./file-picker";
import { isOpen, PendingList } from "./pending-list";
import { ToneBanner, ToneTitle } from "./tone";
import {
  DividendCheck,
  IgnoredAndWarnings,
  Inconsistencies,
  itens,
  NewRows,
  novos,
  PreviewSummary,
  Replacements,
  substituidos,
  TickerTable,
  UpcomingPreview,
} from "./preview-sections";

/** Mensagem do aviso depois de gravar: só cita o que mudou de fato (as contagens da prévia). */
function updatedMessage(result: B3ImportResult): string {
  const parts: string[] = [];
  const counts = (label: string, { added, replaced }: B3ImportResult["entries"]) => {
    if (added + replaced === 0) return;
    parts.push(
      `${label}: ${[added > 0 ? novos(added) : null, replaced > 0 ? substituidos(replaced) : null]
        .filter(Boolean)
        .join(", ")}`,
    );
  };
  counts("Lançamentos", result.entries);
  counts("Proventos", result.dividends);
  if (result.upcoming.changed) parts.push(`A receber: ${itens(result.upcoming.items)}`);
  return parts.length > 0
    ? `Atualizado. ${parts.join(" · ")}.`
    : "Nada mudou: a carteira já está igual aos extratos.";
}

/** Atualização pela B3: os três extratos → prévia (com pendências) → gravar só o que é novo. */
export function B3ImportWizard() {
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<AnswersDraft>(emptyDraft);
  const [preview, setPreview] = useState<B3ImportPreview | null>(null);
  const [dirty, setDirty] = useState(false);
  const [done, setDone] = useState<B3ImportResult | null>(null);
  // Por que a última prévia não saiu (ex.: qual extrato falta): fica até mudar os arquivos.
  const [problem, setProblem] = useState<string | null>(null);

  const toForm = () => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("answers", JSON.stringify(toAnswers(draft, preview)));
    form.append("acceptDivergences", String(draft.acceptDivergences));
    return form;
  };
  const reset = (next: File[]) => {
    setFiles(next);
    setPreview(null);
    setDraft(emptyDraft());
    setDirty(false);
    setProblem(null);
  };
  const previewAction = useAction(previewB3ImportAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      setPreview(data);
      setDirty(false);
      setProblem(null);
    },
    onError: ({ error }) => {
      const message = actionErrorMessage(error);
      setProblem(message);
      toast.error(message);
    },
  });
  const confirmAction = useAction(confirmB3ImportAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      toast.success(updatedMessage(data));
      setDone(data);
      reset([]);
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
    preview !== null &&
    !preview.nothingNew &&
    !preview.blocked &&
    !dirty &&
    (!divergent || draft.acceptDivergences);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Extratos</CardTitle>
          <CardDescription>
            Na Área do Investidor da B3, em Extratos, baixe em Excel os três do mesmo dia:
            Negociação, Movimentação e Eventos (a aba Proventos a Receber). Negociação e
            Movimentação precisam cobrir o período que você quer atualizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FilePicker
            files={files}
            onChange={(next) => {
              setDone(null);
              reset(next);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={preview ? "outline" : "default"}
              disabled={files.length === 0 || busy}
              onClick={() => previewAction.execute(toForm())}
            >
              {previewAction.isPending ? <Spinner /> : null}
              {preview ? "Atualizar prévia" : "Gerar prévia"}
            </Button>
            {preview && !preview.nothingNew ? (
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
          {/* O servidor reconhece cada arquivo: é ele quem diz qual extrato falta ou sobra. */}
          {problem ? <ToneBanner role="alert" tone="bad" title={problem} /> : null}
          {preview?.nothingNew && !dirty ? (
            <ToneBanner tone="ok" title="Nada novo: a carteira já está igual aos extratos." />
          ) : null}
          {preview && dirty ? (
            <p className="text-sm text-muted-foreground">
              Você mudou respostas: atualize a prévia para conferir antes de importar.
            </p>
          ) : null}
          {preview?.blocked && !dirty ? (
            <ToneBanner
              tone="bad"
              title="Responda as pendências (ou deixe o FII de fora) para liberar a importação."
            />
          ) : null}
        </CardContent>
      </Card>

      {done && !preview ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <ToneTitle tone="ok">Atualização gravada</ToneTitle>
            </CardTitle>
            <CardDescription>{updatedMessage(done)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/proventos" />}>
              Ver proventos
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/transacoes" />}>
              Ver transações
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {preview ? (
        <>
          <PreviewSummary preview={preview} />
          {preview.pending.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <ToneTitle tone={preview.pending.some(isOpen) ? "bad" : "ok"}>
                    Pendências
                  </ToneTitle>
                </CardTitle>
                <CardDescription>
                  O que a B3 não informa e só você sabe. {preview.pending.filter(isOpen).length} sem
                  resposta; as demais já vêm preenchidas de um envio anterior e podem ser
                  corrigidas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PendingList preview={preview} draft={draft} onChange={change} />
              </CardContent>
            </Card>
          ) : null}
          <Inconsistencies preview={preview} />
          <DividendCheck
            preview={preview}
            accepted={draft.acceptDivergences}
            onAccept={(value) => setDraft({ ...draft, acceptDivergences: value })}
          />
          <NewRows preview={preview} />
          <Replacements preview={preview} />
          <UpcomingPreview preview={preview} />
          <TickerTable preview={preview} />
          <IgnoredAndWarnings preview={preview} />
        </>
      ) : null}
    </div>
  );
}
