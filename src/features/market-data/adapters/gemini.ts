import "server-only";

import { geminiLimitScope } from "../domain/day-insight";

// Gemini Developer API (free tier, chave do Google AI Studio), pela API REST: a chave vai no
// header, nunca na URL, e a chamada aparece no APM pela instrumentação do fetch.
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

/**
 * Por que a chamada falhou: `quota` (429 da cota diária, ou de origem desconhecida) esgota o modelo
 * no dia; `rate` (429 do limite por minuto) e o resto só pulam o modelo nesta chamada.
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: "quota" | "rate" | "unavailable" | "other",
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

/**
 * `timeoutMs` é só do cliente (padrão 20 s); não vai para a API. Com `responseMimeType`
 * "application/json" e `responseJsonSchema`, o modelo responde um JSON nesse esquema, na ordem das
 * chaves (saída estruturada, documentação do Gemini conferida em 2026-11-13); o texto devolvido é o
 * JSON, que quem chama valida.
 */
export type GenerateOptions = {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  responseMimeType?: "application/json";
  responseJsonSchema?: object;
};
export type Generated = { text: string; finishReason: string | null };

/** O texto que o modelo gerou e por que parou ("STOP"; "MAX_TOKENS" quando cortou). */
export async function generateContent(
  apiKey: string,
  model: string,
  prompt: string,
  { timeoutMs = TIMEOUT_MS, ...generationConfig }: GenerateOptions = {},
): Promise<Generated> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new GeminiError(
      `Gemini (${model}): ${error instanceof Error ? error.message : String(error)}`,
      "unavailable",
    );
  }
  if (response.status === 429) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // corpo ilegível: sem como saber o limite, vale o caso seguro (cota do dia)
    }
    if (geminiLimitScope(body) === "minute") {
      throw new GeminiError(`Gemini (${model}) acima do limite por minuto`, "rate");
    }
    throw new GeminiError(`Gemini (${model}) sem cota`, "quota");
  }
  if (response.status === 503 || response.status === 500 || response.status === 404) {
    throw new GeminiError(`Gemini (${model}) respondeu ${response.status}`, "unavailable");
  }
  if (!response.ok)
    throw new GeminiError(`Gemini (${model}) respondeu ${response.status}`, "other");
  const body = (await response.json()) as GenerateResponse;
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError(`Gemini (${model}) respondeu sem texto`, "unavailable");
  return { text, finishReason: candidate?.finishReason ?? null };
}

/** O texto do resumo do dia (temperatura 0,3, sem limite de tokens). */
export async function generateText(apiKey: string, model: string, prompt: string): Promise<string> {
  return (await generateContent(apiKey, model, prompt, { temperature: 0.3 })).text;
}
