/* global process, console, window, document, Blob */
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import JSZip from "jszip";
import ExcelJS from "exceljs";

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
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(temporal, "editor-demo.png") });
  const demo = await page.evaluate(() => window.pruebaEditor.snapshot());
  assert.equal(demo.sheetOrder.length, 3);
  assert.equal(demo.sheets.acumulado.name, "Acumulado 2026");
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
  await page.locator("#guardar").click();
  await page.waitForFunction(() =>
    document.getElementById("estado").textContent.startsWith("Prueba guardada"),
  );
  await page.reload();
  await page.waitForFunction(() => window.pruebaEditor);
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
  if (process.env.REYPEZ_EXCEL_PRUEBA) {
    await page
      .locator("#archivo")
      .setInputFiles(process.env.REYPEZ_EXCEL_PRUEBA);
    await page.waitForFunction(
      () => window.pruebaEditor.resumen()?.formulas === 1935,
    );
    const r = await page.evaluate(() => window.pruebaEditor.resumen());
    assert.equal(r.hojas, 5);
    assert.equal(r.externas, 4);
    await page.evaluate(() => {
      const sheet = window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheetByName("ACUMULADO 2026");
      sheet.activate();
      sheet.getRange("F29").setValue(999);
    });
    const copy = await page.evaluate(async () =>
      Array.from(await window.pruebaEditor.exportar()),
    );
    const src = await JSZip.loadAsync(
      await fs.readFile(process.env.REYPEZ_EXCEL_PRUEBA),
    );
    const dest = await JSZip.loadAsync(Buffer.from(copy));
    const baseline = await page.evaluate(() => window.pruebaEditor.baseline());
    assert.equal(baseline.sheetOrder.length, 5);
    let iguales = 0;
    const permitidos = new Set([
      "xl/worksheets/sheet5.xml",
      "xl/workbook.xml",
      "xl/calcChain.xml",
      "xl/_rels/workbook.xml.rels",
      "[Content_Types].xml",
    ]);
    for (const [name, entry] of Object.entries(src.files)) {
      if (entry.dir || permitidos.has(name)) continue;
      assert.deepEqual(
        await dest.file(name).async("uint8array"),
        await entry.async("uint8array"),
        name,
      );
      iguales++;
    }
    await resultado.xlsx.load(Buffer.from(copy));
    assert.equal(
      resultado.getWorksheet("ACUMULADO 2026").getCell("F29").value,
      999,
    );
    assert.equal(
      resultado.getWorksheet("ACUMULADO 2026").getCell("F33").formula,
      "+'[1]SUBSIDIO AL EMPLEO'!$E$368",
    );
    console.log(
      `PASS: libro privado: 5 hojas, 1935 fórmulas, 4 vínculos externos; ${iguales} componentes intactos`,
    );
    await page.locator("#guardar").click();
    await page.waitForFunction(() =>
      document
        .getElementById("estado")
        .textContent.startsWith("Prueba guardada"),
    );
    await page.reload();
    await page.waitForFunction(() => window.pruebaEditor);
    await page.locator("#recuperar").click();
    await page.waitForFunction(() =>
      document.getElementById("estado").textContent.startsWith("Se reabrieron"),
    );
    assert.equal(
      await page.evaluate(() =>
        window.pruebaEditor
          .api()
          .getActiveWorkbook()
          .getSheetByName("ACUMULADO 2026")
          .getRange("F29")
          .getRawValue(),
      ),
      999,
    );
    console.log("PASS: guardado y reapertura del libro privado");
    const jsonBytes = await page.evaluate(
      () => new Blob([JSON.stringify(window.pruebaEditor.snapshot())]).size,
    );
    console.log("Tamaño del estado del editor en bytes:", jsonBytes);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: sin errores del navegador. Captura ficticia:",
    path.join(temporal, "editor-demo.png"),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
