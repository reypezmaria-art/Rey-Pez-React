import { test, expect } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
const credencial = await makeCredential("Clave6");
test("vacaciones por salida y regreso, búsqueda por nombre, saldo, persistencia y secciones contraídas", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-05T18:00:00Z"));
  await page.route("**/__local/empleados", (r) =>
    r.fulfill({ contentType: "application/json", body: "[]" }),
  );
  const state = {
    ...structuredClone(baseOperation),
    employees: [
      {
        id_empleado: "X-01",
        nombre_completo: "PERSONA FICTICIA",
        puesto: "General",
        empresa_codigo: "ALLAN",
        fecha_ingreso: "2018-10-04",
        estatus: "Activo",
      },
      {
        id_empleado: "X-03",
        nombre_completo: "ÁNGEL PERSONA RECIENTE",
        puesto: "General",
        empresa_codigo: "ALLAN",
        fecha_ingreso: "2025-01-27",
        estatus: "Activo",
      },
      {
        id_empleado: "X-02",
        nombre_completo: "prueba",
        puesto: "General",
        empresa_codigo: "ALLAN",
        estatus: "Activo",
      },
    ],
    attendance: [],
    alerts: [],
    schedules: [],
    access: { admin: credencial, workers: {}, permissions: {} },
  };
  await page.addInitScript((s) => {
    if (!localStorage.getItem("reypez_react_v1"))
      localStorage.setItem("reypez_react_v1", JSON.stringify(s));
  }, state);
  async function abrir() {
    await page.goto("/#administracion");
    await page.getByLabel("ID", { exact: true }).fill("MARIA");
    await page.getByLabel("Contraseña", { exact: true }).fill("Clave6");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Personal", exact: true })
      .click();
    await page.getByRole("button", { name: "Vacaciones", exact: true }).click();
  }
  const tabla = page.getByRole("region", {
    name: "Trabajador / empresa, Salida, Último día, Regreso, Días laborables, Estado, Acciones",
    exact: true,
  });
  await abrir();
  const plegable = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: "Días de vacaciones por revisar" }),
  });
  await expect(plegable).not.toHaveAttribute("open");
  await plegable.locator("summary").click();
  await expect(plegable).toHaveAttribute("open", "");
  await plegable.locator("summary").click();
  await page
    .getByRole("button", { name: "Programar vacaciones", exact: true })
    .click();
  const buscar = page.getByLabel("Buscar trabajador por nombre o ID");
  await buscar.fill("prueba");
  await expect(page.getByText("No se encontraron trabajadores.")).toBeVisible();
  await buscar.fill("reciente angel");
  await page
    .getByRole("group", { name: "Trabajadores encontrados" })
    .getByRole("button", { name: /X-03/ })
    .click();
  await page.getByLabel("Fecha de salida de vacaciones").fill("2026-02-14");
  await page.getByLabel("Fecha de regreso a trabajar").fill("2026-02-26");
  const saldo = page.getByRole("status", {
    name: "Saldo de vacaciones",
    exact: true,
  });
  await expect(saldo).toContainText("le quedan 2 días");
  await expect(saldo).toContainText("Antigüedad: 1 año");
  await expect(saldo).toContainText("10 días laborables");
  await expect(
    page.getByRole("status").filter({ hasText: "Salida:" }),
  ).toContainText("25/02/2026");
  await expect(page.getByLabel("Días laborables a disfrutar")).toHaveCount(0);
  await expect(
    page.getByLabel("Año del aniversario al que se aplican"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar días ya usados", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("captura-fechas.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Guardar vacaciones", exact: true })
    .click();
  await expect(
    page.getByText("Vacaciones guardadas.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mes de vacaciones").fill("2026-02");
  await expect(tabla).toContainText("26/02/2026");
  await expect(tabla).toContainText("Finalizadas");
  await page.reload();
  await abrir();
  await page.getByLabel("Mes de vacaciones").fill("2026-02");
  await expect(tabla).toContainText("26/02/2026");
  await tabla.getByRole("button", { name: "Modificar", exact: true }).click();
  await expect(page.getByLabel("Fecha de regreso a trabajar")).toHaveValue(
    "2026-02-26",
  );
  await expect(saldo).toContainText("le quedan 2 días");
  await page.getByLabel("Fecha de regreso a trabajar").fill("2026-02-27");
  await expect(saldo).toContainText("le quedan 1 día");
  await page
    .getByRole("button", { name: "Guardar vacaciones", exact: true })
    .click();
  await expect(tabla).toContainText("27/02/2026");
  await tabla
    .getByRole("button", { name: "Cancelar período", exact: true })
    .click();
  await page.getByLabel("Motivo de cancelación").fill("Cambio de fechas");
  await page
    .getByRole("button", { name: "Confirmar cancelación", exact: true })
    .click();
  await expect(tabla).toContainText("No hay vacaciones programadas");
  await page
    .getByRole("button", { name: "Programar vacaciones", exact: true })
    .click();
  await buscar.fill("X-01");
  await page
    .getByRole("group", { name: "Trabajadores encontrados" })
    .getByRole("button", { name: /X-01/ })
    .click();
  await page.getByLabel("Fecha de salida de vacaciones").fill("2026-10-30");
  await page.getByLabel("Fecha de regreso a trabajar").fill("2026-11-25");
  await expect(saldo).toContainText("21 días laborables");
  await page
    .getByRole("button", { name: "Guardar vacaciones", exact: true })
    .click();
  await page.getByLabel("Mes de vacaciones").fill("2026-11");
  await expect(tabla).toContainText("25/11/2026");
  await page.getByLabel("Empresa de vacaciones").selectOption("EDGAR");
  await expect(tabla).toContainText("No hay vacaciones programadas");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
