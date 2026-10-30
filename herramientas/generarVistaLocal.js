import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  output = path.join(root, "entrega-local");
await mkdir(output, { recursive: true });
let html = await readFile(path.join(root, "compilado/index.html"), "utf8");
const recursos = path.join(root, "compilado/recursos");
const nombres = await readdir(recursos);
const entrada = path.basename(
  html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1] || "",
);
if (!entrada) throw Error("No se encontró el módulo de entrada.");
const modulos = {};
const activos = {};
const css = [];
for (const nombre of nombres) {
  const archivo = path.join(recursos, nombre);
  if (nombre.endsWith(".css")) css.push(await readFile(archivo, "utf8"));
  else if (nombre.endsWith(".mjs")) activos[nombre] = await readFile(archivo);
  else if (nombre.endsWith(".js"))
    modulos[nombre] = await readFile(archivo, "utf8");
  else activos[nombre] = await readFile(archivo);
}
const marcador = "https://local.invalid/";
function apuntar(codigo) {
  let salida = codigo;
  for (const nombre of [...nombres].sort((a, b) => b.length - a.length)) {
    salida = salida.replaceAll(`/recursos/${nombre}`, `${marcador}${nombre}`);
    salida = salida.replaceAll(`./${nombre}`, `${marcador}${nombre}`);
  }
  return salida;
}
for (const nombre of Object.keys(modulos))
  modulos[nombre] = apuntar(modulos[nombre]);
let estilo = css.map(apuntar).join("\n");
const imagenes = [
  ["logo-rey-pez.png", "image/png"],
  ["logo-rey-pez.webp", "image/webp"],
  ["favicon-32.png", "image/png"],
  ["apple-touch-icon.png", "image/png"],
  ["logo-oficial-rey-pez.jpeg", "image/jpeg"],
];
for (const [file, mime] of imagenes) {
  const uri = `data:${mime};base64,${(await readFile(path.join(root, "publico/identidad", file))).toString("base64")}`;
  for (const nombre of Object.keys(modulos))
    modulos[nombre] = modulos[nombre].replaceAll(`/identidad/${file}`, uri);
  html = html.replaceAll(`/identidad/${file}`, uri);
  estilo = estilo.replaceAll(`/identidad/${file}`, uri);
}
const tipos = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const activosTexto = {};
const activosBinarios = {};
for (const [nombre, buffer] of Object.entries(activos)) {
  const ext = path.extname(nombre);
  if (ext === ".mjs" || ext === ".css" || ext === ".svg")
    activosTexto[nombre] = buffer.toString("utf8");
  else
    activosBinarios[nombre] =
      `data:${tipos[ext] || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}
for (const [nombre, uri] of Object.entries(activosBinarios)) {
  for (const modulo of Object.keys(modulos))
    modulos[modulo] = modulos[modulo].replaceAll(`${marcador}${nombre}`, uri);
  estilo = estilo.replaceAll(`${marcador}${nombre}`, uri);
}
let catalog = [];
try {
  catalog = JSON.parse(
    await readFile(path.join(root, "datos-locales/empleados.json"), "utf8"),
  );
} catch {
  /* sin catálogo privado no se inventan datos */
}
const semilla = `<script>globalThis.__REY_PEZ_CATALOG__=${JSON.stringify(catalog).replaceAll("<", "\\u003c")};</script>`;
const datos = JSON.stringify({
  entrada,
  modulos,
  activos: activosTexto,
}).replaceAll("<", "\\u003c");
const arranque = `<script id="rey-pez-vista" type="application/json">${datos}</script>
<script>
const vista = JSON.parse(document.getElementById("rey-pez-vista").textContent);
const marca = ${JSON.stringify(marcador)};
const blobs = {};
for (const [nombre, codigo] of Object.entries(vista.activos)) {
  blobs[nombre] = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
}
for (const nombre of Object.keys(vista.modulos)) {
  let codigo = vista.modulos[nombre];
  for (const [activo, url] of Object.entries(blobs))
    codigo = codigo.replaceAll(marca + activo, url);
  blobs[nombre] = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
}
const imports = {};
for (const nombre of Object.keys(vista.modulos))
  imports[marca + nombre] = blobs[nombre];
const mapa = document.createElement("script");
mapa.type = "importmap";
mapa.textContent = JSON.stringify({ imports });
document.head.append(mapa);
</script>
<script type="module">import ${JSON.stringify(marcador + entrada)};</script>`;
html = html
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
  .replace(
    /<script type="module" crossorigin src="[^"]+"><\/script>/,
    () => semilla + arranque,
  )
  .replace(
    /<link rel="stylesheet" crossorigin href="[^"]+">/g,
    () => `<style>${estilo.replaceAll("</style", "<\\/style")}</style>`,
  );
const file = path.join(output, "Rey_Pez_Revision.html");
await writeFile(file, html);
console.log(
  `Vista local: ${file}. Catálogo incluido: ${catalog.length} empleados. Módulos: ${Object.keys(modulos).length}.`,
);
