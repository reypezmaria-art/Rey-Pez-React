import test from "node:test";
import assert from "node:assert/strict";
import {
  armarEstado,
  catalogoParaImportar,
  correoDeCuenta,
  diferencias,
  cambiosDeIdentidad,
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
