import { test, expect } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
const credencial = await makeCredential("Clave6");
test("vacaciones conserva períodos, filtra meses y empresa, calcula regreso y permite cancelar", async ({
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
  await abrir();
  await expect(page.getByText(/16\/11\/2026 · Conmemoración/)).toBeVisible();
  await page
    .getByRole("button", { name: "Programar vacaciones", exact: true })
    .click();
  await expect(
    page
      .getByLabel("Trabajador de vacaciones")
      .getByRole("option", { name: /prueba/ }),
  ).toHaveCount(0);
  await page.getByLabel("Trabajador de vacaciones").selectOption("X-01");
  await page.getByLabel("Primer día de vacaciones").fill("2026-10-30");
  await page.getByLabel("Días laborables a disfrutar").fill("21");
  await page
    .getByLabel("Días ya usados fuera de este apartado para ese aniversario")
    .fill("0");
  await page
    .getByLabel("Motivo / acuerdo de las fechas")
    .fill("Fechas acordadas de demostración");
  await page.getByRole("checkbox", { name: /Confirmo la antigüedad/ }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "Salida:" }),
  ).toContainText("25/11/2026");
  await page
    .getByRole("button", { name: "Guardar vacaciones", exact: true })
    .click();
  await expect(
    page.getByText("Vacaciones guardadas.", { exact: true }),
  ).toBeVisible();
  const tabla = page.getByRole("region", {
    name: "Trabajador / empresa, Salida, Último día, Regreso, Días laborables, Estado, Acciones",
    exact: true,
  });
  await expect(tabla).toContainText("24/11/2026");
  await expect(tabla).toContainText("En vacaciones");
  await page.screenshot({
    path: test.info().outputPath("vacaciones.png"),
    fullPage: true,
  });
  await page.getByLabel("Mes de vacaciones").fill("2026-10");
  await expect(tabla).toContainText("PERSONA FICTICIA");
  await page.getByLabel("Empresa de vacaciones").selectOption("EDGAR");
  await expect(tabla).toContainText("No hay vacaciones programadas");
  await page.reload();
  await abrir();
  await expect(tabla).toContainText("25/11/2026");
  await tabla
    .getByRole("button", { name: "Cancelar período", exact: true })
    .click();
  await page.getByLabel("Motivo de cancelación").fill("Cambio de fechas");
  await page
    .getByRole("button", { name: "Confirmar cancelación", exact: true })
    .click();
  await expect(tabla).toContainText("No hay vacaciones programadas");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
