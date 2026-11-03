import { test, expect } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
import { pdfNominaEjemplo } from "../soporte/nominaEjemplo.js";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
const credencial = await makeCredential("Clave6");
test.beforeEach(async ({ page }) => {
  await page.route("**/__local/empleados", (r) =>
    r.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript(
    (credencial) => {
      if (!localStorage.getItem("reypez_react_v1"))
        localStorage.setItem(
          "reypez_react_v1",
          JSON.stringify({ ...credencial }),
        );
    },
    {
      ...structuredClone(baseOperation),
      employees: [],
      attendance: [],
      alerts: [],
      schedules: [],
      access: { admin: credencial, workers: {}, permissions: {} },
    },
  );
  await page.goto("/#administracion");
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Nómina", exact: true })
    .click();
});
const pdf = (args, name = "ejemplo.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(pdfNominaEjemplo(args)),
});
test("reintenta el módulo PDF después de un fallo de red sin volver a seleccionar el archivo", async ({
  page,
}) => {
  let peticiones = 0;
  await page.route("**/codigo/utilidades/pdfNomina.js*", (route) => {
    peticiones++;
    return peticiones === 1 ? route.abort("failed") : route.continue();
  });
  await page
    .getByLabel("Seleccionar PDF de nómina", { exact: true })
    .setInputFiles(pdf());
  await expect(page.getByRole("status")).toContainText("Nómina guardada", {
    timeout: 20000,
  });
  expect(peticiones).toBeGreaterThanOrEqual(2);
});
test("si el módulo PDF sigue sin cargar muestra Actualizar página y conserva las nóminas", async ({
  page,
}) => {
  await page.route("**/codigo/utilidades/pdfNomina.js*", (route) =>
    route.abort("failed"),
  );
  await page
    .getByLabel("Seleccionar PDF de nómina", { exact: true })
    .setInputFiles(pdf());
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo cargar una parte de Nómina",
    { timeout: 20000 },
  );
  await expect(
    page.getByRole("button", { name: "Actualizar página", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("reypez_react_v1")).payroll || [],
    ),
  ).toHaveLength(0);
});
test("cálculos informativos sin ISR retenido conservan los importes del recibo", async ({
  page,
}) => {
  await page
    .getByLabel("Seleccionar PDF de nómina", { exact: true })
    .setInputFiles(pdf({ empresa: "EDGAR", calculoInformativo: true }));
  await expect(page.getByRole("status")).toContainText("Nómina guardada", {
    timeout: 20000,
  });
  const r = await page.evaluate(
    () =>
      JSON.parse(
        JSON.parse(localStorage.getItem("reypez_react_v1")).payroll[0]
          .registrosJson,
      )[0],
  );
  expect(r.totalDeducciones).toBe(11990);
  expect(r.neto).toBe(513010);
  for (const codigo of ["32", "41"])
    expect(r.deducciones.find((c) => c.codigo === codigo).informativo).toBe(
      true,
    );
});
test("importa Infonavit CF sin duplicar el descuento cuando el recibo continúa en otra página", async ({
  page,
}) => {
  await page
    .getByLabel("Seleccionar PDF de nómina", { exact: true })
    .setInputFiles(
      pdf({
        empresa: "EDGAR",
        rfc: "DEMO-010101-AAA",
        infonavitCf: 25000,
        continuar: true,
      }),
    );
  await expect(page.getByRole("status")).toContainText("Nómina guardada");
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.payroll).toHaveLength(1);
  const r = JSON.parse(state.payroll[0].registrosJson)[0];
  expect(r.clave).toBe("RFC:DEMO010101AAA");
  expect(r.totalDeducciones).toBe(46990);
  expect(r.neto).toBe(478010);
  expect(r.deducciones.find((c) => c.codigo === "16").informativo).toBe(false);
  expect(r.deducciones.find((c) => c.codigo === "180").informativo).toBe(true);
});
test("sube, acumula, corrige automáticamente un PDF y exporta XLSX mensual y anual con persistencia", async ({
  page,
}) => {
  const subir = page.getByLabel("Seleccionar PDF de nómina", { exact: true });
  await subir.setInputFiles({
    name: "nomina.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(new jsPDF().output("arraybuffer")),
  });
  await expect(page.getByRole("alert")).toContainText(
    "no contiene texto legible",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await subir.setInputFiles(pdf({}, "reporte sin fecha ni empresa.pdf"));
  await expect(page.getByRole("status")).toContainText("Nómina guardada");
  await subir.setInputFiles(
    pdf(
      { desde: "01/Feb/2026", hasta: "15/Feb/2026" },
      "Lista de raya 14ABRIL.pdf",
    ),
  );
  await expect(page.getByRole("status")).toContainText("2026-02-01");
  await subir.setInputFiles(pdf({ empresa: "EDGAR" }));
  await expect(page.getByRole("status")).toContainText("Edgar");
  await subir.setInputFiles(pdf());
  await expect(page.getByRole("status")).toContainText("No se duplicó");
  await expect(page.locator(".payroll-files")).not.toHaveAttribute("open");
  await page
    .getByRole("button", { name: "Modificar un mes", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Volver a subir archivo", exact: true })
    .check();
  await expect(
    page.getByLabel("Nómina a modificar", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Seleccionar PDF corregido", { exact: true })
    .setInputFiles(pdf({ importe: 550000 }, "corregido.pdf"));
  await expect(page.getByRole("status")).toContainText("Nómina corregida");
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.payroll).toHaveLength(3);
  expect(state.audit[0].anterior).toBeTruthy();
  for (const tipo of ["mensual", "anual"]) {
    await page
      .getByRole("button", { name: new RegExp("Generar " + tipo) })
      .click();
    await page.getByLabel("Empresa para exportar nómina").selectOption("ALLAN");
    await page.getByLabel("Año de nómina").fill("2026");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar Excel " + tipo, exact: true })
      .click();
    const file = await download;
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await readFile(await file.path()));
    expect(libro.worksheets.map((h) => h.name)).toEqual(
      tipo === "mensual"
        ? ["Acumulado 2026", "enero", "febrero"]
        : ["Acumulado 2026", "PERSONA DEMO UNO"],
    );
  }
  await page.reload();
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Nómina", exact: true })
    .click();
  await expect(page.locator(".payroll-files summary").first()).toHaveText(
    "Archivos cargados (3)",
  );
  await page.getByLabel("Seleccionar PDF de nómina").setInputFiles({
    name: "invalido.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("ilegible"),
  });
  await expect(page.getByRole("alert")).toContainText("PDF válido");
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.payroll).toHaveLength(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
