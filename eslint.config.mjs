import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteiras da arquitetura (monólito modular por features):
// - de fora, uma feature só é importada pela API pública: index.ts (puro), ui.ts (componentes),
//   server.ts (servidor) ou actions.ts (Server Actions);
// - dentro da própria feature, os imports são relativos;
// - repo.ts (funções com portfolioId explícito) é só para scripts locais, nunca para o app;
// - domain/ é TypeScript puro;
// - componentes não acessam servidor nem banco.
const featureInternals = {
  group: ["@/features/*/*/**"],
  message:
    "Importe a feature pela API pública (index.ts, ui.ts, server.ts ou actions.ts). Dentro da própria feature, use caminhos relativos.",
};

const repoOnlyForScripts = {
  group: ["@/features/*/repo"],
  message:
    "repo.ts recebe ids explícitos e é só para scripts locais. No app, o dono vem da sessão: use server.ts.",
};

const serverOnlyModules = ["@/shared/db/*", "@/shared/env", "mongoose", "mongodb"];

const restrict = (...patterns) => ["error", { patterns }];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(featureInternals, repoOnlyForScripts) },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: { "no-restricted-imports": restrict(featureInternals) },
  },
  {
    files: ["src/features/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": restrict(featureInternals, repoOnlyForScripts, {
        group: [
          "next",
          "next/*",
          "react",
          "react-dom",
          "better-auth",
          "better-auth/*",
          "**/server",
          "**/server/**",
          "**/components/**",
          ...serverOnlyModules,
        ],
        message: "domain/ é puro: sem framework, banco, variáveis de ambiente ou I/O.",
      }),
    },
  },
  {
    files: [
      "src/features/*/components/**/*.{ts,tsx}",
      "src/shared/ui/**/*.{ts,tsx}",
      "src/shared/components/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": restrict(featureInternals, repoOnlyForScripts, {
        group: ["**/server", "**/server/**", ...serverOnlyModules],
        message:
          "Componentes não acessam servidor nem banco: recebem dados por props ou chamam actions.",
      }),
    },
  },
  // .worktrees: checkouts locais de outros branches (git worktree), com config própria.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".worktrees/**",
  ]),
]);
