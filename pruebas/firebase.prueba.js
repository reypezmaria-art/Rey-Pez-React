import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordAttendance } from "../codigo/dominio/operaciones.js";
import { comprimirEvidencia } from "../codigo/utilidades/comprimirEvidencia.js";
import {
  CLAVES_FIREBASE,
  correoDeIdentificador,
  leerConfiguracionFirebase,
} from "../codigo/repositorios/firebaseConfiguracion.js";
import { crearClienteMemoria } from "../codigo/repositorios/clienteMemoria.js";
import {
  decidirMigracion,
  diferencias,
  localAportaDatos,
  puedeEscribir,
  separarEvidencias,
} from "../codigo/repositorios/modeloFirestore.js";
import { createFirestoreRepository } from "../codigo/repositorios/repositorioFirestore.js";
import {
  createLocalRepository,
  STORAGE_KEY,
} from "../codigo/repositorios/repositorioLocal.js";

function memoria() {
  const datos = new Map();
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, valor),
    removeItem: (clave) => datos.delete(clave),
  };
}

function entornoCompleto() {
  return Object.fromEntries(CLAVES_FIREBASE.map((clave) => [clave, "valor"]));
}

const admin = { rol: "admin", idEmpleado: "MARIA", activo: true };
const brenda = {
  rol: "trabajador",
  idEmpleado: "ES-06",
  activo: true,
  empresa: "ESTUARDO",
  bitacoras: ["epp"],
};

test("sin variables la configuración queda vacía y no se activa Firebase", () => {
  assert.equal(leerConfiguracionFirebase({}), null);
  assert.equal(
    leerConfiguracionFirebase({ VITE_FIREBASE_API_KEY: "x" }).incompleta,
    true,
  );
  const completa = leerConfiguracionFirebase(entornoCompleto());
  assert.equal(completa.firebase.projectId, "valor");
  assert.equal(completa.dominioCorreo, "usuarios.reypez.local");
  assert.equal(
    correoDeIdentificador("AL-01", completa.dominioCorreo),
    "al-01@usuarios.reypez.local",
  );
});

test("la diferencia solo borra documentos que el cliente ya tenía", () => {
  const antes = {
    employees: [{ id_empleado: "AL-01", nombre_completo: "A" }],
    attendance: [],
    schedules: [],
    alerts: [],
    logs: [],
    maintenance: [],
    rooms: [],
    areas: [],
    programs: [],
    terminals: [],
    absenceReviews: [],
    scheduleExceptions: [],
    audit: [],
  };
  const despues = {
    ...antes,
    employees: [{ id_empleado: "AL-02", nombre_completo: "B" }],
  };
  const cambios = diferencias(antes, despues);
  assert.deepEqual(
    cambios.find(
      (item) => item.tipo === "borrar" && item.coleccion === "empleados",
    ),
    { tipo: "borrar", coleccion: "empleados", id: "AL-01", existia: true },
  );
  assert.equal(
    cambios.some((item) => item.id === "ED-01"),
    false,
  );
});

test("las evidencias salen del documento y conservan la ruta", () => {
  const { estado, pendientes } = separarEvidencias({
    rooms: [{ id: "ALLAN-1", company: "ALLAN" }],
    logs: [
      {
        id: "bit-1",
        company: "ALLAN",
        evidence: {
          name: "foto de prueba.png",
          type: "image/png",
          data: "data:image/png;base64,aaaa",
        },
      },
    ],
    maintenance: [],
  });
  assert.equal(estado.logs[0].evidence.data, undefined);
  assert.match(estado.logs[0].evidence.ruta, /^evidencias\/ALLAN\/bit-1\//);
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].data.startsWith("data:image/png"), true);
});

test("la migración sube datos locales y no pisa operación ya compartida", () => {
  assert.equal(
    decidirMigracion({
      marca: "",
      localAporta: true,
      remotoVacio: true,
      origenRemoto: "",
      remotoSinOperacion: true,
    }),
    "subir",
  );
  assert.equal(
    decidirMigracion({
      marca: "",
      localAporta: true,
      remotoVacio: false,
      origenRemoto: "semilla",
      remotoSinOperacion: true,
    }),
    "sustituir-semilla",
  );
  assert.equal(
    decidirMigracion({
      marca: "",
      localAporta: true,
      remotoVacio: false,
      origenRemoto: "semilla",
      remotoSinOperacion: false,
    }),
    "conflicto",
  );
  assert.equal(
    decidirMigracion({
      marca: "hecha",
      localAporta: true,
      remotoVacio: true,
      origenRemoto: "",
      remotoSinOperacion: true,
    }),
    "omitir",
  );
  assert.equal(localAportaDatos(null), false);
});

