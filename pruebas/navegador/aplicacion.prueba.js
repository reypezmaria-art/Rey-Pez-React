import { test, expect } from "@playwright/test";
const nav = (page, name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true });
test("flujo de personal, asistencia, incidencia y persistencia", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Panel principal" }),
  ).toBeVisible();
  await expect(page.locator(".kvalue").nth(1)).toHaveText("30");
  await nav(page, "Personal").click();
  await page.getByRole("button", { name: "+ Agregar empleado" }).click();
  await page.getByLabel("Nombre completo *").fill("PERSONA PRUEBA REACT");
  await page.getByLabel("Puesto / función *").fill("EMPLEADO GENERAL");
  await page
    .getByRole("button", { name: "Guardar empleado", exact: true })
    .click();
  await page.getByLabel("Buscar personal").fill("PERSONA PRUEBA REACT");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("RP-0001");
  await page.getByRole("button", { name: "Modificar", exact: true }).click();
  await page.getByLabel("CURP", { exact: true }).fill("CURPPRUEBA");
  await page
    .getByRole("button", { name: "Guardar empleado", exact: true })
    .click();
  await nav(page, "Asistencia 1 · Trabajador").click();
  await page.getByLabel("ID de empleado", { exact: true }).fill("RP-0001");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.getByRole("heading", {
      name: "¡Bienvenido a Rey Pez, PERSONA PRUEBA REACT!",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salir de pantalla de trabajador" })
    .click();
  await nav(page, "Asistencia 2 · Administración").click();
  await expect(page.locator("tbody")).toContainText("PERSONA PRUEBA REACT");
  await page.getByLabel("Empleado", { exact: true }).selectOption("RP-0001");
  await page
    .getByLabel("Fecha y hora", { exact: true })
    .fill("2026-10-10T11:00");
  await page.getByLabel("Revisó").fill("Administración de prueba");
  await page
    .getByLabel("Motivo / evidencia / autorización")
    .fill("Permiso de prueba");
  await page
    .getByRole("button", { name: "Guardar revisión administrativa" })
    .click();
  await expect(page.locator("tbody")).toContainText("Permiso de prueba");
  await page.reload();
  await expect(page.locator(".kvalue").nth(1)).toHaveText("31");
  await expect(page.locator(".kvalue").nth(3)).toHaveText("2");
  await nav(page, "Personal").click();
  await page.getByLabel("Buscar personal").fill("PERSONA PRUEBA REACT");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Dar de baja", exact: true }).click();
  await expect(page.locator("tbody .status")).toHaveText("Baja");
  await nav(page, "Asistencia 1 · Trabajador").click();
  await page.getByLabel("ID de empleado", { exact: true }).fill("RP-0001");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "no está activa",
  );
  expect(errors).toEqual([]);
});
test("configuración, CSV, respaldo y seguridad de demostración", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Configuración").click();
  await page.getByRole("button", { name: "+ Agregar horario" }).click();
  await page.getByLabel("Código *", { exact: true }).fill("TEST");
  await page.getByLabel("Nombre del horario *").fill("Horario de prueba");
  await page.getByLabel("Entrada", { exact: true }).fill("08:00");
  await page.getByLabel("Salida de turno", { exact: true }).fill("16:00");
  await page
    .getByRole("button", { name: "Guardar horario", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: "Horario de prueba" });
  await expect(row).toContainText("08:00–16:00");
  await row.getByRole("button", { name: "Modificar" }).click();
  await page.getByLabel("Nombre del horario *").fill("Horario actualizado");
  await page
    .getByRole("button", { name: "Guardar horario", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row")
    .filter({ hasText: "Horario actualizado" })
    .getByRole("button", { name: "Eliminar" })
    .click();
  await expect(page.locator("tbody")).not.toContainText("Horario actualizado");
  await nav(page, "Personal").click();
  await page.getByLabel("Importar CSV", { exact: true }).setInputFiles({
    name: "personal.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFFnombre_completo,empresa_codigo,puesto\nPERSONA CSV,ALLAN,GENERAL",
    ),
  });
  await expect(page.getByRole("status")).toContainText("1 filas procesadas");
  await page.getByRole("button", { name: "Asignar ID faltantes" }).click();
  await page.getByLabel("Buscar personal").fill("PERSONA CSV");
  await expect(page.locator("tbody")).toContainText("RP-0001");
  await nav(page, "Reportes y CSV").click();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar personal CSV" }).click();
  expect((await csvPromise).suggestedFilename()).toBe("empleados_rey_pez.csv");
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo JSON" }).click();
  expect((await backupPromise).suggestedFilename()).toBe(
    "respaldo_rey_pez.json",
  );
  await nav(page, "Seguridad").click();
  await page.getByLabel("Empleado", { exact: true }).selectOption("AL-01");
  await page
    .getByLabel("Nueva contraseña temporal (solo maqueta)")
    .fill("prueba123");
  await page.getByLabel("Confirmar contraseña").fill("prueba123");
  await page
    .getByRole("button", { name: "Guardar solicitud (demostración)" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No se guardó contraseña ni se cambió el acceso",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("reypez_react_v1")),
  ).not.toContain("prueba123");
});
test("todas las pantallas adaptan su ancho al dispositivo", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Inicio",
    "Personal",
    "Asistencia 2 · Administración",
    "Bitácoras",
    "Reportes y CSV",
    "Configuración",
    "Seguridad",
  ]) {
    await nav(page, name).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await nav(page, "Asistencia 1 · Trabajador").click();
  expect(
    await page
      .locator("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: `resultados-pruebas/registro-${test.info().project.name}.png`,
    fullPage: true,
  });
});
