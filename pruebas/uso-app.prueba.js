import test from "node:test";
import assert from "node:assert/strict";
import {
  crearContadorUso,
  duracionUso,
} from "../codigo/actividad/contadorUso.js";
import {
  registrarUso,
  diaUso,
  validarConsultaUso,
  validarPulso,
} from "../servidor-acceso/uso.js";
import { crearServidor } from "../servidor-acceso/index.js";
import { reviewAlerts } from "../codigo/dominio/operaciones.js";
function entorno() {
  const documentos = new Map([
    ["acceso/admin", { uid: "maria" }],
    [
      "usuarios/worker",
      { rol: "trabajador", activo: true, idEmpleado: "ES-01" },
    ],
    [
      "empleados/ES-01",
      {
        nombre_completo: "PERSONA DEMO",
        empresa_codigo: "ESTUARDO",
        estatus: "Activo",
      },
    ],
    [
      "operacion/config",
      { permissions: { "ES-01": { consultaNominaTodas: true } } },
    ],
  ]);
  const snap = (path) => {
    const dato = structuredClone(documentos.get(path));
    return { exists: !!dato, data: () => dato, get: (key) => dato?.[key] };
  };
  let cola = Promise.resolve();
  const db = {
    doc: (path) => ({ path, get: async () => snap(path) }),
    runTransaction: (fn) => {
      const operacion = cola.then(async () => {
        const escrituras = [];
        const result = await fn({
          get: async (ref) => {
            assert.equal(escrituras.length, 0);
            return snap(ref.path);
          },
          set: (ref, dato) => escrituras.push([ref.path, dato]),
        });
        escrituras.forEach(([path, dato]) =>
          documentos.set(path, structuredClone(dato)),
        );
        return result;
      });
      cola = operacion.catch(() => {});
      return operacion;
    },
    listarUso: async (datos) => ({
      registros: [{ fecha: datos.desde }],
      cursor: null,
    }),
  };
  const auth = {
    verifyIdToken: async (token) => {
      if (!["worker", "maria"].includes(token))
        throw Object.assign(Error("Token inválido"), {
          code: "unauthenticated",
        });
      return { uid: token };
    },
  };
  return { documentos, db, auth };
}
const solicitud = (uid = "worker") =>
  new Request("https://acceso.example/registrarUso", {
    headers: { Authorization: `Bearer ${uid}` },
  });
const pulso = (extra = {}) => ({
  sesion: "11111111-1111-4111-8111-111111111111",
  secuencia: 0,
  visibleMs: 0,
  activoMs: 0,
  visible: true,
  activo: true,
  modulo: "payroll",
  cierre: false,
  ...extra,
});
const dia = (e) =>
  [...e.documentos].filter(([key]) => key.startsWith("usoDiario/"));
