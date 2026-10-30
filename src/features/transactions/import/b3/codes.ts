// Códigos da B3 e utilitários de data e quantidade da atualização (spec importacao-b3, §4 e §5.2;
// spec ações etapa 1, §5). Puro.

export const DAY = 86_400_000;
export const EPSILON = 1e-6;
/** Cota de FII: 4 caracteres + 11. */
export const FII_CODE = /^[A-Z0-9]{4}11$/;
/** Recibo de subscrição de FII (…13 a …19). */
export const RECEIPT_CODE = /^[A-Z0-9]{4}1[3-9]$/;
/** Direito ou recibo de FII (…12 a …19). */
export const RIGHTS_OR_RECEIPT_CODE = /^[A-Z0-9]{4}1[2-9]$/;
/** Códigos da família de um FII (cota, direito ou recibo): só eles podem ser levados ao FII. */
export const FII_FAMILY_CODE = /^[A-Z0-9]{4}1[1-9]$/;
/** Recibo de subscrição de ação (…9 e …10). */
export const STOCK_RECEIPT_CODE = /^[A-Z0-9]{4}(9|10)$/;
export const TICKER_CODE = /^[A-Z0-9]{4}\d{1,2}$/;

export const family = (code: string) => code.slice(0, 4);
export const fiiOf = (code: string) => `${family(code)}11`;
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const qtyKey = (quantity: number) => String(Math.round(quantity * 1e6) / 1e6);
export const sameQty = (a: number, b: number) => Math.abs(a - b) < EPSILON;
