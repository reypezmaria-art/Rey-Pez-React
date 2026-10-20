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
  await page
    .getByLabel("Empresa del trabajador", { exact: true })
    .selectOption("ALLAN");
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

for (const tipo of ["bloqueado", "denegado"]) {
  test(`la escena ${tipo} se mueve con movimiento reducido y permite pausar`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#captura?area=ALLAN-1");
    if (tipo === "bloqueado") {
      for (let i = 0; i < 4; i++) {
        await ingreso(page, "AL-01", "incorrecta");
        if (i < 3)
          await expect(page.getByRole("alert")).toHaveText(
            "ID o contraseña incorrectos.",
          );
      }
    } else {
      await ingreso(page, "AL-01");
    }
    const canvas = page.locator(".access-notice-scene canvas");
    await expect
      .poll(() =>
        canvas.evaluate(
          (e) => e.getContext("2d").getImageData(10, 10, 1, 1).data[3],
        ),
      )
      .toBe(255);
    const fotograma = () => canvas.evaluate((e) => e.toDataURL());
    const primero = await fotograma();
    await expect.poll(fotograma).not.toBe(primero);
    await page
      .getByRole("button", { name: "Pausar animación", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Activar animación", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(200);
    const pausa = await fotograma();
    await page.waitForTimeout(250);
    expect(await fotograma()).toBe(pausa);
    await page
      .getByRole("button", { name: "Activar animación", exact: true })
      .click();
    await expect.poll(fotograma).not.toBe(pausa);
    await expect(page.getByText(/Volverás al inicio en/)).toBeVisible();
  });
}

test("revisar una alerta la archiva debajo de Admin sin desbloquear ni borrar el registro", async ({
  page,
}) => {
  await page.goto("/#captura");
  for (let i = 0; i < 4; i++) {
    await ingreso(page, "AL-01", "incorrecta");
    if (i < 3)
      await expect(page.getByRole("alert")).toHaveText(
        "ID o contraseña incorrectos.",
      );
  }
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await ingreso(page, "MARIA");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  const pendientes = page.getByRole("region", {
    name: "Alertas de seguridad",
    exact: true,
  });
  const registro = page.getByRole("region", {
    name: "Registro de incidencias",
    exact: true,
  });
  await expect(pendientes).toContainText("Cuenta bloqueada");
  await expect(registro).toContainText("Sin incidencias revisadas.");
  await pendientes
    .getByRole("button", { name: "Marcar revisada", exact: true })
    .click();
  await expect(pendientes).toContainText("Sin alertas pendientes.");
  await expect(registro).toContainText("Cuenta bloqueada");
  await expect(registro).toContainText("Por MARIA");
  expect(
    await page
      .getByRole("region", { name: "Admin", exact: true })
      .evaluate((el) => el.nextElementSibling.getAttribute("aria-label")),
  ).toBe("Registro de incidencias");
  await expect(
    page.getByText(
      /El bloqueo afecta únicamente|La contraseña no se muestra ni se exporta/,
    ),
  ).toHaveCount(0);
  const antes = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(antes.securityAlerts).toHaveLength(1);
  expect(antes.access.workers["AL-01"].locked).toBe(true);
  await page.reload();
  await ingreso(page, "MARIA");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  await expect(pendientes).toContainText("Sin alertas pendientes.");
  await expect(registro).toContainText("Cuenta bloqueada");
});

test("Acceso del trabajador exige empresa y limpia la selección y contraseña al cambiarla", async ({
  page,
}) => {
  await page.goto("/#administracion");
  await ingreso(page, "MARIA");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  const empresa = page.getByLabel("Empresa del trabajador", { exact: true });
  const empleado = page.getByLabel("Empleado", { exact: true });
  await expect(empresa).toHaveValue("");
  await expect(empleado).toBeDisabled();
  await expect(empleado.locator("option")).toHaveCount(1);
  await empresa.selectOption("ALLAN");
  const idsAllan = await empleado
    .locator("option")
    .evaluateAll((items) => items.map((e) => e.value).filter(Boolean));
  expect(idsAllan.length).toBeGreaterThan(0);
  expect(idsAllan.every((id) => id.startsWith("AL-"))).toBe(true);
  await empleado.selectOption("AL-01");
  await page.getByLabel("Acción", { exact: true }).selectOption("set");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Prueba6");
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("Prueba6");
  await empresa.selectOption("ESTUARDO");
  await expect(empleado).toHaveValue("");
  await expect(page.getByLabel("Acción", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveCount(0);
  const idsEstuardo = await empleado
    .locator("option")
    .evaluateAll((items) => items.map((e) => e.value).filter(Boolean));
  expect(idsEstuardo.length).toBeGreaterThan(0);
  expect(idsEstuardo.every((id) => id.startsWith("ES-"))).toBe(true);
  await empresa.selectOption("ALLAN");
  await empleado.selectOption("AL-01");
  await page.getByLabel("Acción", { exact: true }).selectOption("set");
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Confirmar contraseña", { exact: true }),
  ).toHaveValue("");
});
