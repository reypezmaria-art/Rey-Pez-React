import { test, expect } from "@playwright/test";
import { baseOperation } from "../../codigo/datos/operacionInicial.js";
import { makeCredential } from "../../codigo/dominio/seguridad.js";
import { pdfNominaEjemplo } from "../soporte/nominaEjemplo.js";

const admin = await makeCredential("Clave6");
const trabajadora = await makeCredential("Trab06");
const empleado = {
  id_empleado: "ES-01",
  nombre_completo: "CLAUDIA DEMO",
  empresa_codigo: "ESTUARDO",
  estatus: "Activo",
};

function semilla(permiso) {
  return {
    ...structuredClone(baseOperation),
    employees: [empleado],
    attendance: [],
    alerts: [],
    schedules: [],
    access: {
      admin,
      workers: permiso ? { "ES-01": trabajadora } : {},
      permissions: permiso ? { "ES-01": permiso } : {},
    },
  };
}

async function preparar(page, permiso) {
  await page.route("**/__local/empleados", (r) =>
    r.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.addInitScript((estado) => {
    localStorage.setItem("reypez_react_v1", JSON.stringify(estado));
  }, semilla(permiso));
}

async function ingresar(page, id, clave) {
  await page.getByLabel("ID", { exact: true }).fill(id);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

const pdf = (args, name = "ejemplo.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(pdfNominaEjemplo(args)),
});

test("María autoriza Nómina y Claudia edita las tres empresas sin abrir el resto", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await preparar(page);
  await page.goto("/#administracion");
  await ingresar(page, "MARIA", "Clave6");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Seguridad", exact: true })
    .click();
  await page
    .getByLabel("Empresa autorizada", { exact: true })
    .selectOption("ESTUARDO");
  await page
    .getByLabel("Usuario activo", { exact: true })
    .selectOption("ES-01");
  await page.locator(".authorization-picker summary").click();
  await page.getByLabel("Temperaturas", { exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Nómina de las tres empresas", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Guardar permisos", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "nómina de Allan, Edgar y Estuardo",
  );
  await page
    .getByLabel("Empresa del trabajador", { exact: true })
    .selectOption("ESTUARDO");
  await page.getByLabel("Empleado", { exact: true }).selectOption("ES-01");
  await page.getByLabel("Acción", { exact: true }).selectOption("set");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("Trab06");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("Trab06");
  await page
    .getByRole("button", { name: "Guardar acceso", exact: true })
    .click();
  await expect(page.getByText("Estado: Habilitado")).toBeVisible();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.access.permissions["ES-01"]).toMatchObject({
    company: "ESTUARDO",
    nomina: true,
  });
  expect(state.access.permissions["ES-01"].logs).toContain("temperature");

  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.goto("/#captura");
  await ingresar(page, "ES-01", "Trab06");
  await expect(
    page.getByRole("heading", { name: "Captura operativa autorizada" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Personal", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Seguridad", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Configuración", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nómina", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nómina", exact: true }),
  ).toBeVisible();
  const subir = page.getByLabel("Seleccionar PDF de nómina", { exact: true });
  await subir.setInputFiles(pdf());
  await expect(page.getByRole("status")).toContainText("Nómina guardada");
  await subir.setInputFiles(pdf({ empresa: "EDGAR" }, "edgar.pdf"));
  await expect(page.getByRole("status")).toContainText("Edgar");
  await page
    .getByRole("button", { name: "Modificar un mes", exact: true })
    .click();
  await page
    .getByLabel("Nómina a modificar", { exact: true })
    .selectOption("ALLAN_2026-01-01_2026-01-15");
  await page
    .getByLabel("Trabajador de la nómina", { exact: true })
    .selectOption("COD:001");
  await page.getByLabel("Salario diario", { exact: true }).fill("360.00");
  await page
    .getByLabel("Motivo de la corrección de nómina", { exact: true })
    .fill("Ajuste de prueba");
  await page
    .getByRole("button", { name: "Guardar corrección de nómina", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Corrección de nómina guardada",
  );
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("reypez_react_v1")),
  );
  expect(state.payroll.map((p) => p.empresa_codigo).sort()).toEqual([
    "ALLAN",
    "EDGAR",
  ]);
  expect(state.payroll.every((p) => p.actualizadoPor === "ES-01")).toBe(true);
  expect(state.audit[0].by).toBe("ES-01");
  expect(state.audit[0].motivo).toBe("Ajuste de prueba");
  expect(state.employees).toHaveLength(1);
  expect(state.access.permissions["ES-01"].nomina).toBe(true);

  await page
    .getByRole("button", { name: "Volver a bitácoras", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Captura operativa autorizada" }),
  ).toBeVisible();
  await expect(page.getByText("Empresa autorizada: ESTUARDO")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#administracion";
  });
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("sin el permiso, la trabajadora no abre Nómina y conserva solo sus bitácoras", async ({
  page,
}) => {
  await preparar(page, { company: "ESTUARDO", logs: ["temperature"] });
  await page.goto("/#captura");
  await ingresar(page, "ES-01", "Trab06");
  await expect(
    page.getByRole("heading", { name: "Captura operativa autorizada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nómina", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByText("Empresa autorizada: ESTUARDO")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#nomina";
  });
  await expect(
    page.getByRole("heading", { name: "¡ACCESO DENEGADO!" }),
  ).toBeVisible();
  await expect(page.locator(".payroll-page")).toHaveCount(0);
});
