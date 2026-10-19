/** "a@x.com, B@y.com" vira um conjunto normalizado (minúsculas, sem espaços); sem lista, null. */
export function parseAllowedEmails(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowed: ReadonlySet<string> | null,
): boolean {
  if (!email) return false;
  return allowed === null || allowed.has(email.trim().toLowerCase());
}