test("las reglas de escritura reflejan a María, la terminal y la empresa del trabajador", () => {
  assert.equal(
    puedeEscribir(admin, {
      tipo: "borrar",
      coleccion: "empleados",
      id: "AL-01",
    }),
    true,
  );
  assert.equal(
    puedeEscribir(brenda, {
      tipo: "poner",
      coleccion: "bitacoras",
      existia: false,
      datos: { company: "ESTUARDO", type: "epp", createdBy: "ES-06" },
    }),
    true,
  );
  assert.equal(
    puedeEscribir(brenda, {
      tipo: "poner",
      coleccion: "bitacoras",
      existia: false,
      datos: { company: "ALLAN", type: "epp", createdBy: "ES-06" },
    }),
    false,
  );
  assert.equal(
    puedeEscribir(
      { rol: "terminal", activo: true },
      { tipo: "poner", coleccion: "asistencia", existia: false, datos: {} },
    ),
    true,
  );
  assert.equal(
    puedeEscribir(
      { rol: "terminal", activo: true },
      { tipo: "poner", coleccion: "empleados", existia: false, datos: {} },
    ),
    false,
  );
  const reglas = readFileSync(
    new URL("../firestore.rules", import.meta.url),
    "utf8",
  );
  const storage = readFileSync(
    new URL("../storage.rules", import.meta.url),
    "utf8",
  );
  for (const texto of [
    "esAdmin",
    "esTrabajador",
    "esTerminal",
    "bitacoras",
    "empresa",
  ])
    assert.match(reglas, new RegExp(texto));
  assert.match(storage, /evidencias/);
  assert.match(storage, /2 \* 1024 \* 1024/);
});

test("sin navegador la compresión no altera la evidencia", async () => {
  const evidencia = {
    name: "foto.png",
    type: "image/png",
    data: "data:image/png;base64,aaaa",
  };
  assert.deepEqual(await comprimirEvidencia(evidencia), evidencia);
});

test("Firestore de memoria migra, autentica y limita a la empresa autorizada", async () => {
  const local = memoria();
  const inicial = await createLocalRepository(local).load();
  inicial.employees[0] = {
    ...inicial.employees[0],
    nombre_completo: "PERSONA REAL",
    codigo_horario: "ALL-GEN",
  };
  const edgar = inicial.employees.find((item) => item.id_empleado === "ED-01");
  edgar.nombre_completo = "PERSONA EDGAR";
  inicial.access.workers["AL-01"] = {
    salt: "sal-secreta",
    hash: "hash-secreto",
    active: true,
  };
  inicial.access.permissions["AL-01"] = { company: "ALLAN", logs: ["epp"] };
  inicial.attendance.push({
    id_registro: "previo",
    id_empleado: "AL-01",
    nombre_completo: "PERSONA REAL",
    empresa_codigo: "ALLAN",
    movimiento: "ENTRADA",
    fecha_hora: "2026-10-12T15:00:00.000Z",
    incidencia: "",
    estado_sincronizacion: "Local - no sincronizado",
  });
  local.setItem(STORAGE_KEY, JSON.stringify(inicial));
  const cliente = crearClienteMemoria();
  const configuracion = leerConfiguracionFirebase({
    ...entornoCompleto(),
    VITE_FIREBASE_AUTH_EMAIL_DOMAIN: "usuarios.reypez.local",
  });
  const repo = createFirestoreRepository({
    configuracion,
    cliente,
    almacenamiento: local,
  });
  const estado = await repo.configurarAdministrador("Clave6");
  assert.equal(
    estado.employees.some((item) => item.nombre_completo === "PERSONA REAL"),
    true,
  );
  assert.equal(JSON.stringify(estado).includes("hash-secreto"), false);
  assert.equal(JSON.stringify(estado).includes("sal-secreta"), false);
  assert.equal(estado.access.permissions["AL-01"].logs[0], "epp");
  assert.equal(estado.attendance[0].estado_sincronizacion, "Sincronizado");
  await repo.asignarContrasena("AL-01", "Trab06", "Asignar contraseña inicial");
  await repo.verificarTrabajador("AL-01", "Trab06");
  await repo.transact(
    (state) =>
      recordAttendance(state, "AL-01", "Trab06", new Date(2026, 9, 12, 9), true)
        .state,
  );
  assert.ok(repo.backups().length >= 1);
  await repo.cerrarSesion();
  const sesion = await repo.autenticar("AL-01", "Trab06");
  assert.equal(sesion.role, "worker");
  await assert.rejects(
    repo.transact((state) => ({ ...state, employees: [] })),
    /permiso/,
  );
  await repo.transact((state) => ({
    ...state,
    logs: [
      ...state.logs,
      {
        id: "bit-allan",
        company: "ALLAN",
        type: "epp",
        createdBy: "AL-01",
        area: "ALLAN-Proceso",
        when: "2026-10-12T16:00:00.000Z",
        result: "Cumplió",
      },
    ],
  }));
  await assert.rejects(
    repo.transact((state) => ({
      ...state,
      logs: [
        ...state.logs,
        {
          id: "bit-ajena",
          company: "ESTUARDO",
          type: "epp",
          createdBy: "AL-01",
          when: "2026-10-12T16:00:00.000Z",
          result: "Cumplió",
        },
      ],
    })),
    /permiso/,
  );
  await repo.cerrarSesion();
  const administracion = await repo.autenticar("MARIA", "Clave6");
  assert.equal(administracion.role, "admin");
  const compartido = await repo.load();
  assert.equal(
    compartido.logs.some((item) => item.id === "bit-allan"),
    true,
  );
  assert.equal(
    compartido.employees.some((item) => item.id_empleado === "ED-01"),
    true,
  );
  await repo.asignarContrasena(
    "AL-01",
    "Nueva7",
    "Restablecer contraseña olvidada",
  );
  await repo.cerrarSesion();
  await assert.rejects(repo.autenticar("AL-01", "Trab06"), /incorrectos/);
  await repo.autenticar("AL-01", "Nueva7");
  await repo.cerrarSesion();
  await repo.autenticar("MARIA", "Clave6");
  await repo.cambiarEstadoTrabajador("AL-01", false);
  await repo.cerrarSesion();
  await assert.rejects(repo.autenticar("AL-01", "Nueva7"), /bloqueada/);
});
