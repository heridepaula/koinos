import { appIcon } from "./app-icon";

// Ícone da tela de início do iPhone (180 px, o tamanho do apple-touch-icon).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(size.width);
}
