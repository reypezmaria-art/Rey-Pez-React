import test from "node:test";
import assert from "node:assert/strict";
import {
  armarEstado,
  catalogoParaImportar,
  correoDeCuenta,
  correoEsDeMaria,
  cursoresDeAsistencia,
  cursoresFaltantes,
  decidirCopiaLocal,
  diaGuatemala,
  diferencias,
  enriquecerAsistenciaNueva,
  fechaLocalGuatemala,
  cambiosDeIdentidad,
  lotesAtomicos,
  rutaAdjunto,
  tieneOperacionPropia,
  trabajadoresDesde,
} from "../codigo/repositorios/estadoFirebase.js";
import { cuentaAsignada } from "../codigo/dominio/seguridad.js";

test("el correo interno usa el id y rechaza espacios", () => {
  assert.equal(
    correoDeCuenta("AL-01", "acceso.reypez.app"),
    "al-01@acceso.reypez.app",
  );
  assert.throws(() => correoDeCuenta("Ana López", "acceso.reypez.app"), /ID/);
});
test("arma trabajadores desde usuarios y reconoce uid o hash", () => {
  const workers = trabajadoresDesde([
    { uid: "u1", rol: "trabajador", idEmpleado: "AL-01", activo: true },
    { uid: "t1", rol: "terminal", deviceId: "equipo" },
    { uid: "u2", rol: "trabajador", idEmpleado: "ED-02", activo: false },
  ]);
  assert.deepEqual(workers["AL-01"], { active: true, uid: "u1" });
  assert.equal(workers["ED-02"].active, false);
  assert.equal(workers.t1, undefined);
  assert.equal(cuentaAsignada(workers["AL-01"]), true);
  assert.equal(cuentaAsignada({ hash: "abc", active: true }), true);
  assert.equal(cuentaAsignada(undefined), false);
});
test("el diff escribe altas y bajas sin repetir documentos iguales", () => {
  const antes = armarEstado({
    listas: {
      employees: [{ id_empleado: "AL-01", nombre_completo: "Ana" }],
      schedules: [],
    },
    config: { permissions: {} },
    adminUid: "admin",
  });
  const despues = {
    ...antes,
    employees: [
      { id_empleado: "AL-01", nombre_completo: "Ana actualizada" },
      { id_empleado: "ED-02", nombre_completo: "Eva" },
    ],
  };
  const operaciones = diferencias(antes, despues);
  assert.equal(
    operaciones.filter(
      (op) => op.coleccion === "empleados" && op.tipo === "set",
    ).length,
    2,
  );
  assert.equal(diferencias(despues, despues).length, 0);
  const baja = diferencias(despues, {
    ...despues,
    employees: [despues.employees[1]],
  });
  assert.ok(
    baja.some(
      (op) =>
        op.tipo === "delete" &&
        op.coleccion === "empleados" &&
        op.id === "AL-01",
    ),
  );
});
test("cambiar el id del empleado conserva el uid", () => {
  const antes = {
    access: { workers: { "AL-01": { uid: "u1", active: true } } },
  };
  const despues = {
    access: { workers: { "RP-0040": { uid: "u1", active: true } } },
  };
  assert.deepEqual(cambiosDeIdentidad(antes, despues), [
    { uid: "u1", idEmpleado: "RP-0040" },
  ]);
});
test("la importación local omite demostración y contraseñas", () => {
  const importado = catalogoParaImportar(
    {
      employees: [
        {
          id_empleado: "AL-01",
          nombre_completo: "EMPLEADO DEMO ALLAN 1",
          empresa_codigo: "ALLAN",
          estatus: "Activo",
        },
        {
          id_empleado: "AL-02",
          nombre_completo: "Ana Real",
          empresa_codigo: "ALLAN",
          estatus: "Activo",
        },
      ],
      attendance: [],
      schedules: [],
      alerts: [],
      access: {
        admin: { hash: "secreto", salt: "sal", active: true },
        workers: { "AL-02": { hash: "otro", salt: "sal", active: true } },
        permissions: { "AL-02": { company: "ALLAN", logs: ["epp"] } },
      },
    },
    "uid-maria",
  );
  assert.deepEqual(
    importado.employees.map((e) => e.id_empleado),
    ["AL-02"],
  );
  assert.deepEqual(importado.access.workers, {});
  assert.equal(importado.access.admin.uid, "uid-maria");
  assert.equal(importado.access.admin.hash, undefined);
  assert.equal(importado.access.permissions["AL-02"].company, "ALLAN");
});
test("la copia local no pisa la nube cuando los dos lados tienen datos", () => {
  assert.equal(
    decidirCopiaLocal({
      localTieneOperacion: true,
      nubeTieneOperacion: true,
    }),
    "conservar",
  );
  assert.equal(
    decidirCopiaLocal({
      localTieneOperacion: true,
      nubeTieneOperacion: false,
    }),
    "copiar",
  );
  assert.equal(
    decidirCopiaLocal({
      localTieneOperacion: false,
      nubeTieneOperacion: true,
    }),
    "nada",
  );
  assert.equal(
    decidirCopiaLocal({
      localTieneOperacion: false,
      nubeTieneOperacion: false,
    }),
    "sembrar",
  );
  assert.equal(
    tieneOperacionPropia({ employees: [{ id_empleado: "AL-01" }] }),
    true,
  );
  assert.equal(tieneOperacionPropia({ schedules: [{ codigo: "X" }] }), false);
});
test("solo el correo de María puede ser la cuenta de administración", () => {
  assert.equal(correoEsDeMaria("MARIA@acceso.reypez.app"), true);
  assert.equal(correoEsDeMaria("maria@otro.dominio"), false);
  assert.equal(correoEsDeMaria("al-01@acceso.reypez.app"), false);
});
test("un marcaje nuevo lleva el día de Guatemala y su cursor en el mismo lote", () => {
  const ahora = Date.parse("2026-10-19T18:00:00.000Z");
  const antes = { attendance: [] };
  const despues = enriquecerAsistenciaNueva(
    antes,
    {
      attendance: [
        {
          id_registro: "r1",
          id_empleado: "AL-01",
          movimiento: "ENTRADA",
          fecha_hora: "2026-10-19T17:30:00.000Z",
        },
        {
          id_registro: "viejo",
          id_empleado: "AL-01",
          movimiento: "ENTRADA",
          fecha_hora: "2026-10-01T15:00:00.000Z",
        },
      ],
    },
    ahora,
  );
  assert.equal(despues.attendance[1].fecha_ms, undefined);
  assert.equal(
    despues.attendance[0].fecha_local,
    fechaLocalGuatemala(despues.attendance[0].fecha_ms),
  );
  assert.equal(
    despues.attendance[0].fecha_dia,
    diaGuatemala(despues.attendance[0].fecha_ms),
  );
  const cursores = cursoresDeAsistencia(antes, despues);
  assert.equal(cursores.length, 1);
  assert.equal(cursores[0].id, "AL-01");
  assert.equal(cursores[0].datos.ultimo, "ENTRADA");
  assert.equal(cursores[0].datos.registroId, "r1");
  const lotes = lotesAtomicos(
    [
      { tipo: "set", coleccion: "empleados", id: "AL-01" },
      { tipo: "set", coleccion: "asistencia", id: "r1" },
    ],
    cursores,
    2,
  );
  assert.deepEqual(
    lotes[1].map((op) => op.coleccion),
    ["asistencia", "secuenciaAsistencia"],
  );
});
test("la evidencia nueva incluye empresa y tipo; la vieja sigue leyéndose por id", () => {
  assert.equal(
    rutaAdjunto(
      "bitacoras",
      "b1",
      { company: "ESTUARDO", type: "epp" },
      "foto.jpg",
    ),
    "evidencias/bitacoras/ESTUARDO/epp/b1/foto.jpg",
  );
  assert.equal(
    rutaAdjunto("mantenimiento", "m1", {}, "recibo.pdf"),
    "evidencias/mantenimiento/m1/recibo.pdf",
  );
});
test("el cursor de hoy no se inventa si ya existe", () => {
  const ahora = Date.parse("2026-10-19T18:00:00.000Z");
  const faltantes = cursoresFaltantes(
    [
      {
        id_registro: "r1",
        id_empleado: "AL-01",
        movimiento: "SALIDA_A_COMER",
        fecha_hora: "2026-10-19T17:00:00.000Z",
      },
      {
        id_registro: "r2",
        id_empleado: "ED-02",
        movimiento: "ENTRADA",
        fecha_hora: "2026-10-18T17:00:00.000Z",
      },
    ],
    ["AL-01"],
    ahora,
  );
  assert.equal(faltantes.length, 0);
});
