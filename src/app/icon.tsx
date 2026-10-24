import { appIcon } from "./app-icon";

// Ícone da aba do navegador: o mesmo azulejo da tela de início, em 32 px.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon(size.width);
}
