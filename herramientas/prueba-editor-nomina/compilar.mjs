import process from "node:process";
import { build } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
await build({
  root,
  configFile: false,
  base: "./",
  build: {
    outDir: process.argv.includes("--integrado")
      ? resolve(root, "../../publico/editor-nomina")
      : resolve(root, "dist"),
    emptyOutDir: true,
  },
});
