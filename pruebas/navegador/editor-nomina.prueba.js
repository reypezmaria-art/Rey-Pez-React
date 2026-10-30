import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { companyNames } from "../../codigo/datos/constantes.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
import { excelSintetico } from "../soporte/acumuladoEjemplo.js";
const credencial = await makeCredential("Clave6");
async function iniciar(page, delegado = false) {
  await page.route("**/__local/empleados", (r) =>
    r.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript(
    ({ base, credencial, delegado }) => {
      if (localStorage.getItem("reypez_react_v1")) return;
      localStorage.setItem(
        "reypez_react_v1",
        JSON.stringify({
          ...base,
          employees: [
            {
              id_empleado: "DEMO",
              nombre_completo: "Persona ficticia",
              empresa_codigo: "ESTUARDO",
              estatus: "Activo",
            },
          ],
          attendance: [],
          alerts: [],
          schedules: [],
          access: {
            admin: credencial,
            workers: { DEMO: credencial },
            permissions: { DEMO: { consultaNominaTodas: delegado } },
          },
        }),
      );
    },
    { base: baseOperation, credencial, delegado },
  );
  await page.goto("/#administracion");
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Nómina", exact: true })
    .click();
}
async function importar(page) {
  await page.getByLabel("Seleccionar Excel acumulado de nómina").setInputFiles({
    name: "sintetico.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await excelSintetico(companyNames.ESTUARDO)),
  });
  await expect(
    page.getByRole("region", { name: "Revisar importación de Excel" }),
  ).toContainText("2027");
  await page
    .getByRole("button", { name: "Guardar nómina identificada" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Nómina importada y guardada",
  );
}
test("importa Excel, edita y reabre desde Nómina; descarga lo guardado y detecta revisiones concurrentes", async ({
  page,
}) => {
  test.setTimeout(90000);
  await iniciar(page);
  await importar(page);
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Hoja de cálculo de nómina"]');
  await expect(frame.locator("#estado")).toContainText("Libro abierto", {
    timeout: 30000,
  });
  const child = page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"));
  await child.evaluate(() => {
    const wb = window.pruebaEditor.api().getActiveWorkbook();
    wb.getSheetByName("enero").getRange("C5").setValue(1500);
  });
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("Versión 2 guardada");
  await page
    .getByRole("button", { name: "Cerrar editor", exact: true })
    .click();
  const descarga = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar Excel mensual", exact: true })
    .click();
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await readFile(await (await descarga).path()));
  expect(libro.getWorksheet("enero").getCell("C5").value).toBe(1500);
  expect(libro.worksheets[0].name).toBe("Acumulado 2027");
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  await expect(frame.locator("#estado")).toContainText("Libro abierto", {
    timeout: 30000,
  });
  const nuevo = page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"));
  expect(
    await nuevo.evaluate(() => {
      const snap = window.pruebaEditor.snapshot();
      const hoja = Object.values(snap.sheets).find((h) => h.name === "enero");
      return hoja.cellData[4][2].v;
    }),
  ).toBe(1500);
  // Otra sesión guarda mientras esta vista sigue en la revisión anterior.
  await page.evaluate(async () => {
    const { repositorioLibrosNomina } =
      await import("/codigo/repositorios/librosNomina.js");
    const r = repositorioLibrosNomina({
      empresa: "ESTUARDO",
      anio: 2027,
      tipo: "mensual",
    });
    const actual = await r.abrir();
    await r.guardar(actual.carga, actual.actual);
  });
  await nuevo.evaluate(() =>
    window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getSheetByName("enero")
      .getRange("C5")
      .setValue(1900),
  );
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("versión más reciente");
  expect(
    await nuevo.evaluate(() => {
      const snap = window.pruebaEditor.snapshot();
      return Object.values(snap.sheets).find((h) => h.name === "enero")
        .cellData[4][2].v;
    }),
  ).toBe(1900);
});
test("cuenta delegada consulta las tres empresas, exporta y no ve acciones administrativas", async ({
  page,
}) => {
  test.setTimeout(90000);
  await iniciar(page, true);
  await importar(page);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByLabel("ID", { exact: true }).fill("DEMO");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nómina", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Seleccionar Excel acumulado de nómina"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Modificar un mes", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Generar mensual/ }).click();
  const opciones = await page
    .getByLabel("Empresa para exportar nómina")
    .locator("option")
    .allTextContents();
  expect(opciones).toHaveLength(4);
  await page
    .getByLabel("Empresa para exportar nómina")
    .selectOption("ESTUARDO");
  await page.getByLabel("Año de nómina").fill("2027");
  await page
    .getByRole("button", { name: "Ver libro guardado", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Hoja de cálculo de nómina"]');
  await expect(frame.locator("#estado")).toContainText("Consulta de nómina", {
    timeout: 30000,
  });
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText(
    "consulta y exportación",
  );
});

test("Secciones agrupa las cuatro opciones y abre consultas de la empresa sin acciones de administración", async ({
  page,
}) => {
  await iniciar(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  await page
    .getByLabel("Empresa autorizada", { exact: true })
    .selectOption("ESTUARDO");
  await page.getByLabel("Usuario activo", { exact: true }).selectOption("DEMO");
  await page.getByText(/^Secciones ·/).click();
  const secciones = page.getByRole("group", { name: "Secciones autorizadas" });
  await expect(secciones.getByRole("checkbox")).toHaveCount(4);
  for (const nombre of [
    "Personal",
    "Mantenimiento y compras",
    "Reportes y CSV",
  ])
    await secciones
      .getByRole("checkbox", { name: nombre, exact: true })
      .check();
  await expect(
    page.getByText(/Con este permiso puede ver, cargar y corregir/),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Guardar permisos", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Permisos guardados");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.goto("/#seccion?tipo=employees");
  await page.getByLabel("ID", { exact: true }).fill("DEMO");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Personal", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Agregar empleado|Dar de baja|Modificar/,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reportes y CSV", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reportes y CSV", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar CSV", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mantenimiento y compras", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mantenimiento y compras", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar actividad", exact: true }),
  ).toHaveCount(0);
});
