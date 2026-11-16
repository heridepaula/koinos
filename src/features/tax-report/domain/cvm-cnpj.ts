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

/**
 * FII: o ISIN da cota é `BR` + 4 letras do ticker + `CTF` + 4 caracteres. Aceita só um CNPJ
 * distinto no prefixo; com zero ou mais de um, é pendência para o dono (spec §4).
 */
export function fiiCnpjForTicker(ticker: string, funds: readonly CvmFund[]): CnpjMatch | null {
  const prefix = `BR${ticker.slice(0, 4).toUpperCase()}CTF`;
  const owners = new Map<string, string>();
  for (const f of funds) if (f.isin.toUpperCase().startsWith(prefix)) owners.set(f.cnpj, f.name);
  if (owners.size !== 1) return null;
  const [[cnpj, legalName]] = [...owners];
  return { cnpj, legalName };
}

export type ResolvedCnpj = CnpjMatch & { ticker: string; source: "CVM_FCA" | "CVM_ISIN" };

/**
 * Casa cada ticker acompanhado com o CNPJ da CVM: ações pelo FCA (`CVM_FCA`), FIIs pelo prefixo
 * do ISIN (`CVM_ISIN`). O que não casa sem ambiguidade volta em `unmatched`, para o dono digitar.
 */
export function resolveCnpjs(
  targets: readonly { ticker: string; assetClass: "FII" | "ACAO" }[],
  stocks: ReadonlyMap<string, CnpjMatch>,
  funds: readonly CvmFund[],
): { matched: ResolvedCnpj[]; unmatched: string[] } {
  const matched: ResolvedCnpj[] = [];
  const unmatched: string[] = [];
  for (const { ticker, assetClass } of targets) {
    const found = assetClass === "FII" ? fiiCnpjForTicker(ticker, funds) : stocks.get(ticker);
    if (!found) unmatched.push(ticker);
    else
      matched.push({
        ticker,
        ...found,
        source: assetClass === "FII" ? "CVM_ISIN" : "CVM_FCA",
      });
  }
  return { matched, unmatched };
}
