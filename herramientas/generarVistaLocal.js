import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  output = path.join(root, "entrega-local");
await mkdir(output, { recursive: true });
let html = await readFile(path.join(root, "compilado/index.html"), "utf8");
const files = await readdir(path.join(root, "compilado/recursos"));
let js = await readFile(
  path.join(
    root,
    "compilado/recursos",
    files.find((f) => f.endsWith(".js")),
  ),
  "utf8",
);
const css = await readFile(
  path.join(
    root,
    "compilado/recursos",
    files.find((f) => f.endsWith(".css")),
  ),
  "utf8",
);
for (const [file, mime] of [
  ["logo-rey-pez.png", "image/png"],
  ["logo-oficial-rey-pez.jpeg", "image/jpeg"],
]) {
  const uri = `data:${mime};base64,${(await readFile(path.join(root, "publico/identidad", file))).toString("base64")}`;
  js = js.replaceAll(`/identidad/${file}`, uri);
  html = html.replaceAll(`/identidad/${file}`, uri);
}
let catalog = [];
try {
  catalog = JSON.parse(
    await readFile(path.join(root, "datos-locales/empleados.json"), "utf8"),
  );
} catch {
  /* sin catálogo privado no se inventan datos */
}
const seed = `<script>globalThis.__REY_PEZ_CATALOG__=${JSON.stringify(catalog).replaceAll("<", "\\u003c")};</script>`;
html = html
  .replace(
    /<script type="module" crossorigin src="[^"]+"><\/script>/,
    () =>
      seed +
      `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`,
  )
  .replace(
    /<link rel="stylesheet" crossorigin href="[^"]+">/,
    () => `<style>${css}</style>`,
  );
const file = path.join(output, "Rey_Pez_Revision.html");
await writeFile(file, html);
console.log(
  `Vista local: ${file}. Catálogo incluido: ${catalog.length} empleados.`,
);
