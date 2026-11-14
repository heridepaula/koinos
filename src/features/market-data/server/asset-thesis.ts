import "server-only";
import type { AssetClass } from "../domain/asset-class";
import {
  buildThesisPrompt,
  checkThesis,
  THESIS,
  thesisFromReading,
  thesisSchema,
  type StoredThesis,
  type ThesisEvidence,
} from "../domain/asset-thesis";
import type { GeminiModel } from "../domain/day-insight";
import { generateWithChain } from "./gemini-chain";

// A tese do ativo (spec 2026-11-13-tese-do-ativo-design.md): a chamada ao Gemini em JSON e a
// validação, no padrão de `generateWeekReading`. O prompt sai só de `buildThesisPrompt`: descrição,
// evidências e termos; nada da carteira.

/** Até duas respostas por ativo: a recusada pela validação dá uma chance ao próximo modelo. */
const MAX_ATTEMPTS = 2;

export type ThesisResult = {
  stored: StoredThesis | null;
  /** O texto aceito, para a checagem de repetição. */
  text: string | null;
  calls: number;
  rejected: number;
  model: string | null;
};

/**
 * Gera a tese: uma chamada à cadeia; uma resposta recusada pela validação tenta uma vez o próximo
 * modelo. `stored` null quando nenhum modelo respondeu (nada a gravar) ou todas foram recusadas
 * (`rejected` > 0: o chamador grava `failed`). `models` é a lista compartilhada da cadeia: os
 * modelos esgotados ou fora do ar saem dela para as próximas chamadas.
 */
export async function generateThesis(args: {
  apiKey: string;
  models: GeminiModel[];
  kind: AssetClass;
  description: string;
  evidence: readonly ThesisEvidence[];
  terms: readonly string[];
  key: string;
  termHistory: string[][];
  avoid: string | null;
  now: Date;
  deadline: number;
  label: string;
}): Promise<ThesisResult> {
  const prompt = buildThesisPrompt({
    kind: args.kind,
    description: args.description,
    evidence: args.evidence,
    terms: args.terms,
    avoid: args.avoid,
  });
  const options = {
    temperature: THESIS.temperature,
    maxOutputTokens: THESIS.maxOutputTokens,
    timeoutMs: THESIS.timeoutMs,
    responseMimeType: "application/json" as const,
    responseJsonSchema: thesisSchema(args.kind),
  };
  const result: ThesisResult = { stored: null, text: null, calls: 0, rejected: 0, model: null };
  const tried = new Set<GeminiModel>();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chain = args.models.filter((model) => !tried.has(model));
    if (chain.length === 0) break;
    const before = [...chain];
    const out = await generateWithChain(
      args.apiKey,
      chain,
      prompt,
      options,
      args.now,
      args.label,
      args.deadline,
    );
    result.calls += out.calls;
    // A cadeia tira da lista local os esgotados e os fora do ar: a compartilhada aprende também.
    for (const model of before) {
      if (!chain.includes(model) && args.models.includes(model)) {
        args.models.splice(args.models.indexOf(model), 1);
      }
    }
    if (!out.result) break;
    result.model = out.result.model;
    tried.add(out.result.model);
    const checked = checkThesis(out.result.text, out.result.finishReason, {
      kind: args.kind,
      evidence: args.evidence,
      prompt,
    });
    const reading = "reading" in checked ? checked.reading : null;
    if (reading) {
      result.stored = thesisFromReading({
        reading,
        evidence: args.evidence,
        key: args.key,
        model: out.result.model,
        now: args.now,
        termHistory: args.termHistory,
      });
      result.text = result.stored.text;
      return result;
    }
    result.rejected += 1;
    if ("rejection" in checked) {
      console.warn(
        `[${args.label}] resposta recusada pela validação (${out.result.model}): ${checked.rejection}`,
      );
    }
  }
  return result;
}
