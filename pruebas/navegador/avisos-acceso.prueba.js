import { expect, test } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { demoEmployees } from "../../codigo/datos/empleadosDemostracion.js";
import { defaultSchedules } from "../../codigo/datos/horariosIniciales.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";

const clave = "Prueba6";
const credencial = await makeCredential(clave);
test.beforeEach(async ({ page }) => {
  await page.route("**/__local/empleados", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );
  const state = {
    ...structuredClone(baseOperation),
    employees: demoEmployees,
    attendance: [],
    alerts: [],
    schedules: defaultSchedules,
    access: {
      admin: credencial,
      workers: { "AL-01": credencial, "AL-02": credencial },
      permissions: {
        "AL-01": { company: "ALLAN", logs: ["chlorine"] },
        "AL-02": { company: "ALLAN", logs: ["chlorine"] },
      },
    },
  };
  await page.addInitScript((state) => {
    if (!localStorage.getItem("reypez_react_v1"))
      localStorage.setItem("reypez_react_v1", JSON.stringify(state));
  }, state);
});
async function ingreso(page, id, password = clave) {
  await page.getByLabel("ID", { exact: true }).fill(id);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}
test("cuarto fallo, regreso automático, siguiente usuario y desbloqueo de María", async ({
  page,
}) => {
  await page.goto("/#captura");
  await page.clock.install();
  for (let i = 0; i < 4; i++) {
    await ingreso(page, "AL-01", "incorrecta");
    if (i < 3)
      await expect(page.getByRole("alert")).toHaveText(
        "ID o contraseña incorrectos.",
      );
  }
  await expect(
    page.getByRole("heading", { name: "¡DEMASIADOS INTENTOS!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Comunícate con el personal autorizado", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(10100);
  await expect(
    page.getByRole("heading", { name: "Bienvenido a Rey Pez", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("ID", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
  await page.goto("/#captura");
  await ingreso(page, "AL-02");
  await expect(
    page.getByRole("button", { name: "Cloro", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/#administracion");
  await ingreso(page, "MARIA");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Alertas de seguridad" }),
  ).toContainText("Cuenta bloqueada");
  await page.getByLabel("Empleado", { exact: true }).selectOption("AL-01");
  await page.getByLabel("Acción", { exact: true }).selectOption("enable");
  await page.getByRole("button", { name: "Guardar acceso" }).click();
  await expect(page.getByText("Estado: Habilitado")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/#captura");
  await ingreso(page, "AL-01");
  await expect(
    page.getByRole("button", { name: "Cloro", exact: true }),
  ).toBeVisible();
});
test("deniega cuartos fríos y administración, registra la alerta y no bloquea la cuenta", async ({
  page,
}) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/#captura?area=ALLAN-1");
  await ingreso(page, "AL-01");
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect(
    page.getByText("No tienes acceso a este módulo", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".folder-card")).toHaveCount(0);
  const control = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(control.access.workers["AL-01"].active).toBe(true);
  expect(control.securityAlerts.at(0).modulo).toBe("ALLAN-1");
  for (const selector of [
    ".access-notice-message h1",
    ".access-notice-message p",
  ]) {
    const fits = await page
      .locator(selector)
      .evaluate(
        (e) =>
          e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
      );
    expect(fits).toBe(true);
  }
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await ingreso(page, "AL-01");
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("reypez_react_v1")).securityAlerts[0]
            .modulo,
      ),
    )
    .toBe("administracion");
  expect(errores).toEqual([]);
});
