import test from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extraerNomina } from "../codigo/dominio/extraerNomina.js";
import {
  afirmarSoloNomina,
  guardarNomina,
  modificarReciboNomina,
  recibosNomina,
  validarPeriodoNomina,
} from "../codigo/dominio/nomina.js";
import { crearLibroNomina } from "../codigo/utilidades/excelNomina.js";
import {
  configuracionDe,
  armarEstado,
  diferencias,
  estadoPublico,
  tieneOperacionPropia,
} from "../codigo/repositorios/estadoFirebase.js";
import {
  pdfNominaEjemplo,
  entradaNominaEjemplo,
} from "./soporte/nominaEjemplo.js";
const base = () => ({
  payroll: [],
  audit: [],
  employees: [],
  attendance: [],
  alerts: [],
  schedules: [],
});
async function leer(bytes) {
  const t = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await t.promise;
    const paginas = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      paginas.push({
        ancho: p.getViewport({ scale: 1 }).width,
        items: (await p.getTextContent()).items,
      });
    }
    return extraerNomina(paginas);
  } finally {
    await t.destroy();
  }
}
test("extrae las tres empresas desde PDF sin seleccionar empresa; concilia subsidio, ISR y ajuste negativo", async () => {
  for (const empresa of ["ALLAN", "EDGAR", "ESTUARDO"]) {
    const p = await leer(pdfNominaEjemplo({ empresa }));
    const r = JSON.parse(p.registrosJson)[0];
    assert.equal(p.empresa_codigo, empresa);
    assert.equal(p.desde, "2026-01-01");
    assert.equal(r.salarioDiario, 35000);
    assert.equal(r.neto, 503010);
    assert.equal(r.totalDeducciones, 21990);
    assert.equal(
      r.deducciones.find((c) => c.codigo === "32").informativo,
      true,
    );
  }
});
test("un PDF inconsistente no se guarda ni se sustituye parcialmente", async () => {
  const bytes = pdfNominaEjemplo();
  const t = getDocument({ data: bytes });
  const pdf = await t.promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.map((i) =>
    i.str === "219.90" ? { ...i, str: "999.99" } : i,
  );
  assert.throws(() => extraerNomina([{ ancho: 612, items }]), /totales/);
  assert.throws(
    () => extraerNomina([{ ancho: 612, items: [] }]),
    /identificar/,
  );
  await t.destroy();
});
test("acumula empresas, meses y quincenas; repetidos no duplican y reemplazos conservan auditoría y otros períodos", () => {
  let s = base();
  for (const p of [
    entradaNominaEjemplo(),
    entradaNominaEjemplo({ segunda: true }),
    entradaNominaEjemplo({ mes: 2 }),
    entradaNominaEjemplo({ empresa: "EDGAR" }),
  ])
    s = guardarNomina(s, p);
  assert.equal(s.payroll.length, 4);
  assert.strictEqual(guardarNomina(s, entradaNominaEjemplo()), s);
  const cambio = entradaNominaEjemplo();
  cambio.huella = "b".repeat(64);
  assert.strictEqual(guardarNomina(s, cambio), s);
  const modificado = recibosNomina(cambio);
  modificado[0].salarioDiario = 36000;
  cambio.registrosJson = JSON.stringify(modificado);
  assert.throws(() => guardarNomina(s, cambio), /ya está/);
  const next = guardarNomina(s, cambio, { reemplazar: true });
  assert.equal(next.payroll.length, 4);
  assert.equal(next.payroll.find((p) => p.id === cambio.id).revision, 2);
  assert.equal(
    next.payroll.find((p) => p.id === cambio.id).actualizadoPor,
    "MARIA",
  );
  assert.equal(next.audit[0].by, "MARIA");
  assert.equal(next.audit[0].anterior.revision, 1);
  assert.deepEqual(
    next.payroll.filter((p) => p.id !== cambio.id),
    s.payroll.filter((p) => p.id !== cambio.id),
  );
  assert.throws(
    () =>
      guardarNomina(s, entradaNominaEjemplo({ mes: 3 }), { reemplazar: true }),
    /no corresponde/,
  );
});
test("corrección manual conserva conceptos, identidad y todos los recibos ajenos", () => {
  const entrada = entradaNominaEjemplo();
  let s = guardarNomina(base(), entrada);
  const r = recibosNomina(entrada)[0];
  const cambio = {
    ...r,
    deducciones: r.deducciones.map((c) => ({ ...c, importe: 15000 })),
  };
  s = modificarReciboNomina(
    s,
    entrada.id,
    r.clave,
    cambio,
    "Corrección autorizada",
  );
  assert.equal(recibosNomina(s.payroll[0])[0].neto, 510000);
  assert.equal(s.audit[0].motivo, "Corrección autorizada");
  assert.equal(s.audit[0].by, "MARIA");
  assert.equal(s.payroll[0].actualizadoPor, "MARIA");
  assert.throws(
    () =>
      modificarReciboNomina(
        s,
        entrada.id,
        r.clave,
        { ...cambio, deducciones: [] },
        "Corrección",
      ),
    /conceptos/,
  );
  assert.throws(
    () => modificarReciboNomina(s, entrada.id, r.clave, cambio, ""),
    /motivo/,
  );
});
test("exportaciones XLSX reales aíslan empresa, ordenan meses y separan trabajadores sin sumar salarios diarios", async () => {
  let s = base();
  for (const p of [
    entradaNominaEjemplo({ mes: 2 }),
    entradaNominaEjemplo(),
    entradaNominaEjemplo({ empresa: "EDGAR" }),
  ])
    s = guardarNomina(s, p);
  const p = s.payroll.find((p) => p.empresa_codigo === "ALLAN");
  const rr = recibosNomina(p);
  rr.push({
    ...rr[0],
    clave: "COD:002",
    codigo: "002",
    nombre: "PERSONA DEMO DOS",
  });
  p.registrosJson = JSON.stringify(rr);
  const mensual = crearLibroNomina(s, "ALLAN", 2026, "mensual");
  assert.deepEqual(
    mensual.worksheets.map((h) => h.name),
    ["Acumulado 2026", "enero", "febrero"],
  );
  const anual = crearLibroNomina(s, "ALLAN", 2026, "anual");
  assert.equal(anual.worksheets.length, 3);
  assert.ok(anual.worksheets.every((h) => !h.name.includes("EDGAR")));
  const bytes = await anual.xlsx.writeBuffer();
  const { default: ExcelJS } = await import("exceljs");
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(bytes);
  assert.equal(leido.worksheets.length, 3);
  const hoja = leido.worksheets.find((h) => h.name === "PERSONA DEMO UNO");
  const total = hoja.lastRow;
  assert.equal(total.getCell(3).value, null);
  assert.ok(total.getCell(hoja.columnCount).value.formula.startsWith("SUM("));
  assert.throws(() => crearLibroNomina(s, "ALLAN", 2025, "mensual"), /No hay/);
});
test("un trabajador autorizado queda como responsable y no altera otras secciones", () => {
  const entrada = entradaNominaEjemplo({ empresa: "EDGAR" });
  const antes = {
    ...base(),
    employees: [{ id_empleado: "ES-01", empresa_codigo: "ESTUARDO" }],
  };
  const next = guardarNomina(antes, entrada, { responsable: "ES-01" });
  assert.equal(next.payroll[0].actualizadoPor, "ES-01");
  assert.equal(next.audit[0].by, "ES-01");
  assert.equal(next.payroll[0].empresa_codigo, "EDGAR");
  assert.equal(
    afirmarSoloNomina(antes, next).employees[0].id_empleado,
    "ES-01",
  );
  assert.throws(
    () => afirmarSoloNomina(antes, { ...next, employees: [] }),
    /otras secciones/,
  );
  const r = recibosNomina(entrada)[0];
  const corregida = modificarReciboNomina(
    next,
    entrada.id,
    r.clave,
    { ...r, deducciones: r.deducciones.map((c) => ({ ...c, importe: 15000 })) },
    "Ajuste de Claudia",
    new Date(),
    "ES-01",
  );
  assert.equal(corregida.payroll[0].actualizadoPor, "ES-01");
  assert.equal(corregida.audit[0].by, "ES-01");
  assert.equal(corregida.audit[0].motivo, "Ajuste de Claudia");
  assert.throws(
    () => guardarNomina(antes, entrada, { responsable: "" }),
    /quién modifica/,
  );
});
test("persistencia privada, copias antiguas y validación de fechas y payload", () => {
  const s = guardarNomina(base(), entradaNominaEjemplo());
  assert.ok(tieneOperacionPropia(s));
  assert.equal(
    diferencias(base(), s).filter((o) => o.coleccion === "nominas").length,
    1,
  );
  assert.ok(!JSON.stringify(configuracionDe(s)).includes("PERSONA DEMO"));
  assert.deepEqual(estadoPublico(null).payroll, []);
  assert.equal(
    armarEstado({ listas: { payroll: s.payroll } }).payroll.length,
    1,
  );
  assert.throws(
    () =>
      validarPeriodoNomina({ ...entradaNominaEjemplo(), desde: "2026-02-30" }),
    /inválido/,
  );
});
