import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes de unidade das regras puras (domain/). O alias @/ é o mesmo do tsconfig.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) }],
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
