import "server-only";

// Gemini Developer API (free tier, chave do Google AI Studio), pela API REST: a chave vai no
// header, nunca na URL, e a chamada aparece no APM pela instrumentação do fetch.
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

/** Por que a chamada falhou: `quota` (429) esgota o modelo no dia; o resto só pula para o próximo. */
export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: "quota" | "unavailable" | "other",
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

/** O texto que o modelo gerou para o prompt. */
export async function generateText(apiKey: string, model: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new GeminiError(
      `Gemini (${model}): ${error instanceof Error ? error.message : String(error)}`,
      "unavailable",
    );
  }
  if (response.status === 429) throw new GeminiError(`Gemini (${model}) sem cota`, "quota");
  if (response.status === 503 || response.status === 500 || response.status === 404) {
    throw new GeminiError(`Gemini (${model}) respondeu ${response.status}`, "unavailable");
  }
  if (!response.ok)
    throw new GeminiError(`Gemini (${model}) respondeu ${response.status}`, "other");
  const body = (await response.json()) as GenerateResponse;
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError(`Gemini (${model}) respondeu sem texto`, "unavailable");
  return text;
}
