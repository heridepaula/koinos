"use client";

import { formatBRL, formatQuantity, formatTradeDate } from "@/shared/lib/format";
import { numberToInput } from "@/shared/lib/parse-number";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/native-select";
import type { B3ImportPreview } from "../../import/b3/types";
import type { AnswersDraft } from "./answers";

type Pending = B3ImportPreview["pending"][number];

/** De onde veio um preço já preenchido. */
const PRICE_ORIGIN: Record<string, string> = {
  USUARIO: "informado por você",
  ESTIMADO: "estimado",
  PLANILHA: "da sua planilha",
  B3: "da B3",
};

/** Ainda sem resposta no servidor (a conversão com sugestão vai confirmada junto). */
export const isOpen = (item: Pending) =>
  item.type === "CONVERSAO" ? item.source === null : item.price === null;

function question(item: Pending, priorDate: Date): string {
  if (item.type === "PRECO_SUBSCRICAO") {
    return `Subscrição de ${item.ticker}: ${formatQuantity(item.quantity)} cotas em ${formatTradeDate(item.date)}. Qual foi o preço por cota?`;
  }
  if (item.type === "POSICAO_ANTERIOR") {
    return `${item.ticker} já tinha ${formatQuantity(item.quantity)} cotas antes do extrato (em ${formatTradeDate(priorDate)}). Qual era o preço médio?`;
  }
  return `${item.ticker} recebeu ${formatQuantity(item.quantity)} cotas em ${formatTradeDate(item.date)} sem compra. Vieram de qual FII?`;
}

/** Pendências da prévia: o que a B3 não informa e só o usuário sabe. */
export function PendingList({
  preview,
  draft,
  onChange,
}: {
  preview: B3ImportPreview;
  draft: AnswersDraft;
  onChange: (draft: AnswersDraft) => void;
}) {
  const excluded = new Set(draft.exclude);
  const toggleExclude = (ticker: string) =>
    onChange({
      ...draft,
      exclude: excluded.has(ticker)
        ? draft.exclude.filter((item) => item !== ticker)
        : [...draft.exclude, ticker],
    });

  // As que esperam resposta vêm primeiro; as já preenchidas seguem abaixo, para conferir.
  const ordered = [...preview.pending].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));

  return (
    <ul className="grid gap-4">
      {ordered.map((item) => {
        const out = excluded.has(item.ticker);
        const stored =
          item.type !== "CONVERSAO" && item.price !== null && draft.prices[item.id] === undefined;
        return (
          <li
            key={item.id}
            className="grid gap-2 border-b border-border pb-4 last:border-0 last:pb-0"
          >
            <p className="text-sm">{question(item, preview.priorDate)}</p>
            <div className="flex flex-wrap items-center gap-3">
              {item.type === "CONVERSAO" ? (
                <NativeSelect
                  aria-label={`Origem das cotas de ${item.ticker}`}

                  disabled={out}
                  value={draft.conversions[item.id] ?? item.source ?? item.suggestion ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      conversions: { ...draft.conversions, [item.id]: event.target.value },
                    })
                  }
                >
                  <option value="" disabled>
                    Escolha a origem
                  </option>
                  {item.candidates.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                      {candidate === item.suggestion ? " (sugestão)" : ""}
                    </option>
                  ))}
                  <option value="NONE">Não é conversão</option>
                </NativeSelect>
              ) : (
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    aria-label={`Preço de ${item.ticker}`}
                    inputMode="decimal"
                    className="w-36 pl-8 tabular-nums"
                    disabled={out}
                    placeholder="0,00"
                    value={
                      draft.prices[item.id] ??
                      (item.price !== null ? numberToInput(item.price) : "")
                    }
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        prices: { ...draft.prices, [item.id]: event.target.value },
                      })
                    }
                  />
                </div>
              )}
              {stored ? (
                <Badge variant="outline">
                  {PRICE_ORIGIN[item.priceSource ?? ""] ?? "já preenchido"} ·{" "}
                  {formatBRL(item.price ?? 0)}
                </Badge>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={out} onChange={() => toggleExclude(item.ticker)} />
                Deixar {item.ticker} de fora
              </label>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
