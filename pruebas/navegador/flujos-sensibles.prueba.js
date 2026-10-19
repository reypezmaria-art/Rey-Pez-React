import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// El catálogo público no publica a Brenda. ES-01 es la trabajadora de
// demostración de Estuardo y cubre la misma regla: solo su empresa y las
// bitácoras que María autorice.
const TRABAJADORA_ESTUARDO = "ES-01";
const NOMBRE_ESTUARDO = "EMPLEADO DEMO ESTUARDO 1";
const CLAVE_ADMIN = "Clave6";
const CLAVE_TRABAJO = "Trab06";
const NOTA_PDF = "NOTA-PDF-1410";

// Mantener estos recorridos en el catálogo ficticio aunque exista un catálogo privado local.
test.beforeEach(async ({ page }) => {
  await page.route("**/__local/empleados", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
});

const navegacion = (page, name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true });

function vigilarErrores(page) {
  const errores = [];
  page.on("pageerror", (error) => errores.push(error.message));
  return errores;
}

async function prepararAdministracion(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Configurar acceso de María|Bienvenido a Rey Pez/,
    }),
  ).toBeVisible();
  if (
    await page
      .getByRole("heading", { name: "Configurar acceso de María" })
      .isVisible()
  ) {
    await page
      .getByLabel("Crear contraseña", { exact: true })
      .fill(CLAVE_ADMIN);
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill(CLAVE_ADMIN);
    await page
      .getByRole("button", { name: "Crear acceso y abrir panel" })
      .click();
  } else {
    await ingresarComoAdmin(page);
    return;
  }
  await expect(page.getByRole("navigation")).toBeVisible();
}

async function ingresarComoAdmin(page) {
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE_ADMIN);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
}

