import { ImageResponse } from "next/og";

/*
 * Ícone do app desenhado em código: o azulejo da sidebar (--tile-app) com as moedas do Lucide em
 * branco. Sem cantos arredondados: o iOS e o Android aplicam a própria máscara. Usado pelo
 * apple-icon (tela de início do iPhone), pelo icon (aba do navegador) e pelo manifesto.
 */
export function appIcon(size: number) {
  const glyph = Math.round(size * 0.56);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #5ac8fa, #0a7aff 60%, #5e5ce6)",
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
        <path d="M7 6h1v4" />
        <path d="m16.71 13.88.7.71-2.82 2.82" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
