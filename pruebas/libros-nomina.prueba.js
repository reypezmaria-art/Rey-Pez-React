import { aplicarFormatoPdf } from "../herramientas/prueba-editor-nomina/formatoPdf.js";
import {
  firmasPdf,
  pdfPendientes,
  filaDesdePdf,
  detalleResumen,
} from "../herramientas/prueba-editor-nomina/pdfEnLibro.js";
import { entradaNominaEjemplo } from "./soporte/nominaEjemplo.js";
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
  destinoTrasIngresar,
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
  assert.ok(
    fuente.advertencias.some((a) => a.includes("diciembre no se importó")),
  );
  assert.ok(
    !fuente.advertencias.some((a) => a.includes("enero no se importó")),
  );
  for (const tipo of ["mensual", "anual"]) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await crearExcelAcumulado(fuente, tipo));
    assert.equal(libro.worksheets[0].name, "Acumulado 2027");
    assert.equal(libro.worksheets[0].getCell("B2").value, 17);
    assert.equal(libro.worksheets.length, tipo === "mensual" ? 4 : 3);
    const h = libro.worksheets[1];
    assert.deepEqual(h.getRow(3).values.slice(1, 25), fuente.columnas);
    assert.equal(h.getCell("A4").font.name, "Calibri");
    assert.equal(h.getCell("A4").font.size, 11);
    assert.equal(h.getCell("A1").font.size, 16);
    assert.equal(h.getCell("E4").value, 2000);
    assert.equal(h.getCell("X4").formula, "L4-S4");
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
  assert.equal(destinoTrasIngresar(siguiente, session, ""), "#nomina");
  assert.equal(
    destinoTrasIngresar(siguiente, session, "#administracion"),
    "#nomina",
  );
  assert.equal(
    destinoTrasIngresar(siguiente, session, "#captura?area=cuarto-ajeno"),
    "#captura?area=cuarto-ajeno",
  );
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
    defaultStyle: { ff: "Calibri", fs: 11 },
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
  assert.equal(h.getCell("A1").font.name, "Calibri");
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
  hoja.headerFooter = null;
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

test("PDF pendiente se identifica por su contenido, conserva centavos y separa conceptos ajenos a las columnas originales", async () => {
  const p = entradaNominaEjemplo({ empresa: "ESTUARDO", mes: 10 });
  const r = JSON.parse(p.registrosJson)[0];
  const { fila, extras } = filaDesdePdf(p, r);
  assert.equal(fila[1], "OCT 01-15");
  assert.equal(fila[4], 5250);
  assert.equal(fila[18], 120);
  assert.equal(fila[23], 5130);
  assert.equal(extras["SALARIO DIARIO"], 350);
  assert.equal(extras["DÍAS PAGADOS"], 15);
  const firmas = await firmasPdf([p]);
  assert.equal(pdfPendientes([p], {}, firmas).length, 1);
  assert.equal(pdfPendientes([p], firmas, firmas).length, 0);
  const corregido = {
    ...p,
    registrosJson: p.registrosJson.replace("525000", "526000"),
  };
  const nuevas = await firmasPdf([corregido]);
  assert.equal(pdfPendientes([corregido], firmas, nuevas).length, 1);
  const desconocido = {
    ...r,
    percepciones: [
      ...r.percepciones,
      {
        codigo: "987",
        concepto: "Concepto adicional",
        importe: 123,
        informativo: false,
        valor: null,
      },
    ],
  };
  assert.equal(
    filaDesdePdf(p, desconocido).extras["Percepción 987 · Concepto adicional"],
    1.23,
  );
});

test("presentación PDF reutiliza encabezados y bandas del Excel sin cambiar valores ni metadatos", () => {
  const cabecera = {
    0: {
      v: "NOMBRE",
      s: { bg: { rgb: "#173957" }, cl: { rgb: "#ffffff" }, bl: 1 },
    },
    1: { v: "PERIODO" },
    4: { v: "SUELDO" },
  };
  const snapshot = {
    styles: {},
    sheetOrder: ["sep", "oct"],
    sheets: {
      sep: {
        id: "sep",
        name: "septiembre",
        cellData: {
          0: { 0: { v: "Empresa", s: { bg: { rgb: "#173957" } } } },
          1: { 0: { v: "septiembre", s: { bg: { rgb: "#F4E6BD" } } } },
          2: cabecera,
          3: { 0: { v: "Persona" }, 1: { v: "SEP 01-15" }, 4: { v: 100 } },
          4: { 0: { v: "Total" } },
        },
        mergeData: [
          { startRow: 0, endRow: 0, startColumn: 0, endColumn: 10 },
          { startRow: 1, endRow: 1, startColumn: 0, endColumn: 10 },
        ],
        columnData: { 0: { w: 306 } },
        rowData: { 2: { h: 64 } },
      },
      oct: {
        id: "oct",
        name: "octubre",
        cellData: {
          0: { 0: { v: "Empresa" } },
          1: { 0: { v: "octubre" } },
          2: cabecera,
          3: {
            0: {
              v: "Persona",
              custom: {
                pdfNomina: {
                  periodo: "DEMO_2027-10-01_2027-10-15",
                  clave: "DEMO",
                },
              },
            },
            1: { v: "OCT 01-15" },
            2: { v: "00-00-00-0000-1" },
            4: { v: 123 },
            23: { v: 122, f: "=E4-1" },
          },
          4: { 0: { v: "Total" } },
        },
        mergeData: [],
        columnData: {},
        rowData: {},
      },
    },
  };
  const antes = structuredClone(snapshot);
  const cambio = aplicarFormatoPdf(snapshot, "mensual");
  assert.deepEqual(snapshot, antes);
  assert.deepEqual(
    cambio.sheets.oct.cellData[2][0].s,
    cambio.sheets.sep.cellData[2][0].s,
  );
  assert.equal(cambio.sheets.oct.cellData[3][4].s.bg.rgb, "#F0F5FB");
  assert.equal(cambio.sheets.sep.cellData[3][0].s.ff, "Calibri");
  assert.equal(cambio.sheets.oct.cellData[3][2].s.fs, 11);
  assert.equal(cambio.sheets.oct.cellData[3][2].v, "00-00-00-0000-1");
  assert.equal(cambio.sheets.oct.cellData[3][23].f, "=E4-1");
  assert.deepEqual(
    cambio.sheets.oct.cellData[3][0].custom,
    antes.sheets.oct.cellData[3][0].custom,
  );
  assert.deepEqual(aplicarFormatoPdf(cambio, "mensual"), cambio);
});

test("resumen cuenta personas distintas y conserva el ISR a compensar del formato de referencia", () => {
  const snapshot = {
    sheets: {
      h: {
        name: "octubre",
        cellData: {
          2: { 0: { v: "NOMBRE" }, 1: { v: "PERIODO" }, 4: { v: "SUELDO" } },
          3: {
            0: { v: "Persona demo" },
            1: { v: "OCT 01-15" },
            3: { v: "RFC-DEMO" },
            15: { v: 3 },
            16: { v: 5 },
          },
          4: {
            0: { v: "Persona demo" },
            1: { v: "OCT 16-31" },
            3: { v: "RFC-DEMO" },
            16: { v: 4 },
          },
        },
      },
    },
  };
  assert.equal(detalleResumen(snapshot, 10, "personas").suma, 100);
  assert.equal(detalleResumen(snapshot, 10, "isrRetenido").suma, 1200);
  assert.match(detalleResumen(snapshot, 10, "isrRetenido").formula, /P4/);
  assert.match(detalleResumen(snapshot, 10, "isrRetenido").formula, /Q5/);
});
