/**
 * Sai e vai para o login. Navegação completa (não router.push) de propósito: descarta o cache do
 * router e o cache privado da sessão, para nada do usuário anterior ficar na memória.
 */
export async function signOutAndLeave() {
  // O cliente do Better Auth só carrega ao sair: fica fora do bundle de todas as páginas.
  const { authClient } = await import("../auth-client");
  await authClient.signOut();
  window.location.assign(new URL("/login", window.location.origin));
}

/** Iniciais do nome para o avatar sem foto. */
export function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase());
  return letters.join("") || "?";
}
