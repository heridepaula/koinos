// PostToolUse (Edit|Write): roda o ESLint só no arquivo editado.
// Sem erro, fica em silêncio. Com erro, sai com 2 e o agente recebe a saída.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let file;
try {
  file = JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);

const relative = path.relative(root, path.resolve(root, file));
const inSrc = relative.split(path.sep)[0] === "src";
if (!inSrc || !/\.(ts|tsx|mts)$/.test(relative) || !existsSync(file)) {
  process.exit(0);
}

const eslint = path.join(root, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(eslint)) process.exit(0);

const result = spawnSync(process.execPath, [eslint, "--quiet", relative], {
  cwd: root,
  encoding: "utf8",
  timeout: 50_000,
});

if (result.status !== 0) {
  process.stderr.write(`ESLint em ${relative}:\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  process.exit(2);
}
process.exit(0);
