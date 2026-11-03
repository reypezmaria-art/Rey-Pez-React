import { incorporarPdf, actualizarResumen } from "./pdfEnLibro.js";
import { aplicarFormatoPdf } from "./formatoPdf.js";
import { recuperarOrdenOriginal, esperarMotor } from "./ordenColumnas.js";
import { prepararAcumulado } from "./formatoVista.js";
/* global document, window, indexedDB, location */
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import sortEs from "@univerjs/preset-sheets-sort/locales/es-ES";
import filterEs from "@univerjs/preset-sheets-filter/locales/es-ES";
import "@univerjs/preset-sheets-filter/lib/index.css";
import es from "@univerjs/preset-sheets-core/locales/es-ES";
import "@univerjs/preset-sheets-core/lib/index.css";
import "./estilos.css";
import { importar, exportarCopia } from "./conversion.js";
import { exportarCompleto } from "./exportacionCompleta.js";
import { crearCinta } from "./cinta.js";
import { cargarModulo } from "../../codigo/utilidades/cargarModulo.js";

const parametros = new URLSearchParams(location.search);
const integrado =
  parametros.get("integrado") === "1" && window.parent !== window;
const canal = parametros.get("canal");
let ultimaActividad = -Infinity;
for (const evento of ["pointerdown", "keydown", "wheel", "touchstart"]) {
  window.addEventListener(
    evento,
    () => {
      if (integrado && performance.now() - ultimaActividad > 1000) {
        ultimaActividad = performance.now();
        window.parent.postMessage(
          { canal, accion: "actividad" },
          location.origin,
        );
      }
    },
    { passive: true },
  );
}
let soloConsulta = false,
  baseGuardada = "",
  nube = false;
let secuencia = 0;
const solicitudes = new Map();
function solicitar(accion, datos) {
  return new Promise((resolve, reject) => {
    const id = ++secuencia;
    const timeout = setTimeout(() => {
      solicitudes.delete(id);
      reject(
        Error(
          "No se recibió confirmación. Tus cambios siguen abiertos; comprueba la conexión antes de cerrar.",
        ),
      );
    }, 60000);
    solicitudes.set(id, { resolve, reject, timeout });
    window.parent.postMessage({ canal, id, accion, datos }, location.origin);
  });
}
window.addEventListener("message", (e) => {
  if (
    !integrado ||
    e.origin !== location.origin ||
    e.source !== window.parent ||
    e.data?.canal !== canal
  )
    return;
  const pendiente = solicitudes.get(e.data.id);
  if (!pendiente) return;
  clearTimeout(pendiente.timeout);
  solicitudes.delete(e.data.id);
  if (e.data.error) pendiente.reject(Error(e.data.error));
  else pendiente.resolve(e.data.resultado);
});
function estadoIntegrado(datos, fallo = false) {
  window.parent.postMessage(
    { canal, accion: fallo ? "fallo" : "estado", datos },
    location.origin,
  );
}
async function abrirIntegrado(revision) {
  const datos = await solicitar("abrir", { revision });
  soloConsulta = !!datos.soloConsulta || datos.imprimirInicial === true;
  nube = !!datos.nube;
  estadoIntegrado("Preparando las hojas y el diseño de nómina…");
  prueba = await importar(datos.bytes, datos.nombre);
  montar(
    aplicarFormatoPdf(
      await prepararAcumulado(datos.snapshot || prueba.snapshot),
      datos.tipo,
    ),
  );
  baseGuardada = JSON.stringify(snapshot());
  const ordenActualizado = await recuperarOrdenOriginal(editor.univerAPI);
  pdfAplicados = { ...(datos.pdfAplicados || {}) };
  basePdfAplicados = JSON.stringify(pdfAplicados);
  let pdfActualizado = false;
  if (datos.periodosPdf?.length) {
    await esperarMotor(editor.univerAPI);
    const antesPdf = snapshot();
    try {
      pdfActualizado = incorporarPdf(
        editor.univerAPI.getActiveWorkbook(),
        datos.periodosPdf,
        datos.tipo,
      );
    } catch (error) {
      montar(antesPdf);
      editor.univerAPI.getActiveWorkbook().setEditable(!soloConsulta);
      throw error;
    }
    for (const p of datos.periodosPdf)
      pdfAplicados[p.id] = datos.firmasPdf[p.id];
  }
  await esperarMotor(editor.univerAPI);
  const resumenActualizado = actualizarResumen(
    editor.univerAPI.getActiveWorkbook(),
    snapshot(),
    datos.mesesPdf || [],
  );
  if (pdfActualizado || ordenActualizado) {
    montar(aplicarFormatoPdf(snapshot(), datos.tipo));
    await esperarMotor(editor.univerAPI);
  }
  if (soloConsulta) editor.univerAPI.getActiveWorkbook().setEditable(false);
  estadoIntegrado("");
  window.parent.postMessage(
    {
      canal,
      accion: "cambios",
      datos:
        (ordenActualizado ||
          pdfActualizado ||
          resumenActualizado ||
          datos.periodosPdf?.length > 0) &&
        !soloConsulta,
    },
    location.origin,
  );
  aviso(
    soloConsulta
      ? "Consulta de nómina · puedes descargar el Excel."
      : pdfActualizado
        ? "Libro abierto. PDF incorporados al libro. Guarda para conservar los nuevos periodos."
        : resumenActualizado
          ? "Libro abierto. Acumulado actualizado. Guarda para conservar los importes."
          : ordenActualizado
            ? "Libro abierto. Orden del archivo original aplicado. Guarda para conservarlo."
            : "Libro abierto. Guarda para conservar los cambios.",
  );
  if (datos.imprimirInicial) await imprimirCarta(true);
}
let editor,
  pdfAplicados = {},
  basePdfAplicados = "{}",
  prueba,
  ocupado = false;
