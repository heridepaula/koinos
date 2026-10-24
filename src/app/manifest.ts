import type { MetadataRoute } from "next";

/*
 * Na tela de início, o Koinos abre como app: em tela cheia, sem a barra do navegador, direto no
 * Dashboard (sem sessão, o proxy leva ao login). As cores são as do papel de parede claro.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koinos",
    short_name: "Koinos",
    description: "Carteira de FIIs com aportes pelo método Suno.",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#eef1fb",
    theme_color: "#eef1fb",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
