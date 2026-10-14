import test from "node:test";
import assert from "node:assert/strict";
import { scheduledEvent, timeToMinutes } from "../codigo/dominio/asistencia.js";
import {
  assignMissingIds,
  saveEmployee,
  saveSchedule,
  deleteSchedule,
  recordAttendance,
  saveManualIncident,
  terminateEmployee,
} from "../codigo/dominio/operaciones.js";
import { defaultSchedules } from "../codigo/datos/horariosIniciales.js";
import {
  mergeEmployees,
  parseCSV,
  toCSV,
} from "../codigo/utilidades/archivosCsv.js";
import {
  createLocalRepository,
  STORAGE_KEY,
} from "../codigo/repositorios/repositorioLocal.js";
const employee = {
  id_empleado: "AL-01",
  nombre_completo: "PRUEBA",
  empresa_codigo: "ALLAN",
  puesto: "GENERAL",
  estatus: "Activo",
  codigo_horario: "ALL-GEN",
};
const initial = () => ({
  version: 1,
  employees: [{ ...employee }],
  attendance: [],
  alerts: [],
  schedules: structuredClone(defaultSchedules),
});
const time = (hour, minute = 0) => new Date(2026, 9, 10, hour, minute);
const mark = (movement, hour) => ({
  id_empleado: "AL-01",
  movimiento: movement,
  fecha_hora: time(hour).toISOString(),
});
test("interpreta horas reales y rechaza horas inválidas", () => {
  assert.equal(timeToMinutes("09:30"), 570);
  assert.equal(timeToMinutes("25:00"), null);
  assert.equal(timeToMinutes("09:60"), null);
  assert.equal(timeToMinutes(""), null);
});
test("secuencia completa de entrada, comida, regreso y salida", () => {
  let state = initial();
  for (const [hour, movement] of [
    [9, "ENTRADA"],
    [13, "SALIDA_A_COMER"],
    [14, "REGRESO_DE_COMER"],
    [18, "SALIDA_FINAL"],
  ]) {
    const result = recordAttendance(state, "al-01", "", time(hour));
    assert.equal(result.event.movement, movement);
    assert.equal(result.event.expected, true);
    state = result.state;
  }
  assert.equal(state.alerts.length, 0);
  assert.equal(state.attendance.length, 4);
});
test("salida directa al terminar turno y reinicio al día siguiente", () => {
  const records = [mark("ENTRADA", 9)];
  assert.equal(
    scheduledEvent(employee, defaultSchedules, records, time(18)).movement,
    "SALIDA_FINAL",
  );
  assert.equal(
    scheduledEvent(
      employee,
      defaultSchedules,
      records,
      new Date(2026, 9, 11, 9),
    ).movement,
    "ENTRADA",
  );
});
test("revisiones no cambian la secuencia, se usa fecha del último movimiento real", () => {
  const records = [
    mark("REVISION_ADMINISTRATIVA", 15),
    mark("ENTRADA", 9),
    mark("SALIDA_A_COMER", 13),
  ];
  assert.equal(
    scheduledEvent(employee, defaultSchedules, records, time(14)).movement,
    "REGRESO_DE_COMER",
  );
});
test("marcación fuera de intervalo se acepta con alerta administrativa", () => {
  const result = recordAttendance(initial(), "AL-01", "", time(3));
  assert.equal(result.state.attendance.length, 1);
  assert.equal(result.state.attendance[0].incidencia, "");
  assert.equal(result.state.alerts[0].estado, "Pendiente");
});
test("marca repetida genera alerta y preserva ambos registros", () => {
  const state = initial();
  state.attendance = [mark("SALIDA_FINAL", 18), mark("ENTRADA", 9)];
  const result = recordAttendance(state, "AL-01", "", time(19));
  assert.equal(result.state.attendance.length, 3);
  assert.ok(result.state.alerts.some((a) => a.tipo === "Marcación repetida"));
});
test("rechaza cuentas inactivas, ID desconocido y contraseñas de demo", () => {
  assert.throws(
    () => recordAttendance(initial(), "AL-01", "password"),
    /contraseña/,
  );
  assert.throws(() => recordAttendance(initial(), "ZZ", ""), /No se encontró/);
  assert.throws(
    () => recordAttendance(terminateEmployee(initial(), "AL-01"), "AL-01", ""),
    /no está activa/,
  );
});
test("renombrar empleado mantiene referencias históricas y detecta duplicados", () => {
  const state = initial();
  state.attendance = [mark("ENTRADA", 9)];
  state.alerts = [{ id_empleado: "AL-01" }];
  const updated = saveEmployee(
    state,
    { ...employee, id_empleado: "RP-0040" },
    "AL-01",
  );
  assert.equal(updated.attendance[0].id_empleado, "RP-0040");
  assert.equal(updated.alerts[0].id_empleado, "RP-0040");
  assert.throws(() => saveEmployee(state, employee), /ya está asignado/);
  assert.equal(state.employees[0].id_empleado, "AL-01");
});
test("IDs faltantes únicos y baja conserva historial", () => {
  const state = initial();
  state.employees.push({ nombre_completo: "A" }, { nombre_completo: "B" });
  state.attendance = [mark("ENTRADA", 9)];
  const updated = assignMissingIds(state);
  assert.equal(new Set(updated.employees.map((e) => e.id_empleado)).size, 3);
  assert.equal(terminateEmployee(updated, "AL-01").attendance.length, 1);
});
test("horarios referenciados no se eliminan y cambios de código actualizan asignación", () => {
  const state = initial();
  assert.throws(() => deleteSchedule(state, "ALL-GEN"), /empleados asignados/);
  const automatic = initial();
  automatic.employees[0].codigo_horario = "1";
  assert.throws(
    () => deleteSchedule(automatic, "ALL-GEN"),
    /empleados asignados/,
  );
  const updated = saveSchedule(
    state,
    { ...state.schedules[0], codigo: "ALL-NEW" },
    "ALL-GEN",
  );
  assert.equal(updated.employees[0].codigo_horario, "ALL-NEW");
});
test("incidencia exige motivo, responsable y fecha válida", () => {
  const form = {
    employeeId: "AL-01",
    type: "Emergencia / permiso",
    when: "2026-10-10T10:00",
    reviewer: "Admin",
    reason: "Autorizado",
  };
  const state = saveManualIncident(initial(), form);
  assert.equal(state.alerts[0].estado, "Revisada");
  assert.equal(state.attendance[0].movimiento, "REVISION_ADMINISTRATIVA");
  assert.throws(
    () => saveManualIncident(initial(), { ...form, when: "bad" }),
    /Completa/,
  );
});
test("CSV admite BOM, comillas, comas y saltos de línea; exporta todas las columnas", () => {
  const rows = parseCSV(
    '\uFEFFnombre_completo,empresa_codigo,observaciones\r\n"Ana, Pérez",ALLAN,"Dice ""hola""\ny adiós"',
  );
  assert.equal(rows[0].nombre_completo, "Ana, Pérez");
  assert.equal(rows[0].observaciones, 'Dice "hola"\ny adiós');
  assert.match(toCSV([{ a: 1 }, { a: 2, curp: "ABC" }]), /curp/);
  assert.match(toCSV([{ a: "=1+1" }]), /'=1\+1/);
  assert.throws(() => parseCSV('a\n"sin cerrar'), /comillas/);
});
test("importación inválida es atómica y evita duplicados o reasignaciones del ID", () => {
  const state = initial();
  assert.throws(
    () =>
      mergeEmployees(state, [
        {
          nombre_completo: "Otra persona",
          empresa_codigo: "ALLAN",
          id_empleado: "AL-01",
        },
      ]),
    /duplicado/,
  );
  assert.throws(
    () => mergeEmployees(state, [{ ...employee, id_empleado: "AL-09" }]),
    /conservar el historial/,
  );
  assert.equal(state.employees.length, 1);
});
test("repositorio conserva datos anteriores cuando falla la escritura", async () => {
  const stored = new Map([[STORAGE_KEY, JSON.stringify(initial())]]);
  const repository = createLocalRepository({
    getItem: (key) => stored.get(key),
    setItem: () => {
      throw Error("Sin espacio");
    },
  });
  await repository.load();
  await assert.rejects(
    repository.transact((state) => terminateEmployee(state, "AL-01")),
    /Sin espacio/,
  );
  assert.equal(
    JSON.parse(stored.get(STORAGE_KEY)).employees[0].estatus,
    "Activo",
  );
});
