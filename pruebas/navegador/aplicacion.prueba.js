import { test, expect } from "@playwright/test";
async function access(page) {
  await expect(
    page.getByRole("heading", {
      name: /Configurar acceso de María|Acceso de María/,
    }),
  ).toBeVisible();
  if (
    await page
      .getByRole("heading", { name: "Configurar acceso de María" })
      .isVisible()
  ) {
    await page.getByLabel("Crear contraseña", { exact: true }).fill("Clave6");
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill("Clave6");
    await page
      .getByRole("button", { name: "Crear acceso y abrir panel" })
      .click();
  } else {
    await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  }
  await expect(page.getByRole("navigation")).toBeVisible();
  await nav(page, "Inicio").click();
  await expect(
    page.getByRole("heading", { name: "Panel principal" }),
  ).toBeVisible();
}
async function credential(page, id) {
  await nav(page, "Seguridad").click();
  await page.getByLabel("Empleado", { exact: true }).selectOption(id);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Trab06");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("Trab06");
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByRole("status")).toContainText("Acceso actualizado");
}
const nav = (page, name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true });
test("flujo de personal, asistencia, incidencia y persistencia", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await access(page);
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
  await expect(page.locator("tbody").last()).toContainText("RP-0001");
  await page.getByRole("button", { name: "Modificar", exact: true }).click();
  await page.getByLabel("CURP", { exact: true }).fill("CURPPRUEBA");
  await page
    .getByRole("button", { name: "Guardar empleado", exact: true })
    .click();
  await credential(page, "RP-0001");
  await nav(page, "Asistencia 1 · Trabajador").click();
  await page.getByLabel("ID de empleado", { exact: true }).fill("RP-0001");
  await page.getByLabel("Contraseña", { exact: true }).fill("Trab06");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "¡Bienvenido a Rey Pez, PERSONA PRUEBA REACT!",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salir de pantalla de trabajador" })
    .click();
  await nav(page, "Asistencia 2 · Administración").click();
  await expect(page.locator("tbody").last()).toContainText(
    "PERSONA PRUEBA REACT",
  );
  await expect(
    page.getByRole("heading", {
      name: "Registrar / justificar una incidencia",
    }),
  ).toHaveCount(0);
  await expect(page.locator(".company-incidents")).toHaveCount(3);
  await page.reload();
  await access(page);
  await expect(page.locator(".kvalue").nth(1)).toHaveText("31");
  await nav(page, "Asistencia 2 · Administración").click();
  await nav(page, "Personal").click();
  await page.getByLabel("Buscar personal").fill("PERSONA PRUEBA REACT");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Dar de baja", exact: true }).click();
  await expect(page.locator("tbody .status")).toHaveText("Baja");
  await nav(page, "Asistencia 1 · Trabajador").click();
  await page.getByLabel("ID de empleado", { exact: true }).fill("RP-0001");
  await page.getByLabel("Contraseña", { exact: true }).fill("Trab06");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "no está activa",
  );
  expect(errors).toEqual([]);
});
test("configuración, CSV, respaldo y seguridad local", async ({ page }) => {
  await page.goto("/");
  await access(page);
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
  await expect(page.locator("tbody").last()).not.toContainText(
    "Horario actualizado",
  );
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
  await expect(page.locator("tbody").last()).toContainText("RP-0001");
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
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("prueba123");
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("prueba123");
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByRole("status")).toContainText("Acceso actualizado");
  expect(
    await page.evaluate(() => localStorage.getItem("reypez_react_v1")),
  ).not.toContain("prueba123");
});
test("todas las pantallas adaptan su ancho al dispositivo", async ({
  page,
}) => {
  await page.goto("/");
  await access(page);
  for (const name of [
    "Inicio",
    "Personal",
    "Asistencia 2 · Administración",
    "Bitácoras de salud",
    "Bitácora de EPP",
    "Normas de la Secretaría del Trabajo",
    "Mantenimiento y compras",
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

test("temperaturas, mantenimiento, QR, permisos y terminal aislada", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await access(page);
  await nav(page, "Bitácoras de salud").click();
  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await page.getByLabel("Cuarto frío", { exact: true }).selectOption("ALLAN-1");
  await page.getByLabel("Temperatura (°C)").fill("-19");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.locator("tbody").last()).toContainText("Requiere atención");
  await nav(page, "Mantenimiento y compras").click();
  await page.getByLabel("Cuarto frío", { exact: true }).selectOption("ALLAN-1");
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Revisión de compresor de prueba");
  await page.getByLabel("Costo MXN (opcional)").fill("250");
  await page.getByRole("button", { name: "Guardar actividad" }).click();
  await expect(page.locator("tbody").last()).toContainText("250.00");
  await credential(page, "ES-06");
  await page.getByLabel("Temperaturas", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar permisos" }).click();
  await expect(page.getByRole("status")).toContainText("Permisos guardados");
  await nav(page, "Configuración").click();
  await page.getByLabel("Área para QR").selectOption("ESTUARDO-1");
  await expect(page.getByAltText("QR de captura del área")).toBeVisible();
  await page.getByLabel("Nombre del equipo").fill("Entrada de prueba");
  await page.getByRole("button", { name: "Vincular este navegador" }).click();
  await expect(page.getByRole("status")).toContainText("vinculado");
  const terminal = await context.newPage();
  await terminal.goto("/#asistencia");
  await expect(terminal.getByRole("dialog")).toBeVisible();
  await expect(terminal.getByRole("navigation")).toHaveCount(0);
  await terminal.keyboard.press("Escape");
  await expect(terminal.getByRole("dialog")).toBeVisible();
  await terminal.close();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/#captura?area=ESTUARDO-1");
  await page.getByLabel("ID", { exact: true }).fill("ES-06");
  await page.getByLabel("Contraseña", { exact: true }).fill("Trab06");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Captura operativa autorizada" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator(".folder-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await expect(page.getByLabel("Cuarto frío", { exact: true })).toBeDisabled();
  await page.goto("/#captura?area=ALLAN-1");
  await expect(
    page.getByText(
      "María debe autorizar las bitácoras de tu perfil para esta empresa.",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("respaldo completo, restauración e invalidación de sesión", async ({
  page,
}) => {
  await page.goto("/");
  await access(page);
  await nav(page, "Reportes y CSV").click();
  const json = await page.evaluate(() =>
    localStorage.getItem("reypez_react_v1"),
  );
  await page.getByLabel("Restaurar respaldo JSON").setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"employees":[]}'),
  });
  await expect(page.getByRole("alert")).toContainText("formato válido");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("Restaurar respaldo JSON").setInputFiles({
    name: "respaldo.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect(
    page.getByRole("heading", { name: "Acceso de María" }),
  ).toBeVisible();
  await access(page);
  await expect(page.locator(".kvalue").nth(1)).toHaveText("30");
});

test("tres carpetas independientes y temperaturas sin duplicación", async ({
  page,
}) => {
  await page.goto("/");
  await access(page);
  await expect(nav(page, "Cuartos fríos")).toHaveCount(0);
  await nav(page, "Bitácoras de salud").click();
  await expect(
    page.getByRole("button", { name: /^Temperaturas · cuartos fríos/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^Certificados de salud/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Sanitarios administrativos/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Limpieza y jabón · embolsado/ }),
  ).toBeVisible();
  await nav(page, "Bitácora de EPP").click();
  await page.getByLabel("Empresa de carpeta").selectOption("EDGAR");
  await expect(page.getByRole("button", { name: /^El Galileo/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^María Guadalupe/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cloro/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Oficina/ }).click();
  await expect(page.getByLabel("Área", { exact: true })).toHaveValue(
    "EDGAR-Oficina",
  );
  await nav(page, "Normas de la Secretaría del Trabajo").click();
  for (const c of ["ALLAN", "EDGAR", "ESTUARDO"]) {
    await page.getByLabel("Empresa de carpeta").selectOption(c);
    await expect(
      page.getByRole("heading", { name: `Carpeta de ${c}` }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Carpeta vacía, pendiente de definir sus normas y documentos.",
      ),
    ).toBeVisible();
  }
  const images = await page
    .locator("header img")
    .evaluateAll((imgs) => imgs.map((i) => i.src));
  expect(images.every((src) => src.endsWith("/logo-rey-pez.png"))).toBe(true);
});

test("Edgar tiene un cuarto frío dentro de Salud", async ({ page }) => {
  await page.goto("/");
  await access(page);
  await nav(page, "Bitácoras de salud").click();
  await page.getByLabel("Empresa de carpeta").selectOption("EDGAR");
  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await expect(
    page.getByLabel("Cuarto frío", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page.getByLabel("Cuarto frío", { exact: true }).selectOption("EDGAR-1");
  await page.getByLabel("Temperatura (°C)").fill("-26");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.locator("tbody").last()).toContainText("Óptimo");
});

test("EPP fijo, cloro aislado y PDF por fechas", async ({ page }) => {
  // Las ausencias solo aparecen en día laborable, después de la tolerancia.
  await page.clock.install({ time: new Date("2026-10-14T16:00:00-06:00") });
  await page.goto("/");
  await access(page);
  await nav(page, "Bitácora de EPP").click();
  await page
    .getByRole("button", { name: "Proceso / carga y descarga", exact: true })
    .click();
  await page.getByLabel("Empleado revisado").selectOption("AL-01");
  await page.getByLabel("Fecha y hora de revisión").fill("2026-10-14T10:00");
  const radios = page.getByRole("radio", { name: /: Cumplió$/ });
  await expect(radios).toHaveCount(4);
  for (const r of await radios.all()) await r.check();
  await page
    .getByRole("radio", {
      name: "Botas de plástico antiderrapantes: No cumplió",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(page.locator("tbody").last()).not.toContainText("No cumplió");
  await page
    .getByLabel("Por qué no cumplió: Botas de plástico antiderrapantes")
    .fill("Botas dañadas de prueba");
  await page
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(page.locator("tbody").last()).toContainText("No cumplió");
  await page.getByLabel("Desde", { exact: true }).fill("2026-10-14");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-14");
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  const download = await wait;
  await download.saveAs(
    test.info().outputPath(`reporte-epp-${test.info().project.name}.pdf`),
  );
  await nav(page, "Bitácoras de salud").click();
  const icons = await page
    .locator(".folder-card svg")
    .evaluateAll((elements) => elements.map((e) => e.innerHTML));
  expect(new Set(icons).size).toBeGreaterThan(5);
  await page.getByRole("button", { name: "Cloro", exact: true }).click();
  await expect(
    page.getByLabel("Lugar / área", { exact: true }).locator("option"),
  ).toHaveText(["Selecciona…", "Embolsado", "Descarga"]);
  await expect(page.getByLabel("Revisión programada (opcional)")).toHaveCount(
    0,
  );
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page
    .getByLabel("Lugar / área", { exact: true })
    .selectOption("ALLAN-Embolsado");
  await page
    .getByLabel("Valores de cloro en agua", { exact: true })
    .fill("10 ml / 100 L");
  await page
    .getByLabel("Realizó", { exact: true })
    .fill("Responsable de prueba");
  await page
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(page.locator("tbody").last()).toContainText("10 ml / 100 L");
  await page.getByLabel("Desde", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2030-12-31");
  const waitCloro = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await (
    await waitCloro
  ).saveAs(
    test.info().outputPath(`reporte-cloro-${test.info().project.name}.pdf`),
  );
  await nav(page, "Asistencia 2 · Administración").click();
  await expect(page.locator(".company-incidents")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Guardar revisión administrativa" }),
  ).toHaveCount(0);
  await page.getByLabel("Empresa de asistencia").selectOption("EDGAR");
  const group = page
    .locator(".company-incidents")
    .filter({ has: page.locator("summary", { hasText: /^EDGAR/ }) });
  if ((await group.getAttribute("open")) === null)
    await group.locator("summary").click();
  await group.locator("select").first().selectOption("Permiso");
  await group
    .getByRole("textbox")
    .first()
    .fill("Permiso de ausencia de prueba");
  await group
    .getByRole("button", { name: "Guardar revisión de ausencia", exact: true })
    .first()
    .click();
  await expect(page.locator("tbody").first()).toContainText(
    "Permiso de ausencia de prueba",
  );
  const waitAttendance = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await (
    await waitAttendance
  ).saveAs(
    test
      .info()
      .outputPath(`reporte-asistencia-${test.info().project.name}.pdf`),
  );
});
