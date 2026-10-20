import { expect, test } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
const credencial = await makeCredential("Clave6");
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T16:00:00Z"));
  await page.route("**/__local/empleados", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );
  const state = {
    ...structuredClone(baseOperation),
    employees: [
      {
        id_empleado: "AL-01",
        nombre_completo: "PERSONA DEMO ALLAN",
        empresa_codigo: "ALLAN",
        estatus: "Activo",
      },
      {
        id_empleado: "ED-01",
        nombre_completo: "PERSONA DEMO EDGAR",
        empresa_codigo: "EDGAR",
        estatus: "Activo",
      },
      {
        id_empleado: "ES-01",
        nombre_completo: "PERSONA DEMO ESTUARDO",
        empresa_codigo: "ESTUARDO",
        estatus: "Baja",
      },
    ],
    attendance: [
      {
        id_registro: "entrada",
        id_empleado: "AL-01",
        nombre_completo: "PERSONA DEMO ALLAN",
        empresa_codigo: "ALLAN",
        movimiento: "ENTRADA",
        fecha_hora: "2026-10-20T15:00:00Z",
      },
      {
        id_registro: "comida",
        id_empleado: "ED-01",
        nombre_completo: "PERSONA DEMO EDGAR",
        empresa_codigo: "EDGAR",
        movimiento: "SALIDA_A_COMER",
        fecha_hora: "2026-10-20T15:00:00Z",
      },
    ],
    schedules: [],
    programs: [],
    holidays: ["2026-10-20"],
    alerts: [
      {
        id_alerta: "reloj",
        nombre_completo: "PERSONA DEMO ALLAN",
        empresa_codigo: "ALLAN",
        tipo: "Revisión de horario",
        detalle: "Revisar horario de prueba",
        estado: "Pendiente",
        fecha_hora: "2026-10-20T15:00:00Z",
      },
    ],
    securityAlerts: [
      {
        id_alerta: "seguridad",
        id_empleado: "ED-01",
        empresa_codigo: "EDGAR",
        tipo: "Acceso denegado",
        detalle: "Administración",
        estado: "Pendiente",
        fecha_hora: "2026-10-20T15:00:00Z",
      },
    ],
    access: { admin: credencial, workers: {}, permissions: {} },
  };
  await page.addInitScript((state) => {
    if (!localStorage.getItem("reypez_react_v1"))
      localStorage.setItem("reypez_react_v1", JSON.stringify(state));
  }, state);
});
async function ingresar(page) {
  await page.goto("/#administracion");
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Panel principal", exact: true }),
  ).toBeVisible();
}
const nav = (page, name) =>
  page.getByRole("navigation").getByRole("button", { name, exact: true });
test("las tarjetas abren pendientes, movimientos y personal de su estado; el desglose sale solo dentro de Total de empleados", async ({
  page,
}) => {
  await ingresar(page);
  await expect(
    page.getByRole("heading", { name: "Personal por empresa", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Alertas por revisar/ }).click();
  await expect(
    page.getByRole("heading", { name: "Alertas por revisar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Revisión de horario", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Acceso denegado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al panel", exact: true })
    .click();
  await page.getByRole("button", { name: /^Registros de hoy/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Volver al panel", exact: true })
    .click();
  await page.getByRole("button", { name: /^Con entrada/ }).click();
  await expect(page.locator("tbody")).toContainText("PERSONA DEMO ALLAN");
  await expect(page.locator("tbody")).not.toContainText("PERSONA DEMO EDGAR");
  await page
    .getByRole("button", { name: "Volver al panel", exact: true })
    .click();
  await page.getByRole("button", { name: /^Total de empleados/ }).click();
  await expect(
    page.getByRole("heading", { name: "Total de empleados", exact: true }),
  ).toBeVisible();
  const resumen = page.getByRole("region", {
    name: "Personal por empresa",
    exact: true,
  });
  await resumen.getByRole("button", { name: /^EDGAR/ }).click();
  await expect(page.getByLabel("Filtrar empresa")).toHaveValue("EDGAR");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("PERSONA DEMO EDGAR");
  await page
    .getByRole("button", { name: "Volver al panel", exact: true })
    .click();
  await page.getByRole("button", { name: /^Empresas 3/ }).click();
  await expect(
    page.getByRole("button", { name: "Editar datos de empresas", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar datos de empresas", exact: true })
    .click();
  await expect(page.getByLabel("Empresa a editar")).toBeVisible();
});
test("gráficas semanales y mensuales muestran conteos reales y sus barras abren el detalle filtrado", async ({
  page,
}) => {
  await ingresar(page);
  const semanal = page.getByRole("region", {
    name: "Incidencias semanales",
    exact: true,
  });
  const mensual = page.getByRole("region", {
    name: "Incidencias mensuales",
    exact: true,
  });
  await expect(semanal).toContainText("2 incidencias en el período");
  await expect(mensual).toContainText("2 incidencias en el período");
  await mensual.getByLabel("Mes de incidencias").fill("2026-09");
  await expect(mensual).toContainText(
    "Sin incidencias registradas en este período.",
  );
  await semanal
    .getByRole("button", { name: "Ver incidencias de ALLAN: 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Detalle de incidencias", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Revisión de horario");
  await expect(page.locator("tbody")).not.toContainText("Acceso denegado");
});
test("María edita los datos de una empresa y conserva el historial fiscal al darla de baja", async ({
  page,
}) => {
  await ingresar(page);
  await nav(page, "Seguridad").click();
  await page.getByText("Datos de empresas", { exact: true }).click();
  await page.getByLabel("Empresa a editar").selectOption("ALLAN");
  await page
    .getByLabel("Razón social", { exact: true })
    .fill("EMPRESA DE PRUEBA ACTUALIZADA");
  await page.getByLabel("RFC de la empresa").fill("AAA010101AAA");
  await page.getByLabel("Régimen fiscal").fill("Régimen de prueba");
  await page.getByLabel("Giro de la empresa").fill("Giro de prueba");
  await page
    .getByLabel("Motivo del cambio de empresa")
    .fill("Actualización de prueba");
  await page
    .getByRole("button", { name: "Guardar datos de empresa", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Datos de empresa guardados.",
  );
  await expect(
    page.getByLabel("Empresa del trabajador").locator('option[value="ALLAN"]'),
  ).toHaveText("EMPRESA DE PRUEBA ACTUALIZADA");
  await page.getByLabel("Estado de la empresa").selectOption("Baja");
  await page
    .getByLabel("Motivo del cambio de empresa")
    .fill("Baja administrativa de prueba");
  await page
    .getByRole("button", { name: "Guardar datos de empresa", exact: true })
    .click();
  await expect(page.locator(".company-settings tbody tr")).toHaveCount(2);
  await page.reload();
  await page.getByLabel("ID", { exact: true }).fill("MARIA");
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await nav(page, "Seguridad").click();
  await page.getByText("Datos de empresas", { exact: true }).click();
  await page.getByLabel("Empresa a editar").selectOption("ALLAN");
  await expect(page.getByLabel("Estado de la empresa")).toHaveValue("Baja");
  await expect(page.getByLabel("RFC de la empresa")).toHaveValue(
    "AAA010101AAA",
  );
  await expect(page.locator(".company-settings tbody tr")).toHaveCount(2);
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.employees).toHaveLength(3);
  expect(state.attendance).toHaveLength(2);
});