const $ = (id) => document.getElementById(id);
const aviso = (texto) => {
  $("estado").textContent = texto;
  $("avisos-editor").hidden = false;
  window.requestAnimationFrame(() =>
    window.dispatchEvent(new window.Event("resize")),
  );
};
$("cerrar-avisos").addEventListener("click", () => {
  $("aviso-editor").hidden = true;
  $("avisos-editor").hidden = true;
  $("advertencias").open = false;
  $("guardar").focus();
  window.requestAnimationFrame(() =>
    window.dispatchEvent(new window.Event("resize")),
  );
});
function montar(snapshot) {
  editor?.univer.dispose();
  editor = createUniver({
    locale: LocaleType.ES_ES,
    locales: { [LocaleType.ES_ES]: mergeLocales(es, sortEs, filterEs) },
    presets: [
      UniverSheetsCorePreset({
        container: "editor",
        header: true,
        toolbar: false,
        formulaBar: true,
      }),
      UniverSheetsSortPreset(),
      UniverSheetsFilterPreset(),
    ],
  });
  editor.univerAPI.addEvent(editor.univerAPI.Event.SelectionChanged, () =>
    cinta.sincronizar(),
  );
  editor.univerAPI.addEvent(editor.univerAPI.Event.LifeCycleChanged, () =>
    cinta.sincronizar(),
  );
  editor.univerAPI.createWorkbook(snapshot);
  if (integrado) {
    let pendiente = false;
    editor.univerAPI.getActiveWorkbook().onCommandExecuted(() => {
      if (pendiente || soloConsulta) return;
      pendiente = true;
      queueMicrotask(() => {
        pendiente = false;
        window.parent.postMessage(
          {
            canal,
            accion: "cambios",
            datos:
              JSON.stringify(editor.univerAPI.getActiveWorkbook().save()) !==
                baseGuardada ||
              JSON.stringify(pdfAplicados) !== basePdfAplicados,
          },
          location.origin,
        );
      });
    });
  }
  $("nombre-libro").textContent = snapshot.name || "Libro de nómina";
  $("nombre-libro").title = snapshot.name || "Libro de nómina";
  cinta.sincronizar();
}
const snapshot = () => editor.univerAPI.getActiveWorkbook().save();
async function ejecutar(fn) {
  if (ocupado) return;
  ocupado = true;
  document
    .querySelectorAll(
      ".barra-titulo button, #cinta button, #cinta select, #cinta input",
    )
    .forEach((b) => {
      b.disabled = true;
    });
  $("archivo").disabled = true;
  try {
    await fn();
  } catch (e) {
    aviso(e.message || "No se pudo completar la acción.");
    if (integrado)
      estadoIntegrado(e.message || "No se pudo abrir el editor.", true);
  } finally {
    ocupado = false;
    document
      .querySelectorAll(
        ".barra-titulo button, #cinta button, #cinta select, #cinta input",
      )
      .forEach((b) => {
        b.disabled = false;
      });
    $("archivo").disabled = false;
    cinta.sincronizar();
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
  if (integrado) {
    if (soloConsulta) throw Error("Tu acceso es de consulta y exportación.");
    await editor.univerAPI.getActiveWorkbook().endEditingAsync(true);
    await editor.univerAPI.getFormula().onCalculationResultApplied(15000);
    const actual = snapshot();
    if (!prueba) throw Error("No hay un libro abierto.");
    const guardado = await solicitar("guardar", {
      snapshot: actual,
      bytes: prueba.bytes,
      nombre: prueba.nombre,
      pdfAplicados,
    });
    baseGuardada = JSON.stringify(actual);
    basePdfAplicados = JSON.stringify(pdfAplicados);
    aviso(
      `Versión ${guardado.revision} guardada ${nube ? "en Firebase" : "en este navegador (modo local)"}.`,
    );
    return;
  }
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
async function recuperar(id) {
  if (integrado) return abrirIntegrado(typeof id === "number" ? id : undefined);
  const db = await baseDatos();
  let record;
  try {
    record = await new Promise((resolve, reject) => {
      const store = db.transaction("versiones").objectStore("versiones");
      const req = id ? store.get(id) : store.openCursor(null, "prev");
      req.onsuccess = () => resolve(id ? req.result : req.result?.value);
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
async function listarVersiones() {
  if (integrado) return solicitar("versiones");
  const db = await baseDatos();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("versiones").objectStore("versiones").getAll();
      req.onsuccess = () =>
        resolve(
          req.result
            .reverse()
            .map((r) => ({ id: r.id, nombre: r.snapshot.name })),
        );
      req.onerror = () => reject(Error("No se pudo leer el historial local."));
    });
  } finally {
    db.close();
  }
}
function descargar(bytes, name) {
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = integrado ? name : `PRUEBA_${name}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
$("descargar").onclick = $("descargar-rapido").onclick = () =>
  ejecutar(async () => {
    cerrarArchivo();
    if (!prueba) throw Error("Abre una copia de tu Excel antes de descargar.");
    await editor.univerAPI.getActiveWorkbook().endEditingAsync(true);
    await editor.univerAPI.getFormula().onCalculationResultApplied(15000);
    const bytes = await (integrado
      ? exportarCompleto(snapshot())
      : exportarCopia(prueba, snapshot()));
    if (integrado)
      await solicitar("descargar", { bytes, nombre: prueba.nombre });
    else descargar(bytes, prueba.nombre);
    aviso(
      "Excel preparado. Si la descarga no comenzó, pulsa «Descargar Excel preparado» en la parte superior. Incluye los cambios actuales del editor.",
    );
  });
document.addEventListener("pointerdown", (event) => {
  if (!$("menu-archivo").contains(event.target)) cerrarArchivo();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if ($("dialogo-cinta").open) return;
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
const cinta = crearCinta({
  api: () => editor?.univerAPI,
  ejecutar,
  aviso,
  listarVersiones,
  recuperar,
  imprimir: imprimirCarta,
});
async function imprimirCarta(todas = false) {
  await editor.univerAPI.getActiveWorkbook().endEditingAsync(true);
  await editor.univerAPI.getFormula().onCalculationResultApplied(15000);
  const { mostrarImpresion } = await cargarModulo(
    () => import("./vistaImpresion.js"),
  );
  await mostrarImpresion({
    todas,
    libro: editor.univerAPI.getActiveWorkbook(),
    descargar: async (bytes, nombre) => {
      if (integrado) await solicitar("descargar", { bytes, nombre });
      else {
        const url = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        );
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombre;
        document.body.append(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    },
  });
}
$("imprimir-rapido").onclick = () => ejecutar(imprimirCarta);
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
if (integrado) {
  document.querySelector(".etiqueta-prueba").textContent = "Nómina";
  document.querySelector("aside").textContent =
    "Editor de nómina · Cada formato conserva su propio libro y sus propias versiones. Guarda los cambios antes de cerrar.";
  document.querySelector("#advertencias p").textContent =
    "Se guardan celdas, fórmulas, formatos y hojas. Excel recalcula fórmulas internas al abrir. Los vínculos externos muestran el último valor del archivo y se exportan como valores con una nota; no se calculan pagos fiscales. Los filtros de la vista se conservan en el editor; la descarga incluye todas las filas. Macros, tablas dinámicas y gráficos originales no se editan ni se exportan.";
  $("guardar-menu").querySelector("small").textContent =
    "Conservar una versión del libro";
  $("recuperar").querySelector("small").textContent =
    "Abrir la última versión guardada";
  $("descargar").firstChild.textContent = "Descargar Excel ";
  $("estado").textContent = "Abriendo nómina…";
  $("abrir").hidden = true;
  ejecutar(() => abrirIntegrado());
  setInterval(() => {
    if (!editor?.univerAPI.getActiveWorkbook() || soloConsulta) return;
    const datos =
      JSON.stringify(snapshot()) !== baseGuardada ||
      JSON.stringify(pdfAplicados) !== basePdfAplicados;
    window.parent.postMessage(
      { canal, accion: "cambios", datos },
      location.origin,
    );
  }, 1200);
} else montar(demo);
// API exclusiva de esta prueba local, para comprobar importación y persistencia sin servicios externos.
window.pruebaEditor = {
  api: () => editor.univerAPI,
  snapshot,
  resumen: () => prueba?.resumen,
  baseline: () => prueba?.baseline,
  guardar,
  recuperar,
  exportar: () =>
    integrado
      ? exportarCompleto(snapshot())
      : exportarCopia(prueba, snapshot()),
};
