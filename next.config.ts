import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as rotas.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Na Vercel, a produção responde em vários endereços (*.vercel.app), mas o login (cookies e retorno
// do OAuth) só funciona no domínio do BETTER_AUTH_URL: as páginas redirecionam para ele.
// /api fica de fora porque o cron da Vercel chama um endereço *.vercel.app e não segue redirects.
const canonicalHost =
  process.env.VERCEL_ENV === "production" && process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).host
    : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      ...(canonicalHost
        ? [
            {
              source: "/:path((?!api/|_next/).*)",
              missing: [{ type: "host" as const, value: canonicalHost.replaceAll(".", "\\.") }],
              destination: `https://${canonicalHost}/:path`,
              permanent: false,
            },
          ]
        : []),
      { source: "/", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
