/** Os arquivos da CVM vêm em Latin-1. */
export function decodeCvm(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

/** CSV da CVM: separador `;`, aspas duplas opcionais, primeira linha é o cabeçalho. */
export function parseCvmCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) lines.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== "")) lines.push(row);
  }
  const [header, ...body] = lines;
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])),
  );
}

export type CnpjMatch = { cnpj: string; legalName: string };

const TICKER = /^[A-Z]{4}\d{1,2}$/;

/** Ticker → CNPJ e razão social das ações, pelo `valor_mobiliario` do FCA. Ambíguo fica de fora. */
export function stockCnpjByTicker(rows: readonly Record<string, string>[]): Map<string, CnpjMatch> {
  const found = new Map<string, Map<string, string>>();
  for (const r of rows) {
    for (const raw of (r.Codigo_Negociacao ?? "").split(",")) {
      const ticker = raw.trim().toUpperCase();
      if (!TICKER.test(ticker) || !r.CNPJ_Companhia) continue;
      const owners = found.get(ticker) ?? new Map<string, string>();
      owners.set(r.CNPJ_Companhia, r.Nome_Empresarial ?? "");
      found.set(ticker, owners);
    }
  }
  const result = new Map<string, CnpjMatch>();
  for (const [ticker, owners] of found) {
    if (owners.size !== 1) continue;
    const [[cnpj, legalName]] = [...owners];
    result.set(ticker, { cnpj, legalName });
  }
  return result;
}

export type CvmFund = { cnpj: string; name: string; isin: string };

const GENERIC_WORDS = new Set(
  (
    "FII FUNDO FUNDOS DE DO DA DOS DAS E EM INVESTIMENTO INVESTIMENTOS IMOBILIARIO IMOBILIARIOS " +
    "RESPONSABILIDADE LIMITADA RL RESP COTAS FIC SA FI LTDA"
  ).split(" "),
);

function significantTokens(name: string): Set<string> {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
  return new Set(normalized.split(" ").filter((t) => t.length >= 2 && !GENERIC_WORDS.has(t)));
}

/** Quantos tokens significativos (sem as palavras genéricas de fundo) os dois nomes têm em comum. */
export function nameScore(appName: string, cvmName: string): number {
  const app = significantTokens(appName);
  let score = 0;
  for (const token of significantTokens(cvmName)) if (app.has(token)) score++;
  return score;
}

/**
 * FII: o ISIN da cota é `BR` + 4 letras do ticker + `CTF` + 4 caracteres. Com um só CNPJ no
 * prefixo, casa. Com mais de um, só o nome do ativo no app desempata (`byName`): exatamente um
 * candidato com algo em comum, ou o melhor com 2+ e pelo menos o dobro do segundo. Fora disso,
 * é pendência para o dono (spec §4).
 */
export function fiiCnpjForTicker(
  ticker: string,
  funds: readonly CvmFund[],
  appName?: string | null,
): (CnpjMatch & { byName?: true }) | null {
  const prefix = `BR${ticker.slice(0, 4).toUpperCase()}CTF`;
  const owners = new Map<string, string>();
  for (const f of funds) if (f.isin.toUpperCase().startsWith(prefix)) owners.set(f.cnpj, f.name);
  if (owners.size === 1) {
    const [[cnpj, legalName]] = [...owners];
    return { cnpj, legalName };
  }
  if (owners.size < 2 || !appName) return null;
  const ranked = [...owners]
    .map(([cnpj, legalName]) => ({ cnpj, legalName, score: nameScore(appName, legalName) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  const decisive =
    best.score >= 1 && (second.score === 0 || (best.score >= 2 && best.score >= second.score * 2));
  if (!decisive) return null;
  return { cnpj: best.cnpj, legalName: best.legalName, byName: true };
}

export type ResolvedCnpj = CnpjMatch & {
  ticker: string;
  source: "CVM_FCA" | "CVM_ISIN" | "CVM_ISIN_NOME";
};

/**
 * Casa cada ticker acompanhado com o CNPJ da CVM: ações pelo FCA (`CVM_FCA`), FIIs pelo prefixo
 * do ISIN (`CVM_ISIN`, ou `CVM_ISIN_NOME` quando o nome do ativo desempatou). O que não casa sem
 * ambiguidade volta em `unmatched`, para o dono digitar.
 */
export function resolveCnpjs(
  targets: readonly { ticker: string; assetClass: "FII" | "ACAO"; name?: string | null }[],
  stocks: ReadonlyMap<string, CnpjMatch>,
  funds: readonly CvmFund[],
): { matched: ResolvedCnpj[]; unmatched: string[] } {
  const matched: ResolvedCnpj[] = [];
  const unmatched: string[] = [];
  for (const { ticker, assetClass, name } of targets) {
    if (assetClass === "ACAO") {
      const found = stocks.get(ticker);
      if (!found) unmatched.push(ticker);
      else matched.push({ ticker, ...found, source: "CVM_FCA" });
      continue;
    }
    const found = fiiCnpjForTicker(ticker, funds, name);
    if (!found) unmatched.push(ticker);
    else {
      const { byName, ...match } = found;
      matched.push({ ticker, ...match, source: byName ? "CVM_ISIN_NOME" : "CVM_ISIN" });
    }
  }
  return { matched, unmatched };
}
