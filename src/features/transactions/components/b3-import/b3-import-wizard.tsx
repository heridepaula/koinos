"use client";

import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Disclosure } from "@/shared/components/disclosure";
import { InfoSheet } from "@/shared/components/info-sheet";
import { actionErrorMessage } from "@/shared/lib/action-error";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
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

const HOW_TO =
  "Na Área do Investidor da B3, em Extratos, baixe em Excel os três do mesmo dia: Negociação, Movimentação e Eventos (a aba Proventos a Receber). Negociação e Movimentação precisam cobrir o período que você quer atualizar.";

/**
 * Atualização pela B3: os três extratos → prévia (com pendências) → gravar só o que é novo. No
 * iPhone, o passo da vez (gerar a prévia, atualizá-la ou importar) fica num botão largo preso
 * acima da tab bar, ao alcance do polegar enquanto a prévia rola; as instruções vão para o ⓘ.
 */
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
  // O passo da vez no botão do iPhone: sem arquivos ou sem nada novo, não há o que fazer.
  const step =
    files.length === 0
      ? null
      : !preview || dirty
        ? {
            label: preview ? "Atualizar prévia" : "Gerar prévia",
            pending: previewAction.isPending,
            disabled: busy,
            run: () => previewAction.execute(toForm()),
          }
        : preview.nothingNew
          ? null
          : {
              label: "Importar",
              pending: confirmAction.isPending,
              disabled: !canImport || busy,
              run: () => confirmAction.execute(toForm()),
            };
  const open = preview?.pending.filter(isOpen).length ?? 0;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Extratos</CardTitle>
          <CardDescription className="max-md:hidden">{HOW_TO}</CardDescription>
          <CardAction className="md:hidden">
            <InfoSheet title="Como baixar os extratos" label="Como baixar os extratos">
              <p>{HOW_TO}</p>
              <p>
                O que for novo entra, e o que a B3 mostrar diferente substitui o que está gravado.
              </p>
            </InfoSheet>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FilePicker
            files={files}
            onChange={(next) => {
              setDone(null);
              reset(next);
            }}
          />
          <div className="flex flex-wrap items-center gap-2 max-md:hidden">
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
              title="Responda as pendências (ou deixe o ativo de fora) para liberar a importação."
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
                  {open > 0
                    ? `O que a B3 não informa e só você sabe. ${open} sem resposta; as demais já vêm preenchidas de um envio anterior e podem ser corrigidas.`
                    : "O que a B3 não informa e só você sabe: tudo já respondido em envios anteriores."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Sem nada em aberto, as respostas ficam recolhidas: só para conferir. */}
                {open > 0 ? (
                  <PendingList preview={preview} draft={draft} onChange={change} />
                ) : (
                  <Disclosure
                    summary={
                      preview.pending.length === 1
                        ? "Revisar a resposta"
                        : `Revisar as ${preview.pending.length} respostas`
                    }
                  >
                    <PendingList preview={preview} draft={draft} onChange={change} />
                  </Disclosure>
                )}
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

      {step ? (
        <div className="sticky bottom-[calc(var(--tab-bar-height)+var(--tab-bar-bottom)+0.75rem)] z-20 rounded-full p-1.5 glass-strong md:hidden">
          <Button
            type="button"
            className="h-12 w-full text-headline"
            disabled={step.disabled}
            onClick={step.run}
          >
            {step.pending ? <Spinner /> : null}
            {step.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
