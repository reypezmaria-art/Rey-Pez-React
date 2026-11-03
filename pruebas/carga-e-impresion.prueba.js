import test from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cargarModulo } from "../codigo/utilidades/cargarModulo.js";
import { crearPdfImpresion } from "../herramientas/prueba-editor-nomina/impresionNomina.js";

test("reintenta una carga de módulo del mismo sitio y conserva errores de negocio", async () => {
  let ruta;
  const modulo = { leerPdfNomina: true };
  const resultado = await cargarModulo(
    async () => {
      throw Error(
        "Failed to fetch dynamically imported module: https://ejemplo.test/recursos/pdfNomina-abc.js",
      );
    },
    async (url) => {
      ruta = new URL(url);
      return modulo;
    },
    "https://ejemplo.test",
  );
  assert.equal(resultado, modulo);
  assert.equal(ruta.pathname, "/recursos/pdfNomina-abc.js");
  assert.ok(ruta.searchParams.has("reintento"));
  const error = Error("Los conceptos y totales no coinciden");
  await assert.rejects(
    cargarModulo(
      async () => {
        throw error;
      },
      async () => {
        throw Error("No debe reintentar");
      },
      "https://ejemplo.test",
    ),
    (e) => e === error,
  );
});
test("un módulo ausente ofrece actualizar y nunca importa una URL de otro sitio", async () => {
  let intentos = 0;
  await assert.rejects(
    cargarModulo(
      async () => {
        throw Error(
          "Failed to fetch dynamically imported module: https://ajeno.test/modulo.js",
        );
      },
      async () => {
        intentos++;
      },
      "https://ejemplo.test",
    ),
    (e) =>
      e.codigo === "actualizar-aplicacion" &&
      e.message.includes("Actualizar página"),
  );
  assert.equal(intentos, 0);
  await assert.rejects(
    cargarModulo(
      async () => {
        throw Error(
          "Failed to fetch dynamically imported module: https://ejemplo.test/recursos/antiguo.js",
        );
      },
      async () => {
        intentos++;
        throw Error("sin conexión");
      },
      "https://ejemplo.test",
    ),
    (e) => e.codigo === "actualizar-aplicacion",
  );
  assert.equal(intentos, 1);
});
test("impresión carta horizontal conserva columnas, nombres largos y totales en páginas legibles", async () => {
  const cellData = {
    0: { 0: { v: "Empresa de demostración" } },
    1: { 0: { v: "enero 2026" } },
    2: {},
  };
  const labels = [
    "NOMBRE",
    "PERIODO",
    ...Array.from({ length: 22 }, (_, i) => `CONCEPTO ${i + 1}`),
  ];
  labels.forEach((v, c) => {
    cellData[2][c] = { v };
  });
  for (let r = 3; r < 33; r++) {
    cellData[r] = {
      0: { v: `PERSONA DE DEMOSTRACION CON NOMBRE LARGO NUMERO ${r}` },
      1: { v: "ENE 01-15" },
    };
    for (let c = 2; c < 24; c++) cellData[r][c] = { v: r * 100 + c };
  }
  cellData[33] = { 0: { v: "TOTAL" }, 23: { v: 123456.78 } };
  const snapshot = {
    sheetOrder: ["h"],
    sheets: { h: { name: "enero", cellData } },
  };
  const previo = structuredClone(snapshot),
    bytes = crearPdfImpresion(snapshot, ["h"]);
  assert.deepEqual(snapshot, previo);
  const tarea = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await tarea.promise;
    assert.ok(pdf.numPages > 1);
    const textos = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n),
        vista = pagina.getViewport({ scale: 1 });
      assert.equal(vista.width, 792);
      assert.equal(vista.height, 612);
      const texto = (await pagina.getTextContent()).items
        .map((i) => i.str)
        .join(" ");
      assert.match(texto, /NOMBRE/);
      assert.match(texto, /PERIODO/);
      textos.push(texto);
    }
    const todo = textos.join(" ");
    assert.match(todo, /CONCEPTO 22/);
    assert.match(todo, /123456.78/);
    for (let r = 3; r < 33; r++) assert.ok(todo.includes(`NUMERO ${r}`));
  } finally {
    await tarea.destroy();
  }
});
