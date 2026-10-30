/*
 * Valores ocultos ou à mostra. O estado fica no `data-privacy="visible"` do <html> e, para
 * sobreviver à navegação e ao recarregar, no localStorage. Entrar e sair apagam a chave: ao logar,
 * os valores sempre começam ocultos.
 */
export const PRIVACY_STORAGE_KEY = "koinos-valores";
export const PRIVACY_EVENT = "koinos-privacy";

/** Roda antes da pintura (no <body> do layout raiz): sem piscar os valores ao recarregar. */
export const PRIVACY_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(PRIVACY_STORAGE_KEY)})==="visible")document.documentElement.dataset.privacy="visible"}catch(e){}`;

/** Esquece a escolha: a próxima sessão começa com os valores ocultos. */
export function forgetValuesVisible() {
  try {
    localStorage.removeItem(PRIVACY_STORAGE_KEY);
  } catch {
    // Sem armazenamento: nada a esquecer.
  }
}
