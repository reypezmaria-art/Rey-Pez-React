import { pdfNominaEjemplo } from "../soporte/nominaEjemplo.js";
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
  // La cinta libera espacio para filas y las pestañas vuelven a abrirla.
  const paneles = frame.locator("#paneles-cinta");
  if (page.viewportSize().width <= 900) await expect(paneles).toBeHidden();
  if (await paneles.isHidden())
    await frame.getByRole("button", { name: "Mostrar herramientas" }).click();
  const altoExpandido = await frame
    .locator("#editor")
    .evaluate((n) => n.clientHeight);
  await frame.getByRole("button", { name: "Contraer barra" }).click();
  await expect(paneles).toBeHidden();
  await expect
    .poll(() => frame.locator("#editor").evaluate((n) => n.clientHeight))
    .toBeGreaterThan(altoExpandido + 60);
  await frame.getByRole("tab", { name: "Datos", exact: true }).click();
  await expect(paneles).toBeVisible();
  await frame.getByRole("tab", { name: "Inicio", exact: true }).click();
  expect(
    await child.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await child.evaluate(() => {
    const wb = window.pruebaEditor.api().getActiveWorkbook();
    wb.getSheetByName("enero").getRange("E5").setValue(1500);
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
  expect(libro.getWorksheet("enero").getCell("E5").value).toBe(1500);
  expect(libro.worksheets[0].name).toBe("Acumulado 2027");
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  await expect(frame.locator("#estado")).toContainText("Libro abierto", {
    timeout: 30000,
  });
  await expect(paneles).toBeHidden();
  await frame.getByRole("button", { name: "Mostrar herramientas" }).click();
  const nuevo = page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"));
  expect(
    await nuevo.evaluate(() => {
      const snap = window.pruebaEditor.snapshot();
      const hoja = Object.values(snap.sheets).find((h) => h.name === "enero");
      return hoja.cellData[4][4].v;
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
      .getRange("E5")
      .setValue(1900),
  );
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("versión más reciente");
  expect(
    await nuevo.evaluate(() => {
      const snap = window.pruebaEditor.snapshot();
      return Object.values(snap.sheets).find((h) => h.name === "enero")
        .cellData[4][4].v;
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

test("recupera el orden original de un libro anterior conservando ediciones y referencias", async ({
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
  let child = page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"));
  await child.evaluate(() => {
    const libro = window.pruebaEditor.api().getActiveWorkbook();
    const hoja = libro.getSheetByName("enero");
    libro.setActiveSheet(hoja);
    libro.getSheetByName("Acumulado 2027").getRange("D8").setValue("=enero!E5");
    hoja.getRange("E5").setValue(1500);
    hoja.getRange("A1:X2").breakApart();
    hoja.getRange("E1").setValue("Nota manual de prueba");
    const anterior = [
      1, 2, 5, 12, 17, 19, 20, 21, 22, 23, 24, 6, 7, 8, 9, 10, 11, 13, 14, 15,
      16, 18, 3, 4,
    ];
    const actual = Array.from({ length: 24 }, (_, i) => i + 1);
    anterior.forEach((col, destino) => {
      const origen = actual.indexOf(col);
      if (origen !== destino) {
        hoja.moveColumns(
          hoja.getRange(0, origen, hoja.getMaxRows(), 1),
          destino,
        );
        actual.splice(destino, 0, ...actual.splice(origen, 1));
      }
    });
    hoja.getRange("C3").setValue("SUELDO DEL PERIODO");
    hoja.getRange("D3").setValue("TOTAL PERCEPCIONES");
    hoja.getRange("F3").setValue("IMSS (DEDUCCIÓN)");
  });
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("Versión 2 guardada");
  await page
    .getByRole("button", { name: "Cerrar editor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar Excel mensual", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Abre el editor de nómina",
  );
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  await expect(frame.locator("#estado")).toContainText(
    "Orden del archivo original aplicado",
    { timeout: 30000 },
  );
  child = page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"));
  const datos = await child.evaluate(() => {
    const hoja = window.pruebaEditor
      .api()
      .getActiveWorkbook()
      .getSheetByName("enero");
    return {
      cabecera: hoja.getRange("A3:X3").getValues()[0],
      sueldo:
        window.pruebaEditor.snapshot().sheets[hoja.getSheetId()].cellData[4][4]
          .v,
      formula: hoja.getRange("X5").getFormula(),
      nota: hoja.getRange("E1").getValue(),
    };
  });
  expect(datos.cabecera.slice(0, 5)).toEqual([
    "NOMBRE",
    "PERIODO",
    "IMSS",
    "R.F.C.",
    "SUELDO",
  ]);
  expect(datos.cabecera[23]).toBe("NETO");
  expect(datos.sueldo).toBe(1500);
  expect(datos.formula).toBe("=L5-S5");
  expect(datos.nota).toBe("Nota manual de prueba");
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("Versión 3 guardada");
  await page
    .getByRole("button", { name: "Cerrar editor", exact: true })
    .click();
  const descarga = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar Excel mensual", exact: true })
    .click();
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await readFile(await (await descarga).path()));
  expect(libro.getWorksheet("enero").getCell("E5").value).toBe(1500);
  expect(libro.getWorksheet("enero").getCell("X5").formula).toBe("L5-S5");
  expect(libro.getWorksheet("enero").getCell("X5").result).toBe(1490);
  expect(libro.getWorksheet("Acumulado 2027").getCell("D8").formula).toMatch(
    /!?E5$/,
  );
});

test("incorpora PDF posteriores al Excel en mensual y anual sin perder ediciones ni duplicar periodos", async ({
  page,
}) => {
  test.setTimeout(120000);
  await iniciar(page);
  const bytes = await excelSintetico(companyNames.ESTUARDO);
  const original = new ExcelJS.Workbook();
  await original.xlsx.load(bytes);
  const resumen = original.getWorksheet("ACUMULADO 2027");
  resumen.getCell("C4").value = "SUELDO";
  resumen.getCell("D4").value = "TOTAL";
  resumen.getCell("E4").value = "EXENTO";
  resumen.getCell("E5").value = 7;
  await page.getByLabel("Seleccionar Excel acumulado de nómina").setInputFiles({
    name: "sintetico.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await original.xlsx.writeBuffer()),
  });
  await page
    .getByRole("button", { name: "Guardar nómina identificada" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Nómina importada y guardada",
  );
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Hoja de cálculo de nómina"]');
  await expect(frame.locator("#estado")).toContainText("Libro abierto", {
    timeout: 30000,
  });
  await page
    .frames()
    .find((f) => f.url().includes("editor-nomina/index.html"))
    .evaluate(() =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheetByName("enero")
        .getRange("E5")
        .setValue(1700),
    );
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("Versión 2 guardada");
  await page
    .getByRole("button", { name: "Cerrar editor", exact: true })
    .click();
  for (const [desde, hasta] of [
    ["01/Oct/2027", "15/Oct/2027"],
    ["16/Oct/2027", "31/Oct/2027"],
  ]) {
    await page
      .getByLabel("Seleccionar PDF de nómina", { exact: true })
      .setInputFiles({
        name: "nomina.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(
          pdfNominaEjemplo({
            empresa: "ESTUARDO",
            nombre: "PERSONA UNO",
            desde,
            hasta,
          }),
        ),
      });
    await expect(page.getByRole("status")).toContainText("Nómina guardada");
  }
  for (const tipo of ["mensual", "anual"]) {
    await page
      .getByRole("button", { name: `Generar ${tipo}`, exact: false })
      .first()
      .click();
    await page
      .getByRole("button", { name: `Descargar Excel ${tipo}`, exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Hay PDF nuevos");
    if (tipo === "anual") {
      const archivos = page.locator(".payroll-files");
      if ((await archivos.getAttribute("open")) === null)
        await archivos.locator("summary").first().click();
      await archivos
        .locator(":scope > p")
        .filter({ hasText: "anual" })
        .getByRole("button", { name: "Abrir libro", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Abrir editor de nómina", exact: true })
        .click();
    }
    await expect(frame.locator("#estado")).toContainText("PDF incorporados", {
      timeout: 30000,
    });
    await frame.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(frame.locator("#estado")).toContainText("guardada");
    await page
      .getByRole("button", { name: "Cerrar editor", exact: true })
      .click();
    const descarga = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Descargar Excel ${tipo}`, exact: true })
      .click();
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await readFile(await (await descarga).path()));
    const h = libro.getWorksheet(
      tipo === "mensual" ? "octubre" : "Persona uno",
    );
    expect(h).toBeTruthy();
    const filas = [];
    h.eachRow((r) => {
      if (String(r.getCell(2).value).startsWith("OCT")) filas.push(r);
    });
    expect(filas).toHaveLength(2);
    expect(filas.map((r) => r.getCell(5).value)).toEqual([5250, 5250]);
    expect(filas.map((r) => r.getCell(24).value)).toEqual([5030.1, 5030.1]);
    if (tipo === "mensual")
      expect(libro.getWorksheet("enero").getCell("E5").value).toBe(1700);
    const acum = libro.worksheets[0];
    let octubre;
    acum.eachRow((r) => {
      if (String(r.getCell(2).value).toLowerCase() === "octubre") octubre = r;
    });
    expect(octubre.getCell(3).result).toBe(10500);
    expect(acum.getCell("E5").value).toBe(7);
    await page
      .getByRole("button", { name: "Abrir editor de nómina", exact: true })
      .click();
    await expect(frame.locator("#estado")).toContainText("Libro abierto", {
      timeout: 30000,
    });
    await expect(frame.locator("#estado")).not.toContainText(
      "PDF incorporados",
    );
    await page
      .getByRole("button", { name: "Cerrar editor", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Modificar un mes", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Volver a subir archivo", exact: true })
    .check();
  await page
    .getByLabel("Seleccionar PDF corregido", { exact: true })
    .setInputFiles({
      name: "corregido.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        pdfNominaEjemplo({
          empresa: "ESTUARDO",
          nombre: "PERSONA UNO",
          desde: "01/Oct/2027",
          hasta: "15/Oct/2027",
          importe: 550000,
        }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("Nómina corregida");
  await page
    .getByRole("button", { name: "Generar mensual", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Abrir editor de nómina", exact: true })
    .click();
  await expect(frame.locator("#estado")).toContainText("PDF incorporados", {
    timeout: 30000,
  });
  await frame.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(frame.locator("#estado")).toContainText("guardada");
  await page
    .getByRole("button", { name: "Cerrar editor", exact: true })
    .click();
  const corregida = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar Excel mensual", exact: true })
    .click();
  const libroCorregido = new ExcelJS.Workbook();
  await libroCorregido.xlsx.load(
    await readFile(await (await corregida).path()),
  );
  const importes = [];
  libroCorregido.getWorksheet("octubre").eachRow((r) => {
    if (String(r.getCell(2).value).startsWith("OCT"))
      importes.push(r.getCell(5).value);
  });
  expect(importes).toEqual([5500, 5250]);
  let resumenCorregido;
  libroCorregido.worksheets[0].eachRow((r) => {
    if (String(r.getCell(2).value).toLowerCase() === "octubre")
      resumenCorregido = r;
  });
  expect(resumenCorregido.getCell(3).result).toBe(10750);
  expect(libroCorregido.getWorksheet("enero").getCell("E5").value).toBe(1700);
  await page
    .getByRole("button", { name: "Generar anual", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Descargar Excel anual", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Hay PDF nuevos");
});