async function intentarIngreso(page, id, clave) {
  if (!new URL(page.url()).hash.startsWith("#captura"))
    await page.goto("/#captura");
  await page.getByLabel("ID", { exact: true }).fill(id);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

async function cerrarSesion(page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/#administracion");
  await expect(
    page.getByRole("heading", { name: "Bienvenido a Rey Pez", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".access-screen .small")).toHaveCount(0);
  await expect(
    page.getByText(
      /se guardan en Firebase|sesión se cierra al recargar|Copia local de revisión|Firebase Authentication/,
    ),
  ).toHaveCount(0);
}

async function asignarClave(page, id) {
  await navegacion(page, "Seguridad").click();
  await page.getByLabel("Empleado", { exact: true }).selectOption(id);
  await page.getByLabel("Acción", { exact: true }).selectOption("set");
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill(CLAVE_TRABAJO);
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill(CLAVE_TRABAJO);
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByRole("status")).toContainText("Acceso actualizado");
}

async function agregarEmpleado(page, nombre) {
  await navegacion(page, "Personal").click();
  await page.getByRole("button", { name: "+ Agregar empleado" }).click();
  await page.getByLabel("Nombre completo *").fill(nombre);
  await page.getByLabel("Puesto / función *").fill("EMPLEADO GENERAL");
  await page
    .getByRole("button", { name: "Guardar empleado", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Empleado guardado");
}

async function bytesDescarga(download) {
  const ruta = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(ruta);
  return readFile(ruta);
}

function textoPdf(buffer) {
  const crudo = buffer.toString("latin1");
  const partes = [crudo];
  for (const coincidencia of crudo.matchAll(
    /stream\r?\n([\s\S]*?)endstream/g,
  )) {
    const datos = Buffer.from(coincidencia[1], "latin1");
    try {
      partes.push(inflateSync(datos).toString("latin1"));
    } catch {
      /* Los flujos sin comprimir ya están en el texto crudo. */
    }
  }
  return partes.join("\n");
}

test("rechaza ingresos fallidos y respeta el bloqueo manual del acceso", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errores = vigilarErrores(page);
  await prepararAdministracion(page);
  await asignarClave(page, TRABAJADORA_ESTUARDO);
  expect(
    await page.evaluate(() => localStorage.getItem("reypez_react_v1")),
  ).not.toContain(CLAVE_TRABAJO);
  await cerrarSesion(page);

  for (let intento = 0; intento < 3; intento += 1) {
    await intentarIngreso(page, TRABAJADORA_ESTUARDO, "clave-mala");
    await expect(page.getByRole("alert")).toHaveText(
      "ID o contraseña incorrectos.",
    );
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Ingresar", exact: true }),
    ).toBeEnabled();
  }
  await intentarIngreso(page, "NO-EXISTE", CLAVE_TRABAJO);
  await expect(page.getByRole("alert")).toHaveText(
    "ID o contraseña incorrectos.",
  );

  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await ingresarComoAdmin(page);

  await navegacion(page, "Seguridad").click();
  await page
    .getByLabel("Empleado", { exact: true })
    .selectOption(TRABAJADORA_ESTUARDO);
  await page.getByLabel("Acción", { exact: true }).selectOption("block");
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByRole("status")).toContainText("Acceso actualizado");
  await expect(page.getByText("Estado: Bloqueado")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bienvenido a Rey Pez", exact: true }),
  ).toBeVisible();
  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);
  await expect(
    page.getByRole("heading", { name: "¡DEMASIADOS INTENTOS!" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await ingresarComoAdmin(page);
  await navegacion(page, "Seguridad").click();
  await page
    .getByLabel("Empleado", { exact: true })
    .selectOption(TRABAJADORA_ESTUARDO);
  await page.getByLabel("Acción", { exact: true }).selectOption("enable");
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByText("Estado: Habilitado")).toBeVisible();
  await cerrarSesion(page);
  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  expect(errores).toEqual([]);
});

test("la trabajadora de demostración de Estuardo solo ve su empresa y bitácoras autorizadas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errores = vigilarErrores(page);
  await prepararAdministracion(page);
  await asignarClave(page, TRABAJADORA_ESTUARDO);
  await cerrarSesion(page);
  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect(page.locator(".folder-card")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await ingresarComoAdmin(page);

  await navegacion(page, "Seguridad").click();
  await page
    .getByLabel("Empleado", { exact: true })
    .selectOption(TRABAJADORA_ESTUARDO);
  await page
    .getByLabel("Usuario activo", { exact: true })
    .selectOption(TRABAJADORA_ESTUARDO);
  await page.getByLabel("Empleado", { exact: true }).selectOption("AL-01");
  await expect(page.getByLabel("Usuario activo", { exact: true })).toHaveValue(
    TRABAJADORA_ESTUARDO,
  );
  await page.getByLabel("Empresa autorizada").selectOption("ALLAN");
  await expect(page.getByLabel("Usuario activo", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("Usuario activo").locator("option[value='ES-01']"),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Usuario activo").locator("option[value='AL-01']"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Guardar permisos" }),
  ).toBeDisabled();
  await page.getByLabel("Empresa autorizada").selectOption("ESTUARDO");
  await page
    .getByLabel("Usuario activo", { exact: true })
    .selectOption(TRABAJADORA_ESTUARDO);
  await page.locator(".authorization-picker summary").click();
  await page.getByLabel("Temperaturas", { exact: true }).check();
  await page.getByLabel("Cloro", { exact: true }).check();
  await page.getByLabel("Cloro", { exact: true }).uncheck();
  await page.getByLabel("Cloro", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar permisos" }).click();
  await expect(page.getByRole("status")).toContainText("Permisos guardados");
  await cerrarSesion(page);
  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);

  await expect(page.getByText(NOMBRE_ESTUARDO)).toBeVisible();
  await expect(page.getByText("Empresa autorizada: ESTUARDO")).toBeVisible();
  await expect(page.getByLabel("Empresa de carpeta")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bitácora de EPP", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Normas de la Secretaría del Trabajo",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".folder-card")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Cloro", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Certificados de salud", exact: true }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await expect(
    page.getByLabel("Cuarto frío", { exact: true }).locator("option"),
  ).toHaveText(["Selecciona…", "Cuarto 1", "Cuarto 2"]);
  expect(
    await page
      .getByLabel("Cuarto frío", { exact: true })
      .locator("option")
      .evaluateAll((opciones) => opciones.map((opcion) => opcion.value)),
  ).toEqual(["", "ESTUARDO-1", "ESTUARDO-2"]);
  await page.getByRole("button", { name: "← Volver a los apartados" }).click();
  await page.getByRole("button", { name: "Cloro", exact: true }).click();
  await expect(
    page.getByLabel("Lugar / área", { exact: true }).locator("option"),
  ).toHaveText(["Selecciona…", "Descarga"]);
  expect(
    await page
      .getByLabel("Lugar / área", { exact: true })
      .locator("option")
      .evaluateAll((opciones) => opciones.map((opcion) => opcion.value)),
  ).toEqual(["", "ESTUARDO-Proceso"]);

  await page.evaluate(() => {
    location.hash = "#captura?area=ALLAN-1";
  });
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect(page.locator(".folder-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await page.goto("/#captura?area=ESTUARDO-1");
  await intentarIngreso(page, TRABAJADORA_ESTUARDO, CLAVE_TRABAJO);
  await expect(page.locator(".folder-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await expect(page.getByLabel("Cuarto frío", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Cuarto frío", { exact: true })).toHaveValue(
    "ESTUARDO-1",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Captura operativa" }),
  ).toBeVisible();
  await expect(page.getByLabel("ID", { exact: true })).toBeVisible();
  await expect(page.locator(".folder-card")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("exporta el PDF del rango elegido con el nombre y el contenido del período", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errores = vigilarErrores(page);
  await prepararAdministracion(page);
  await navegacion(page, "Bitácoras de salud").click();
  await page.getByLabel("Empresa de carpeta").selectOption("ALLAN");
  await page
    .getByRole("button", { name: /^Temperaturas · cuartos fríos/ })
    .click();
  await page.getByLabel("Cuarto frío", { exact: true }).selectOption("ALLAN-1");
  await page.getByLabel("Fecha y hora de revisión").fill("2026-10-14T10:00");
  await page.getByLabel("Temperatura (°C)").fill("-26");
  await page.getByLabel("Observaciones / motivo de No aplica").fill(NOTA_PDF);
  await page
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(page.locator("tbody").last()).toContainText(NOTA_PDF);
  await expect(page.locator("tbody").last()).toContainText("Óptimo");

  await page.getByLabel("Desde", { exact: true }).fill("2026-10-14");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-14");
  const descargaIncluida = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  const pdfIncluido = await descargaIncluida;
  expect(pdfIncluido.suggestedFilename()).toBe(
    "temperature_ALLAN_2026-10-14_2026-10-14.pdf",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "PDF generado" }),
  ).toHaveText("PDF generado: 1 registro del período seleccionado.");
  const textoIncluido = textoPdf(await bytesDescarga(pdfIncluido));
  expect(textoIncluido.startsWith("%PDF-")).toBe(true);
  for (const fragmento of [
    "Rey Pez",
    "Temperaturas · cuartos fríos",
    "Empresa: ALLAN",
    "Desde: 2026-10-14",
    "Hasta: 2026-10-14",
    "Registros: 1",
    NOTA_PDF,
    "-26",
    "Óptimo",
  ])
    expect(textoIncluido).toContain(fragmento);

  await page.getByLabel("Desde", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-01-02");
  const descargaVacia = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  const pdfVacio = await descargaVacia;
  expect(pdfVacio.suggestedFilename()).toBe(
    "temperature_ALLAN_2026-01-01_2026-01-02.pdf",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "PDF generado" }),
  ).toHaveText("PDF generado: 0 registros del período seleccionado.");
  const textoVacio = textoPdf(await bytesDescarga(pdfVacio));
  expect(textoVacio).toContain("Sin registros en este período.");
  expect(textoVacio).toContain("Registros: 0");
  expect(textoVacio).not.toContain(NOTA_PDF);

  let descargasInvalidas = 0;
  const contar = () => {
    descargasInvalidas += 1;
  };
  page.on("download", contar);
  await page.getByLabel("Desde", { exact: true }).fill("2026-10-20");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-01");
  await page.getByRole("button", { name: "Generar PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Selecciona un rango válido: Desde debe ser anterior o igual a Hasta.",
  );
  expect(descargasInvalidas).toBe(0);
  page.off("download", contar);
  expect(errores).toEqual([]);
});

test("exporta el respaldo JSON, rechaza copias inválidas y restaura la descarga", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errores = vigilarErrores(page);
  const dialogos = [];
  const registrarDialogo = (dialogo) => {
    dialogos.push(dialogo.message());
    dialogo.dismiss();
  };
  await prepararAdministracion(page);
  await agregarEmpleado(page, "PERSONA RESPALDO E2E");
  await navegacion(page, "Reportes y CSV").click();
  const promesa = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo JSON" }).click();
  const descarga = await promesa;
  expect(descarga.suggestedFilename()).toBe("respaldo_rey_pez.json");
  const texto = (await bytesDescarga(descarga)).toString("utf8");
  expect(texto).not.toContain(CLAVE_ADMIN);
  const respaldo = JSON.parse(texto);
  expect(respaldo.fecha_respaldo).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  );
  expect(respaldo.access.admin.hash).toEqual(expect.any(String));
  expect(
    respaldo.employees.some(
      (empleado) => empleado.nombre_completo === "PERSONA RESPALDO E2E",
    ),
  ).toBe(true);
  expect(respaldo.employees).toHaveLength(31);

  await agregarEmpleado(page, "PERSONA AJENA AL RESPALDO");
  await navegacion(page, "Personal").click();
  await page.getByLabel("Buscar personal").fill("PERSONA AJENA AL RESPALDO");
  await expect(page.locator("tbody").last()).toContainText(
    "PERSONA AJENA AL RESPALDO",
  );
  await navegacion(page, "Inicio").click();
  await expect(page.locator(".kvalue").nth(1)).toHaveText("32");
  await navegacion(page, "Reportes y CSV").click();

  page.on("dialog", registrarDialogo);
  const corrupto = structuredClone(respaldo);
  corrupto.employees.push(structuredClone(corrupto.employees[0]));
  let alertaJson = "";
  for (const [nombre, contenido, aviso] of [
    ["incompleto.json", '{"employees":[]}', /formato válido/],
    ["no-es-json.json", "no-es-json", /JSON/],
    ["ids-duplicados.json", JSON.stringify(corrupto), /IDs duplicados/],
  ]) {
    await page.getByLabel("Restaurar respaldo JSON").setInputFiles({
      name: nombre,
      mimeType: "application/json",
      buffer: Buffer.from(contenido),
    });
    await expect(page.getByRole("alert")).toContainText(aviso);
    await expect(
      page.getByRole("heading", { name: "Reportes y respaldos" }),
    ).toBeVisible();
    if (nombre === "no-es-json.json")
      alertaJson = await page.getByRole("alert").innerText();
  }
  expect(alertaJson).toBe(
    "El archivo no es un JSON válido. Elige un respaldo exportado desde Reportes.",
  );
  expect(dialogos).toEqual([]);
  page.off("dialog", registrarDialogo);
  await navegacion(page, "Inicio").click();
  await expect(page.locator(".kvalue").nth(1)).toHaveText("32");

  const confirmacion = new Promise((resolver) => {
    page.once("dialog", (dialogo) => {
      resolver(dialogo.message());
      dialogo.accept();
    });
  });
  await navegacion(page, "Reportes y CSV").click();
  await page.getByLabel("Restaurar respaldo JSON").setInputFiles({
    name: "respaldo_rey_pez.json",
    mimeType: "application/json",
    buffer: Buffer.from(texto),
  });
  expect(await confirmacion).toContain("Se cerrará la sesión");
  await expect(
    page.getByRole("heading", { name: "Bienvenido a Rey Pez", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Respaldo restaurado.");
  await expect(
    page.getByRole("heading", { name: "Configurar acceso de María" }),
  ).toHaveCount(0);
  await ingresarComoAdmin(page);
  await navegacion(page, "Inicio").click();
  await expect(page.locator(".kvalue").nth(1)).toHaveText("31");
  await navegacion(page, "Personal").click();
  await page.getByLabel("Buscar personal").fill("PERSONA RESPALDO E2E");
  await expect(page.locator("tbody").last()).toContainText(
    "PERSONA RESPALDO E2E",
  );
  await expect(page.locator("tbody .status")).toHaveText("Activo");
  await page.getByLabel("Buscar personal").fill("PERSONA AJENA AL RESPALDO");
  await expect(page.locator("tbody").last()).toContainText("Sin resultados");
  await expect(page.locator("tbody").last()).not.toContainText(
    "PERSONA AJENA AL RESPALDO",
  );
  expect(errores).toEqual([]);
});
