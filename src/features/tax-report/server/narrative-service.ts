import "server-only";
import { ActionError, type Tenant } from "@/features/auth/server";
import { generateWithChain, geminiModelsWithQuota } from "@/features/market-data/server";
import { env } from "@/shared/env";
import { withSpan } from "@/shared/lib/tracing";
import {
  acceptCodeNarrative,
  buildNarrativePrompt,
  narrativeCodes,
  narrativeKey,
  narrativeReferences,
  narrativeSchema,
  narrativesComplete,
  parseNarratives,
  validPositionTexts,
} from "../domain/narrative";
import { findNarratives, saveNarratives } from "./narrative-repo";
import { loadTaxReport } from "./tax-report-view";

// Gera os textos do Gemini do relatório de IR (spec 2026-11-16-relatorio-ir-design.md §6). Só a
// Server Action chama isto, a pedido do dono: a página nunca gera. Vai ao Gemini o que a spec
// registra como exceção de privacidade (ticker, classe, quantidade, custo, preço médio, CNPJ e
// razão social por posição; só os códigos dos achados) e nada mais.

// Aqui o limite de 30 s do cron-job.org não vale: a geração é uma Server Action pedida pelo dono,
// que espera na tela. Com 60 s por chamada e 120 s no total cabe um segundo modelo da cadeia
// quando o primeiro estoura o prazo ou recusa (o JSON de todas as posições é longo).
const TIMEOUT_MS = 60_000;
const DEADLINE_MS = 120_000;

export type NarrativeRun = "generated" | "unchanged" | "failed";

export async function generateTaxNarratives(tenant: Tenant, year: number): Promise<NarrativeRun> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new ActionError("Os textos automáticos estão desligados.");
  return withSpan("tax.narratives", {}, async (span) => {
    const now = new Date();
    const { report } = await loadTaxReport(tenant, year);
    const references = narrativeReferences(report.positions);
    const codes = narrativeCodes(report);
    if (Object.keys(references).length === 0 && codes.length === 0) {
      throw new ActionError("Não há textos para gerar neste ano.");
    }
    const key = narrativeKey(references, codes);
    const stored = await findNarratives(tenant.portfolioId, year);
    // Só sai cedo quando a chave é a mesma e todo texto enviado foi aceito: com texto recusado, gera
    // de novo e mescla com o que já valia.
    if (
      stored &&
      stored.status === "ok" &&
      stored.key === key &&
      narrativesComplete({ references, codes }, stored)
    ) {
      span.setAttributes({ "koinos.tax.accepted": 0, "koinos.tax.rejected": 0 });
      return "unchanged";
    }

    // Os textos aceitos antes que ainda valem seguem, numa falha e num sucesso parcial.
    const keptPositions = validPositionTexts(stored?.positions ?? {}, references);
    const keptCodes = Object.fromEntries(
      Object.entries(stored?.codes ?? {}).filter(
        ([code, text]) =>
          (codes as readonly string[]).includes(code) && acceptCodeNarrative(text).ok,
      ),
    );
    const fail = async (model: string | null) => {
      await saveNarratives(tenant.portfolioId, year, {
        key: stored?.key ?? null,
        status: "failed",
        model: model ?? stored?.model ?? null,
        generatedAt: now,
        positions: keptPositions,
        codes: keptCodes,
      });
      return "failed" as const;
    };

    const prompt = buildNarrativePrompt({
      positions: report.positions.flatMap((p) =>
        references[p.ticker] !== undefined
          ? [{ ticker: p.ticker, assetClass: p.assetClass, reference: references[p.ticker]! }]
          : [],
      ),
      codes,
    });
    const models = await geminiModelsWithQuota(now);
    const { result, calls } = await generateWithChain(
      apiKey,
      models,
      prompt,
      {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseJsonSchema: narrativeSchema,
        timeoutMs: TIMEOUT_MS,
      },
      now,
      "tax-report",
      Date.now() + DEADLINE_MS,
    );
    span.setAttribute("koinos.tax.calls", calls);
    if (!result) {
      span.setAttributes({ "koinos.tax.accepted": 0, "koinos.tax.rejected": 0 });
      return fail(null);
    }

    const parsed = parseNarratives(result.text, references, codes);
    span.setAttributes({
      "koinos.tax.accepted": parsed.accepted,
      "koinos.tax.rejected": parsed.rejected,
    });
    // Só o código da regra vai ao log: nunca o texto do modelo nem valores.
    for (const [rule, count] of Object.entries(parsed.rejections)) {
      for (let i = 0; i < count; i += 1) {
        console.warn(`[tax-report] resposta recusada pela validação (${result.model}): ${rule}`);
      }
    }
    if (parsed.accepted === 0) return fail(result.model);

    await saveNarratives(tenant.portfolioId, year, {
      key,
      status: "ok",
      model: result.model,
      generatedAt: now,
      positions: { ...keptPositions, ...parsed.positions },
      codes: { ...keptCodes, ...parsed.codes },
    });
    return "generated";
  });
}
