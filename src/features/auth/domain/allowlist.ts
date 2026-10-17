/** "a@x.com, B@y.com" vira um conjunto normalizado (minúsculas, sem espaços). */
export function parseAllowedEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  return Boolean(email) && allowed.has(email!.trim().toLowerCase());
}