test("el contador distingue frente, inactividad y suspensión del equipo", () => {
  const c = crearContadorUso(0);
  for (let n = 15000; n <= 360000; n += 15000) c.actualizar(n);
  assert.deepEqual(c.actualizar(360000), {
    visibleMs: 360000,
    activoMs: 300000,
    visible: true,
    activo: false,
  });
  c.actualizar(360000, false);
  assert.equal(c.actualizar(390000, true, true).visibleMs, 360000);
  assert.equal(c.actualizar(405000).activoMs, 315000);
  assert.equal(c.actualizar(3600000).visibleMs, 405000);
  assert.equal(duracionUso(3660000), "1 h 01 min");
});
test("los pulsos usan identidad firmada, son idempotentes y no duplican pestañas simultáneas", async () => {
  const e = entorno(),
    inicio = Date.parse("2026-11-03T18:00:00Z");
  await registrarUso(pulso(), solicitud(), e, inicio);
  const otro = "22222222-2222-4222-8222-222222222222";
  await registrarUso(pulso({ sesion: otro }), solicitud(), e, inicio);
  const p = pulso({ secuencia: 1, visibleMs: 60000, activoMs: 60000 });
  await Promise.all([
    registrarUso(p, solicitud(), e, inicio + 60000),
    registrarUso({ ...p, sesion: otro }, solicitud(), e, inicio + 60000),
  ]);
  await registrarUso(p, solicitud(), e, inicio + 61000);
  assert.equal(dia(e)[0][1].visibleMs, 60000);
  assert.equal(dia(e)[0][1].activoMs, 60000);
  assert.equal(dia(e)[0][1].sesiones, 2);
  assert.equal(dia(e)[0][1].cuenta, "ES-01");
  await assert.rejects(
    () => registrarUso({ ...p, uid: "maria" }, solicitud(), e, inicio),
    /no válido/,
  );
  await assert.rejects(
    () => registrarUso({ ...p, modulo: "security" }, solicitud(), e, inicio),
    /no autorizado/,
  );
});
test("un pulso no inventa historial, limita tiempo sin señal y conserva cierre", async () => {
  const e = entorno(),
    inicio = Date.parse("2026-11-03T18:00:00Z");
  await assert.rejects(
    () =>
      registrarUso(
        pulso({ secuencia: 1, visibleMs: 60000 }),
        solicitud(),
        e,
        inicio,
      ),
    /nuevo registro/,
  );
  await registrarUso(pulso(), solicitud(), e, inicio);
  await registrarUso(
    pulso({ secuencia: 1, visibleMs: 900000, activoMs: 900000, cierre: true }),
    solicitud(),
    e,
    inicio + 900000,
  );
  assert.equal(dia(e)[0][1].visibleMs, 120000);
  await registrarUso(
    pulso({ secuencia: 2, visibleMs: 1000000, activoMs: 1000000 }),
    solicitud(),
    e,
    inicio + 1000000,
  );
  assert.equal(dia(e)[0][1].visibleMs, 120000);
});
test("el acumulado diario divide el tiempo a medianoche de México", async () => {
  const e = entorno(),
    inicio = Date.parse("2026-11-04T05:59:30Z");
  await registrarUso(pulso(), solicitud(), e, inicio);
  await registrarUso(
    pulso({ secuencia: 1, visibleMs: 60000, activoMs: 60000 }),
    solicitud(),
    e,
    inicio + 60000,
  );
  const dias = Object.fromEntries(dia(e).map(([, d]) => [d.fecha, d]));
  assert.equal(diaUso(inicio), "2026-11-03");
  assert.equal(dias["2026-11-03"].visibleMs, 30000);
  assert.equal(dias["2026-11-04"].visibleMs, 30000);
  assert.equal(dias["2026-11-04"].sesiones, 0);
});
test("cuentas bloqueadas, inactivas y sin permiso no pueden registrar uso", async () => {
  for (const [path, dato] of [
    ["controlAccesos/ES-01", { bloqueado: true }],
    [
      "usuarios/worker",
      { rol: "trabajador", activo: false, idEmpleado: "ES-01" },
    ],
    ["operacion/config", { permissions: {} }],
    ["empleados/ES-01", { estatus: "Baja" }],
  ]) {
    const e = entorno();
    e.documentos.set(path, dato);
    await assert.rejects(
      () => registrarUso(pulso(), solicitud(), e),
      (error) => error.code === "permission-denied",
    );
    assert.equal(dia(e).length, 0);
  }
});
test("solo María puede consultar sesiones; fechas y cursores se validan", async () => {
  const e = entorno(),
    env = {
      FIREBASE_WEB_API_KEY: "demo",
      ALLOWED_ORIGINS: "https://ejemplo.test",
    };
  const servidor = crearServidor(() => e);
  const consulta = {
    vista: "diaria",
    desde: "2026-11-01",
    hasta: "2026-11-03",
  };
  const consultar = (uid) =>
    servidor.fetch(
      new Request("https://acceso.example/consultarUso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${uid}`,
        },
        body: JSON.stringify(consulta),
      }),
      env,
    );
  assert.equal((await consultar("worker")).status, 403);
  assert.equal((await consultar("maria")).status, 200);
  assert.equal((await consultar("invalido")).status, 401);
  for (const extra of [
    { desde: "2026-02-30" },
    { hasta: "2026-10-01" },
    { hasta: "2028-01-01" },
    { cursor: { fecha: "2026-11-01", id: "../../secreto" } },
  ])
    assert.throws(() => validarConsultaUso({ ...consulta, ...extra }));
  assert.throws(() => validarPulso(pulso({ activoMs: 1 })));
});
test("revisar alertas de una empresa conserva pendientes las demás", () => {
  const estado = {
    employees: [{ id_empleado: "ED-01", empresa_codigo: "EDGAR" }],
    alerts: [
      { empresa_codigo: "ALLAN", estado: "Pendiente" },
      { id_empleado: "ED-01", estado: "Pendiente" },
    ],
  };
  const resultado = reviewAlerts(estado, "ALLAN");
  assert.equal(resultado.alerts[0].estado, "Revisada");
  assert.equal(resultado.alerts[1].estado, "Pendiente");
  assert.equal(estado.alerts[0].estado, "Pendiente");
});

