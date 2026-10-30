import { test, expect } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
import { pdfNominaEjemplo } from "../soporte/nominaEjemplo.js";
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
test("sube, acumula, corrige automáticamente un PDF y exporta XLSX mensual y anual con persistencia", async ({
  page,
}) => {
  const subir = page.getByLabel("Seleccionar PDF de nómina", { exact: true });
  await subir.setInputFiles(pdf());
  await expect(page.getByRole("status")).toContainText("Nómina guardada");
  await subir.setInputFiles(
    pdf({ desde: "01/Feb/2026", hasta: "15/Feb/2026" }),
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
      tipo === "mensual" ? ["enero", "febrero"] : ["PERSONA DEMO UNO"],
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

test("una carpeta procesa PDF de distintas empresas y subcarpetas, informa errores y no duplica al repetirla", async ({
  page,
}) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const carpeta = await mkdtemp(join(tmpdir(), "rey-carpeta-prueba-"));
  try {
    await mkdir(join(carpeta, "subcarpeta"));
    const original = pdfNominaEjemplo();
    await writeFile(join(carpeta, "a.pdf"), original);
    await writeFile(
      join(carpeta, "b.pdf"),
      pdfNominaEjemplo({ empresa: "EDGAR" }),
    );
    await writeFile(join(carpeta, "subcarpeta", "c.pdf"), original);
    await writeFile(join(carpeta, "subcarpeta", "d.pdf"), "PDF ilegible");
    await writeFile(join(carpeta, "notas.txt"), "No es una nómina");
    const input = page.getByLabel("Seleccionar carpeta de nóminas", {
      exact: true,
    });
    await input.setInputFiles(carpeta);
    await expect(
      page.getByRole("status").filter({ hasText: "Carpeta procesada:" }),
    ).toContainText("2 guardados, 1 ya cargados y 1 no guardados");
    let state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("reypez_react_v1")),
    );
    expect(state.payroll).toHaveLength(2);
    await expect(page.locator(".payroll-folder-results")).toContainText(
      "No guardado",
    );
    await input.setInputFiles(carpeta);
    await expect(
      page.getByRole("status").filter({ hasText: "Carpeta procesada:" }),
    ).toContainText("0 guardados, 3 ya cargados y 1 no guardados");
    state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("reypez_react_v1")),
    );
    expect(state.payroll).toHaveLength(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});
