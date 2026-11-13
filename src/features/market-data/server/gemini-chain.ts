import "server-only";
import {
  generateContent,
  GeminiError,
  type Generated,
  type GenerateOptions,
} from "../adapters/gemini";
import { availableModels, GEMINI_MODELS, type GeminiModel } from "../domain/day-insight";
import { geminiRequestsToday, markGeminiExhausted, recordGeminiRequest } from "./usage";

// A cadeia de modelos do free tier (spec resumo-ia-variacao): o mais barato primeiro; 429 esgota o
// modelo no dia; 503/500/404/timeout/sem texto tiram o modelo só desta chamada (a lista `models`
// é compartilhada) e passam ao próximo. Nenhuma chamada começa sem folga até o `deadline`. Usada
// pelo Radar.

const QUOTA = Object.fromEntries(GEMINI_MODELS.map((m) => [m.id, m.dailyQuota])) as Record<
  GeminiModel,
  number
>;
/** O tempo que uma chamada ao Gemini pode levar (timeout de 20 s do adapter, com folga). */
export const GEMINI_BUDGET_MS = 21_000;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Os modelos com cota hoje, na ordem da cadeia (lista mutável: a cadeia tira os esgotados). */
export async function geminiModelsWithQuota(now: Date): Promise<GeminiModel[]> {
  const usage = await geminiRequestsToday(
    GEMINI_MODELS.map((m) => m.id),
    now,
  );
  return availableModels((model) => usage.get(model) ?? 0);
}

/** A primeira resposta da cadeia, ou null quando todos falharam. `calls` conta as chamadas feitas. */
export async function generateWithChain(
  apiKey: string,
  models: GeminiModel[],
  prompt: string,
  options: GenerateOptions,
  now: Date,
  label: string,
  deadline: number,
): Promise<{ result: (Generated & { model: GeminiModel }) | null; calls: number }> {
  let calls = 0;
  for (const model of [...models]) {
    if (Date.now() > deadline - GEMINI_BUDGET_MS) break;
    calls += 1;
    await recordGeminiRequest(model, now);
    try {
      return {
        result: { ...(await generateContent(apiKey, model, prompt, options)), model },
        calls,
      };
    } catch (error) {
      console.warn(`[${label}]`, errorMessage(error));
      if (error instanceof GeminiError && error.kind === "quota") {
        await markGeminiExhausted(model, QUOTA[model], now);
        models.splice(models.indexOf(model), 1);
      } else if (error instanceof GeminiError && error.kind === "unavailable") {
        models.splice(models.indexOf(model), 1);
      }
    }
  }
  return { result: null, calls };
}
