/* global process, console, window, document */
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import ExcelJS from "exceljs";
import { probarCinta } from "./recorridoCinta.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const temporal = await fs.mkdtemp(path.join(os.tmpdir(), "rey-editor-"));
const server = await preview({
  root,
  configFile: false,
  preview: { host: "127.0.0.1", port: 5191, strictPort: true },
});
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1450, height: 950 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5191");
  await page.waitForFunction(() => window.pruebaEditor);
  await page.locator("canvas:visible").first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(temporal, "editor-demo.png") });
  const demo = await page.evaluate(() => window.pruebaEditor.snapshot());
  assert.equal(demo.sheetOrder.length, 3);
  assert.equal(demo.sheets.acumulado.name, "Acumulado 2026");
  await probarCinta(page);
  await page.locator("#menu-archivo > summary").click();
  await page.locator("#abrir").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#menu-archivo").getAttribute("open"), null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#menu-archivo > summary").click();
  const panel = await page.locator(".panel-archivo").boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 390);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1450, height: 950 });
  console.log("PASS: menú Archivo accesible con teclado y visible en móvil");
  const fuente = new ExcelJS.Workbook();
  const ene = fuente.addWorksheet("Enero");
  ene.addRow(["Persona demo", 100, 20, { formula: "B1-C1", result: 80 }]);
  ene.getCell("B1").numFmt = '"$"#,##0.00';
  const anio = fuente.addWorksheet("Acumulado 2026");
  anio.getCell("A1").value = { formula: "'Enero'!D1", result: 80 };
  const synthetic = path.join(temporal, "demo.xlsx");
  await fuente.xlsx.writeFile(synthetic);
  await page.locator("#archivo").setInputFiles(synthetic);
  await page.waitForFunction(() => window.pruebaEditor.resumen()?.hojas === 2);
  await page.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getSheetByName("Enero")
      .getRange("B1")
      .setValue(125),
  );
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheetByName("Enero")
        .getRange("D1")
        .getValue() === 105,
  );
  console.log("PASS: edición y recálculo de fórmula interna");
  await page.locator("#deshacer").click();
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheetByName("Enero")
        .getRange("B1")
        .getRawValue() === 100,
  );
  await page.locator("#rehacer").click();
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheetByName("Enero")
        .getRange("B1")
        .getRawValue() === 125,
  );
  console.log("PASS: accesos rápidos Deshacer y Rehacer modifican la celda");
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() =>
    document.getElementById("estado").textContent.startsWith("Prueba guardada"),
  );
  await page.reload();
  await page.waitForFunction(() => window.pruebaEditor);
  await page.locator("#menu-archivo > summary").click();
  await page.locator("#recuperar").click();
  await page.waitForFunction(() =>
    document.getElementById("estado").textContent.startsWith("Se reabrieron"),
  );
  assert.equal(
    await page.evaluate(
      () => window.pruebaEditor.snapshot().sheets["hoja-1"].cellData[0][1].v,
    ),
    125,
  );
  console.log("PASS: guardar y reabrir tras recargar el navegador");
  const bytes = await page.evaluate(async () =>
    Array.from(await window.pruebaEditor.exportar()),
  );
  await page.locator("#menu-archivo > summary").click();
  const descarga = page.waitForEvent("download");
  await page.locator("#descargar").click();
  const archivoDescargado = await descarga;
  assert.equal(archivoDescargado.suggestedFilename(), "PRUEBA_demo.xlsx");
  const resultado = new ExcelJS.Workbook();
  await resultado.xlsx.load(Buffer.from(bytes));
  assert.equal(resultado.getWorksheet("Enero").getCell("B1").value, 125);
  assert.equal(resultado.getWorksheet("Enero").getCell("D1").formula, "B1-C1");
  assert.equal(
    resultado.getWorksheet("Enero").getCell("B1").numFmt,
    '"$"#,##0.00',
  );
  console.log("PASS: descarga XLSX conserva cambio, fórmula y moneda");
  await page.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getSheetByName("Enero")
      .getRange("B1")
      .setValue("=SUM(B2:B3)"),
  );
  const cambioFormula = await page.evaluate(async () =>
    Array.from(await window.pruebaEditor.exportar()),
  );
  await resultado.xlsx.load(Buffer.from(cambioFormula));
  assert.equal(
    resultado.getWorksheet("Enero").getCell("B1").formula,
    "SUM(B2:B3)",
  );
  console.log("PASS: edición de fórmula se exporta como fórmula");
  await page.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getActiveSheet()
      .getRange("A1:D2")
      .createFilter(),
  );
  const rechazoFiltro = await page.evaluate(async () => {
    try {
      await window.pruebaEditor.exportar();
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(rechazoFiltro, /filtros/);
  await page.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getActiveSheet()
      .getFilter()
      .remove(),
  );
  await page.evaluate(async () => {
    await window.pruebaEditor.exportar();
  });
  console.log(
    "PASS: exportación rechaza un filtro nuevo y vuelve a funcionar al retirarlo",
  );
  await page.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getSheetByName("Enero")
      .getRange("B1")
      .setBackgroundColor("#ff0000"),
  );
  const rechazo = await page.evaluate(async () => {
    try {
      await window.pruebaEditor.exportar();
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(rechazo, /formatos originales/);
  console.log(
    "PASS: no descarga silenciosamente cambios de formato incompatibles",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: sin errores del navegador. Captura ficticia:",
    path.join(temporal, "editor-demo.png"),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