test("la actividad de otra pestaña se conserva aunque el intervalo visible ya esté contado", async () => {
  const e = entorno(),
    inicio = Date.parse("2026-11-03T18:00:00Z");
  const otra = "22222222-2222-4222-8222-222222222222";
  await registrarUso(pulso(), solicitud(), e, inicio);
  await registrarUso(pulso({ sesion: otra }), solicitud(), e, inicio);
  await registrarUso(
    pulso({ secuencia: 1, visibleMs: 60000, activoMs: 0, activo: false }),
    solicitud(),
    e,
    inicio + 60000,
  );
  await registrarUso(
    pulso({ sesion: otra, secuencia: 1, visibleMs: 60000, activoMs: 60000 }),
    solicitud(),
    e,
    inicio + 60000,
  );
  const diario = dia(e)[0][1];
  assert.equal(diario.visibleMs, 60000);
  assert.equal(diario.activoMs, 60000);
  const sesiones = [...e.documentos].filter(([p]) =>
    p.startsWith("usoSesiones/"),
  );
  assert.deepEqual(
    sesiones.map(([, d]) => d.visibleMs),
    [60000, 60000],
  );
});

test("María está excluida de todos los pulsos y las cuentas dependientes siguen registrándose", async () => {
  const e = entorno(),
    antes = structuredClone([...e.documentos]);
  for (const datos of [
    pulso(),
    pulso({
      modulo: "administration",
      secuencia: 1,
      visibleMs: 60000,
      activoMs: 60000,
    }),
    pulso({ cierre: true }),
  ]) {
    assert.deepEqual(await registrarUso(datos, solicitud("maria"), e), {
      ok: true,
      excluida: true,
    });
  }
  assert.deepEqual([...e.documentos], antes);
  await registrarUso(pulso(), solicitud("worker"), e);
  assert.equal(dia(e).length, 1);
  assert.equal(dia(e)[0][1].cuenta, "ES-01");
  e.documentos.set("usuarios/worker2", {
    rol: "trabajador",
    activo: true,
    idEmpleado: "AL-02",
  });
  e.documentos.set("empleados/AL-02", {
    nombre_completo: "OTRA PERSONA DEMO",
    empresa_codigo: "ALLAN",
    estatus: "Activo",
  });
  e.documentos.get("operacion/config").permissions["AL-02"] = {
    company: "ALLAN",
    secciones: ["reports"],
  };
  e.auth.verifyIdToken = async (token) => ({ uid: token });
  await registrarUso(pulso({ modulo: "reports" }), solicitud("worker2"), e);
  assert.equal(dia(e).length, 2);
  assert.deepEqual(
    dia(e)
      .map(([, d]) => d.cuenta)
      .sort(),
    ["AL-02", "ES-01"],
  );
});
