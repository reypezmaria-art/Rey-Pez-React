/* global window, document, console */
import assert from "node:assert/strict";

export async function probarCinta(page) {
  const tab = (nombre) =>
    page
      .locator("#cinta")
      .getByRole("tab", { name: nombre, exact: true })
      .click();
  const button = (nombre) =>
    page
      .locator("#cinta")
      .getByRole("button", { name: nombre, exact: true })
      .click();
  const dialog = page.locator("#dialogo-cinta");
  const select = async (nombre, ref) =>
    page.evaluate(
      ([n, r]) => {
        const h = window.pruebaEditor
          .api()
          .getActiveWorkbook()
          .getSheetByName(n);
        h.activate();
        h.getRange(r).activate();
      },
      [nombre, ref],
    );
  assert.deepEqual(
    await page.locator("#cinta").getByRole("tab").allTextContents(),
    [
      "Inicio",
      "Insertar",
      "Disposición de página",
      "Fórmulas",
      "Datos",
      "Revisar",
      "Vista",
      "Ayuda",
    ],
  );
  for (const nombre of [
    "Portapapeles",
    "Fuente",
    "Alineación",
    "Número",
    "Estilos",
    "Celdas",
    "Edición",
  ])
    assert.equal(
      await page.locator(`#cinta section[data-grupo="${nombre}"]`).isVisible(),
      true,
    );
  await select("Enero", "B3");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:5191",
  });
  await select("Enero", "A3");
  await button("Copiar");
  await select("Enero", "G3");
  await button("Pegar");
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("G3")
        .getRawValue() === "Persona demo uno",
  );
  await select("Enero", "B3");
  await button("Negrita");
  assert.equal(
    await page.evaluate(
      () =>
        window.pruebaEditor
          .api()
          .getActiveWorkbook()
          .getActiveSheet()
          .getRange("B3")
          .getCellStyleData().bl,
    ),
    1,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Negrita", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByLabel("Formato de número", { exact: true })
    .selectOption("0.00%");
  assert.equal(
    await page.evaluate(() =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("B3")
        .getNumberFormat(),
    ),
    "0.00%",
  );
  await select("Enero", "A3:B3");
  await button("Combinar y centrar");
  assert.match(await page.locator("#estado").textContent(), /varios valores/);
  assert.equal(
    await page.evaluate(() =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("B3")
        .getRawValue(),
    ),
    10000,
  );
  console.log(
    "PASS: cinta Inicio aplica formato y evita perder valores al combinar",
  );
  await select("Enero", "F3");
  await tab("Fórmulas");
  await button("Autosuma");
  await dialog.getByLabel("Rango de origen", { exact: true }).fill("B3:B4");
  await dialog.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("F3")
        .getRawValue() === 22000,
  );
  console.log(
    "PASS: biblioteca de funciones inserta y calcula SUMA sobre el rango elegido",
  );
  await tab("Datos");
  await button("Buscar");
  await dialog
    .getByLabel("Texto o número", { exact: true })
    .fill("Persona demo dos");
  await dialog.getByRole("button", { name: "Buscar", exact: true }).click();
  await dialog.locator(".resultado-cinta").first().click();
  assert.equal(
    await page.evaluate(() =>
      window.pruebaEditor.api().getActiveWorkbook().getActiveRange().getRow(),
    ),
    3,
  );
  await tab("Insertar");
  await button("Nueva hoja");
  await page.evaluate(() => {
    const h = window.pruebaEditor.api().getActiveWorkbook().getActiveSheet();
    h.getRange("A1:B3").setValues([
      ["Nombre", "Importe"],
      ["Zeta demo", 2],
      ["Alfa demo", 1],
    ]);
    h.getRange("A1:B3").activate();
  });
  await tab("Datos");
  await button("Ordenar A a Z");
  await dialog.getByRole("button", { name: "Ordenar", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("A2")
        .getRawValue() === "Alfa demo",
  );
  assert.deepEqual(
    await page.evaluate(() =>
      window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getActiveSheet()
        .getRange("A2:B3")
        .getRawValues(),
    ),
    [
      ["Alfa demo", 1],
      ["Zeta demo", 2],
    ],
  );
  await button("Filtro");
  assert.equal(
    await page.evaluate(
      () =>
        !!window.pruebaEditor
          .api()
          .getActiveWorkbook()
          .getActiveSheet()
          .getFilter(),
    ),
    true,
  );
  console.log(
    "PASS: búsqueda, creación de hoja, ordenación de filas relacionadas y filtro",
  );
  await page
    .getByLabel("Buscar una herramienta", { exact: true })
    .fill("inmovilizar fila");
  await page.locator(".resultados-herramientas button").first().click();
  assert.equal(
    await page
      .getByRole("tab", { name: "Vista", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await button("Inmovilizar fila superior");
  assert.equal(
    await page.evaluate(
      () =>
        window.pruebaEditor
          .api()
          .getActiveWorkbook()
          .getActiveSheet()
          .getFreeze().ySplit,
    ),
    1,
  );
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("1.25");
  assert.equal(
    await page.evaluate(() =>
      window.pruebaEditor.api().getActiveWorkbook().getActiveSheet().getZoom(),
    ),
    1.25,
  );
  console.log(
    "PASS: buscador localiza la herramienta; Vista inmoviliza y cambia zoom",
  );
  await tab("Disposición de página");
  await button("Márgenes y orientación");
  await dialog
    .getByLabel("Tamaño de papel", { exact: true })
    .selectOption("A4");
  await dialog
    .getByLabel("Orientación", { exact: true })
    .selectOption("landscape");
  await dialog.getByRole("button", { name: "Aplicar", exact: true }).click();
  await button("Vista de impresión");
  const print = dialog.frameLocator("iframe");
  await print.locator("table").waitFor();
  assert.equal(await print.locator("td").count(), 6);
  assert.match(await print.locator("style").textContent(), /A4 landscape/);
  assert.match(await print.locator("body").textContent(), /Alfa demo/);
  await page.locator("#cerrar-dialogo").click();
  await page.locator("#guardar").click();
  await page.waitForFunction(() =>
    document.getElementById("estado").textContent.startsWith("Prueba guardada"),
  );
  await tab("Revisar");
  await button("Historial de versiones");
  await dialog.locator(".resultado-cinta").first().click();
  await page.waitForFunction(
    () =>
      !!window.pruebaEditor
        .api()
        .getActiveWorkbook()
        .getSheets()
        .find((h) => h.getFilter()),
  );
  console.log(
    "PASS: vista imprimible y recuperación de una versión con filtro",
  );
  await tab("Ayuda");
  await button("Cómo trabajar");
  assert.match(await dialog.textContent(), /Todavía no guarda en Firebase/);
  await page.keyboard.press("Escape");
  // Dejar intacto el escenario inicial para el recorrido de importación/exportación.
  await page.reload();
  await page.waitForFunction(() => window.pruebaEditor);
}
