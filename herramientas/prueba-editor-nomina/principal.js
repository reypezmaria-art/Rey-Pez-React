/* global document, window, indexedDB */
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import es from "@univerjs/preset-sheets-core/locales/es-ES";
import "@univerjs/preset-sheets-core/lib/index.css";
import "./estilos.css";
import { importar, exportarCopia } from "./conversion.js";

let editor,
  prueba,
  ocupado = false;
const $ = (id) => document.getElementById(id);
const aviso = (texto) => {
  $("estado").textContent = texto;
};
function montar(snapshot) {
  editor?.univer.dispose();
  editor = createUniver({
    locale: LocaleType.ES_ES,
    locales: { [LocaleType.ES_ES]: mergeLocales(es) },
    presets: [
      UniverSheetsCorePreset({ container: "editor", ribbonType: "grid" }),
    ],
  });
  editor.univerAPI.createWorkbook(snapshot);
  $("nombre-libro").textContent = snapshot.name || "Libro de nómina";
  $("nombre-libro").title = snapshot.name || "Libro de nómina";
}
const snapshot = () => editor.univerAPI.getActiveWorkbook().save();
async function ejecutar(fn) {
  if (ocupado) return;
  ocupado = true;
  document.querySelectorAll(".barra-titulo button").forEach((b) => {
    b.disabled = true;
  });
  $("archivo").disabled = true;
  try {
    await fn();
  } catch (e) {
    aviso(e.message || "No se pudo completar la prueba.");
  } finally {
    ocupado = false;
    document.querySelectorAll(".barra-titulo button").forEach((b) => {
      b.disabled = false;
    });
    $("archivo").disabled = false;
  }
}
function baseDatos() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("rey-pez-prueba-editor", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("versiones", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(Error("No se pudo abrir el guardado de prueba."));
  });
}
async function guardar() {
  const db = await baseDatos();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("versiones", "readwrite"),
        store = tx.objectStore("versiones");
      store.put({
        id: Date.now(),
        prueba: prueba || null,
        snapshot: snapshot(),
      });
      const req = store.getAllKeys();
      req.onsuccess = () =>
        req.result.slice(0, -3).forEach((id) => store.delete(id));
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () =>
        reject(
          Error("No se guardó: revisa el espacio disponible del navegador."),
        );
    });
    aviso(
      "Prueba guardada en este navegador. Se conservan las últimas tres versiones.",
    );
  } finally {
    db.close();
  }
}
async function recuperar() {
  const db = await baseDatos();
  let record;
  try {
    record = await new Promise((resolve, reject) => {
      const req = db
        .transaction("versiones")
        .objectStore("versiones")
        .openCursor(null, "prev");
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(Error("No se pudo leer el guardado."));
    });
  } finally {
    db.close();
  }
  if (!record)
    throw Error("Todavía no hay una prueba guardada en este navegador.");
  prueba = record.prueba;
  montar(record.snapshot);
  aviso("Se reabrieron los cambios guardados en este navegador.");
}
function descargar(bytes, name) {
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `PRUEBA_${name}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("archivo").onchange = () =>
  ejecutar(async () => {
    const f = $("archivo").files[0];
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name) || f.size > 10 * 1024 * 1024)
      throw Error("Selecciona un archivo .xlsx de hasta 10 MB.");
    aviso("Abriendo la copia de Excel…");
    const nueva = await importar(await f.arrayBuffer(), f.name);
    montar(nueva.snapshot);
    nueva.baseline = snapshot();
    prueba = nueva;
    const r = prueba.resumen;
    $("hallazgos").replaceChildren();
    for (const texto of [
      `${r.hojas} hojas; ${r.formulas} fórmulas.`,
      `${r.externas} fórmulas externas conservan su último valor. El archivo original y sus vínculos se mantienen en la descarga de prueba.`,
    ]) {
      const li = document.createElement("li");
      li.textContent = texto;
      $("hallazgos").appendChild(li);
    }
    aviso(`${f.name}: copia abierta. El archivo original no se modifica.`);
    $("archivo").value = "";
  });
const cerrarArchivo = () => $("menu-archivo").removeAttribute("open");
$("abrir").onclick = () => {
  cerrarArchivo();
  $("archivo").click();
};
$("guardar").onclick = $("guardar-menu").onclick = () => {
  cerrarArchivo();
  return ejecutar(guardar);
};
$("recuperar").onclick = () => {
  cerrarArchivo();
  return ejecutar(recuperar);
};
$("deshacer").onclick = () =>
  ejecutar(async () => {
    const cambio = await editor.univerAPI.undo();
    aviso(
      cambio
        ? "Cambio deshecho. Guarda para conservar el resultado."
        : "No hay cambios para deshacer.",
    );
  });
$("rehacer").onclick = () =>
  ejecutar(async () => {
    const cambio = await editor.univerAPI.redo();
    aviso(
      cambio
        ? "Cambio rehecho. Guarda para conservar el resultado."
        : "No hay cambios para rehacer.",
    );
  });
$("descargar").onclick = () =>
  ejecutar(async () => {
    cerrarArchivo();
    if (!prueba) throw Error("Abre una copia de tu Excel antes de descargar.");
    descargar(await exportarCopia(prueba, snapshot()), prueba.nombre);
    aviso(
      "Copia descargada. Excel recalculará las fórmulas internas al abrirla; los vínculos externos siguen necesitando su archivo.",
    );
  });
document.addEventListener("pointerdown", (event) => {
  if (!$("menu-archivo").contains(event.target)) cerrarArchivo();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    cerrarArchivo();
    ejecutar(guardar);
  }
  if (event.key === "Escape" && $("menu-archivo").open) {
    cerrarArchivo();
    $("menu-archivo").querySelector("summary").focus();
  }
});
const demo = {
  id: "rey-pez-demo",
  name: "Nómina de demostración",
  appVersion: "1.3.1",
  locale: "esES",
  styles: {
    titulo: { bg: { rgb: "#173353" }, cl: { rgb: "#ffffff" }, bl: 1, fs: 13 },
    dinero: { n: { pattern: '"$"#,##0.00' } },
  },
  sheetOrder: ["acumulado", "enero", "febrero"],
  sheets: {},
};
for (const [id, name] of [
  ["acumulado", "Acumulado 2026"],
  ["enero", "Enero"],
  ["febrero", "Febrero"],
]) {
  const rows =
    id === "acumulado"
      ? [
          ["RESUMEN ANUAL · DATOS FICTICIOS"],
          ["Mes", "Percepciones", "Deducciones", "Neto", "ISR enterado"],
          ["Enero", "='Enero'!B5", "='Enero'!C5", "=B3-C3", 0],
          ["Febrero", "='Febrero'!B5", "='Febrero'!C5", "=B4-C4", 0],
          ["TOTAL", "=SUM(B3:B4)", "=SUM(C3:C4)", "=SUM(D3:D4)", "=SUM(E3:E4)"],
        ]
      : [
          [`${name.toUpperCase()} · DATOS FICTICIOS`],
          ["Trabajador", "Percepciones", "Deducciones", "Neto"],
          ["Persona demo uno", 10000, 700, "=B3-C3"],
          ["Persona demo dos", 12000, 900, "=B4-C4"],
          ["TOTAL", "=SUM(B3:B4)", "=SUM(C3:C4)", "=SUM(D3:D4)"],
        ];
  const cellData = {};
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      (cellData[r] ||= {})[c] = {
        ...(typeof v === "string" && v.startsWith("=") ? { f: v } : { v }),
        s: r < 2 ? "titulo" : c ? "dinero" : {},
      };
    }),
  );
  demo.sheets[id] = {
    id,
    name,
    rowCount: 150,
    columnCount: 30,
    defaultRowHeight: 28,
    defaultColumnWidth: 150,
    columnData: { 0: { w: 290 }, 4: { w: 160 } },
    cellData,
    mergeData: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 4 }],
    rowHeader: { width: 44 },
    columnHeader: { height: 24 },
  };
}
montar(demo);
// API exclusiva de esta prueba local, para comprobar importación y persistencia sin servicios externos.
window.pruebaEditor = {
  api: () => editor.univerAPI,
  snapshot,
  resumen: () => prueba?.resumen,
  baseline: () => prueba?.baseline,
  guardar,
  recuperar,
  exportar: () => exportarCopia(prueba, snapshot()),
};
