import { darFormatoAcumulado } from "../codigo/utilidades/formatoAcumulado.js";
import { excelSintetico } from "./soporte/acumuladoEjemplo.js";
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  extraerAcumuladoNomina,
  crearExcelAcumulado,
} from "../codigo/utilidades/importarAcumuladoNomina.js";
import {
  empaquetarLibro,
  desempaquetarLibro,
  claveLibroNomina,
} from "../codigo/utilidades/paqueteLibroNomina.js";
import {
  puedeConsultarNomina,
  asignarConsultaNomina,
} from "../codigo/dominio/accesoNomina.js";
import { exportarCompleto } from "../herramientas/prueba-editor-nomina/exportacionCompleta.js";

test("extracción identifica ejercicio, preserva importes y advierte fechas sin cargar plantillas", async () => {
  const fuente = await extraerAcumuladoNomina(await excelSintetico(), {
    ESTUARDO: "Empresa sintética",
  });
  assert.equal(fuente.anio, 2027);
  assert.equal(fuente.registros.length, 4);
  assert.deepEqual(
    fuente.registros.map((r) => r.mes),
    [1, 1, 2, 4],
  );
  assert.equal(fuente.registros[0].importes[0], 100000);
  assert.equal(fuente.registros[0].importes[1], null);
  assert.ok(fuente.advertencias.some((a) => a.includes("16-31")));
  for (const tipo of ["mensual", "anual"]) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await crearExcelAcumulado(fuente, tipo));
    assert.equal(libro.worksheets[0].name, "Acumulado 2027");
    assert.equal(libro.worksheets[0].getCell("B2").value, 17);
    assert.equal(libro.worksheets.length, tipo === "mensual" ? 4 : 3);
    const h = libro.worksheets[1];
    assert.equal(h.getCell("C4").value, 2000);
    assert.equal(h.getCell("K4").formula, "D4-F4");
  }
});
test("paquete conserva snapshot, original y fuente y rechaza libros inválidos", async () => {
  const snapshot = {
    sheetOrder: ["h"],
    sheets: { h: { name: "Prueba", cellData: { 0: { 0: { v: 12 } } } } },
  };
  const carga = await empaquetarLibro({
    snapshot,
    bytes: new Uint8Array([1, 2, 3]),
    nombre: "Prueba.xlsx",
    fuente: { dato: "privado" },
  });
  const leido = await desempaquetarLibro(carga);
  assert.deepEqual(leido.snapshot, snapshot);
  assert.deepEqual([...leido.bytes], [1, 2, 3]);
  assert.equal(leido.fuente.dato, "privado");
  assert.throws(() =>
    claveLibroNomina({ empresa: "AJENA", anio: 2027, tipo: "mensual" }),
  );
  await assert.rejects(() => empaquetarLibro({ snapshot: {} }));
  await assert.rejects(() => desempaquetarLibro("x".repeat(750001)));
});
test("consulta de nómina exige permiso explícito, cuenta activa y no concede administración", () => {
  const state = {
      employees: [{ id_empleado: "DEMO", estatus: "Activo" }],
      access: { workers: { DEMO: { active: true } }, permissions: {} },
      audit: [],
    },
    session = { id: "DEMO", role: "worker" };
  assert.equal(puedeConsultarNomina(state, session), false);
  const siguiente = asignarConsultaNomina(state, "DEMO", true);
  assert.equal(puedeConsultarNomina(siguiente, session), true);
  assert.equal(session.role, "worker");
  assert.equal(state.access.permissions.DEMO, undefined);
  assert.equal(
    puedeConsultarNomina(
      asignarConsultaNomina(siguiente, "DEMO", false),
      session,
    ),
    false,
  );
  siguiente.access.workers.DEMO.active = false;
  assert.equal(puedeConsultarNomina(siguiente, session), false);
});
test("descarga completa conserva edición, fórmula, estilo, dimensiones, hojas y combina celdas", async () => {
  const snapshot = {
    styles: { azul: { bg: { rgb: "#173957" }, bl: 1, n: { pattern: "0.00" } } },
    sheetOrder: ["uno", "dos"],
    sheets: {
      uno: {
        name: "Editada",
        cellData: {
          0: { 0: { v: "Título", s: "azul" } },
          1: { 0: { v: 4 }, 1: { f: "=A2*2", v: 8 } },
        },
        mergeData: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 }],
        columnData: { 0: { w: 215 } },
        rowData: { 0: { h: 40 } },
      },
      dos: { name: "Nueva", cellData: { 0: { 0: { v: 5 } } } },
    },
  };
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await exportarCompleto(snapshot));
  assert.deepEqual(
    libro.worksheets.map((h) => h.name),
    ["Editada", "Nueva"],
  );
  const h = libro.worksheets[0];
  assert.equal(h.getCell("B2").formula, "A2*2");
  assert.equal(h.getCell("A1").fill.fgColor.argb, "FF173957");
  assert.equal(h.getCell("B1").master.address, "A1");
  assert.equal(h.getRow(1).height, 30);
});

test("el formato de Acumulado conserva importes y fórmulas y puede aplicarse otra vez", () => {
  const libro = new ExcelJS.Workbook(),
    hoja = libro.addWorksheet("Acumulado 2027");
  hoja.getCell("B1").value = "Empresa ficticia";
  hoja.getCell("B2").value = "Resumen";
  hoja.getRow(4).values = [null, "MES", "IMPORTE"];
  hoja.getRow(5).values = [null, "ENERO", 12.5];
  hoja.getRow(6).values = [null, "FEBRERO", 0];
  hoja.getRow(7).values = [
    null,
    "TOTAL",
    { formula: "SUM(C5:C6)", result: 12.5 },
  ];
  for (let i = 0; i < 2; i++) {
    darFormatoAcumulado(hoja);
    assert.equal(hoja.getCell("C5").value, 12.5);
    assert.equal(hoja.getCell("C6").value, 0);
    assert.equal(hoja.getCell("C7").formula, "SUM(C5:C6)");
    assert.equal(hoja.getCell("C7").result, 12.5);
    assert.equal(hoja.getRow(6).hidden, false);
    assert.equal(hoja.getCell("B4").font.color.argb, "FFFFFFFF");
    assert.equal(hoja.views[0].showGridLines, false);
  }
});
