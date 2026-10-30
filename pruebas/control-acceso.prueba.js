import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  registrarIntentoLocal,
  destinoRestringido,
} from "../codigo/dominio/controlAcceso.js";
import {
  permisoGuardado,
  puedeVerNomina,
} from "../codigo/dominio/seguridad.js";
import { baseOperation } from "../codigo/datos/operacionInicial.js";
const { crearControlAcceso } = createRequire(import.meta.url)(
  "../firebase/funciones/controlAcceso.js",
);

function estado() {
  return {
    ...structuredClone(baseOperation),
    employees: [
      { id_empleado: "AL-01", empresa_codigo: "ALLAN", estatus: "Activo" },
    ],
    access: {
      admin: { active: true },
      workers: { "AL-01": { active: true }, "AL-02": { active: true } },
      permissions: { "AL-01": { company: "ALLAN", logs: ["chlorine"] } },
    },
  };
}
test("cuatro fallos bloquean solo esa cuenta; acertar después no la desbloquea", () => {
  let state = estado();
  for (let i = 1; i <= 4; i++) {
    const r = registrarIntentoLocal(state, "AL-01", false);
    state = r.state;
    assert.equal(r.bloqueado, i === 4);
  }
  assert.equal(state.access.workers["AL-02"].active, true);
  assert.equal(state.securityAlerts.length, 1);
  assert.equal(registrarIntentoLocal(state, "AL-01", true).bloqueado, true);
});
test("un ingreso correcto antes del cuarto fallo reinicia el contador", () => {
  let state = estado();
  for (let i = 0; i < 3; i++)
    state = registrarIntentoLocal(state, "AL-01", false).state;
  state = registrarIntentoLocal(state, "AL-01", true).state;
  assert.equal(state.access.workers["AL-01"].failedAttempts, 0);
  assert.equal(registrarIntentoLocal(state, "AL-01", false).bloqueado, false);
});
test("tener permiso de cloro no abre un QR de cuartos fríos ni administración", () => {
  const state = estado(),
    worker = { id: "AL-01", role: "worker" };
  assert.equal(destinoRestringido(state, worker, "#captura"), null);
  assert.equal(
    destinoRestringido(state, worker, "#captura?area=ALLAN-1"),
    "ALLAN-1",
  );
  assert.equal(
    destinoRestringido(state, worker, "#captura?area=EDGAR-1"),
    "EDGAR-1",
  );
  assert.equal(
    destinoRestringido(state, worker, "#administracion"),
    "administracion",
  );
  assert.equal(destinoRestringido(state, worker, "#nomina"), "nomina");
  assert.equal(puedeVerNomina(state, worker), false);
});
test("el permiso de nómina abre esa sección en las tres empresas y deja igual el resto", () => {
  const state = estado(),
    worker = { id: "AL-01", role: "worker" };
  assert.deepEqual(permisoGuardado("ALLAN", ["chlorine"], false), {
    company: "ALLAN",
    logs: ["chlorine"],
  });
  assert.deepEqual(permisoGuardado("ESTUARDO", ["epp"], true), {
    company: "ESTUARDO",
    logs: ["epp"],
    nomina: true,
  });
  state.access.permissions["AL-01"] = permisoGuardado(
    "ALLAN",
    ["chlorine"],
    true,
  );
  assert.equal(puedeVerNomina(state, worker), true);
  assert.equal(destinoRestringido(state, worker, "#nomina"), null);
  assert.equal(destinoRestringido(state, worker, "#captura"), null);
  assert.equal(
    destinoRestringido(state, worker, "#administracion"),
    "administracion",
  );
  state.access.workers["AL-01"].active = false;
  assert.equal(puedeVerNomina(state, worker), false);
  state.access.workers["AL-01"].active = true;
  state.employees[0].estatus = "Baja";
  assert.equal(destinoRestringido(state, worker, "#nomina"), "nomina");
});

function servidor(verificar) {
  const documentos = new Map([
    ["usuarios/uid", { rol: "trabajador", idEmpleado: "AL-01", activo: true }],
  ]);
  const snap = (path) => ({ data: () => documentos.get(path) });
  let cola = Promise.resolve();
  const db = {
    doc: (path) => ({ path, get: async () => snap(path) }),
    runTransaction: (fn) => {
      const result = cola.then(() =>
        fn({
          get: async (ref) => snap(ref.path),
          set: (ref, val) =>
            documentos.set(ref.path, { ...documentos.get(ref.path), ...val }),
        }),
      );
      cola = result.catch(() => {});
      return result;
    },
  };
  const auth = {
    getUserByEmail: async () => ({ uid: "uid" }),
    updateUser: async () => {},
    revokeRefreshTokens: async () => {},
    createCustomToken: async () => "token-simulado",
  };
  return { documentos, login: crearControlAcceso({ db, auth, verificar }) };
}
test("el servidor contabiliza intentos simultáneos y conserva el bloqueo entre clientes", async () => {
  let correcto = false;
  const s = servidor(async () => correcto);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      s.login("AL-01", "incorrecta", "al-01@acceso.reypez.app"),
    ),
  );
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(s.documentos.get("controlAccesos/AL-01").intentos, 4);
  assert.equal(s.documentos.get("usuarios/uid").activo, false);
  assert.equal(
    [...s.documentos.keys()].filter((p) => p.startsWith("alertasSeguridad/"))
      .length,
    1,
  );
  correcto = true;
  await assert.rejects(
    s.login("AL-01", "correcta", "al-01@acceso.reypez.app"),
    (e) => e.details.bloqueado,
  );
  s.documentos.set("controlAccesos/AL-01", { intentos: 0, bloqueado: false });
  assert.equal(
    (await s.login("AL-01", "correcta", "al-01@acceso.reypez.app")).token,
    "token-simulado",
  );
});
test("los fallos de conexión no se cuentan como contraseñas incorrectas", async () => {
  const s = servidor(async () => {
    throw Error("Sin conexión");
  });
  await assert.rejects(
    s.login("AL-01", "clave", "al-01@acceso.reypez.app"),
    /Sin conexión/,
  );
  assert.equal(s.documentos.has("controlAccesos/AL-01"), false);
});
