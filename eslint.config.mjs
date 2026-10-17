import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteiras da arquitetura (monólito modular por features):
// - de fora, uma feature só é importada pela API pública: index.ts, server.ts ou actions.ts;
// - dentro da própria feature, os imports são relativos;
// - domain/ é TypeScript puro;
// - componentes não acessam servidor nem banco.
const featureInternals = {
  group: ["@/features/*/*/**"],
  message:
    "Importe a feature pela API pública (index.ts, server.ts ou actions.ts). Dentro da própria feature, use caminhos relativos.",
};

const serverOnlyModules = ["@/shared/db/*", "@/shared/env", "mongoose", "mongodb"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [featureInternals] }],
    },
  },
  {
    files: ["src/features/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            featureInternals,
            {
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
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/*/components/**/*.{ts,tsx}",
      "src/shared/ui/**/*.{ts,tsx}",
      "src/shared/components/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            featureInternals,
            {
              group: ["**/server", "**/server/**", ...serverOnlyModules],
              message:
                "Componentes não acessam servidor nem banco: recebem dados por props ou chamam actions.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
