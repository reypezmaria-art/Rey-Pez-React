import test from "node:test";
import assert from "node:assert/strict";
import {
  scheduledEvent,
  scheduleForEmployee,
  timeToMinutes,
} from "../codigo/dominio/asistencia.js";
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
import { localDate } from "../codigo/utilidades/fechas.js";
import {
  createLocalRepository,
  STORAGE_KEY,
  leerRespaldo,
  mensajeGuardado,
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
test("en el turno 06–14 la comida posterior a las 13:00 sigue siendo comida", () => {
  const edgar = {
    ...employee,
    empresa_codigo: "EDGAR",
    codigo_horario: "EDG-ROT",
  };
  const dia = (hour, minute = 0) => new Date(2026, 8, 28, hour, minute);
  const entrada = {
    id_empleado: "AL-01",
    movimiento: "ENTRADA",
    fecha_hora: dia(6).toISOString(),
  };
  assert.equal(
    scheduledEvent(edgar, defaultSchedules, [entrada], dia(13)).movement,
    "SALIDA_A_COMER",
  );
  assert.equal(
    scheduledEvent(edgar, defaultSchedules, [entrada], dia(13, 50)).movement,
    "SALIDA_FINAL",
  );
});
test("una vigencia que se apunta a sí misma no bloquea el horario", () => {
  const schedule = {
    ...defaultSchedules.find((s) => s.codigo === "ALL-GEN"),
    vigente_desde: "2999-01-01",
  };
  schedule.previousSchedule = schedule;
  assert.equal(
    scheduleForEmployee(employee, [schedule], new Date(2026, 9, 10))
      .hora_inicio,
    "09:00",
  );
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
test("cambiar de empresa retira permisos y la baja desde el formulario guarda la fecha", () => {
  const state = initial();
  state.access = {
    admin: null,
    workers: { "AL-01": { active: true, hash: "derivada" } },
    permissions: { "AL-01": { company: "ALLAN", logs: ["epp"] } },
  };
  const moved = saveEmployee(
    state,
    { ...employee, empresa_codigo: "EDGAR" },
    "AL-01",
  );
  assert.equal(moved.access.permissions["AL-01"], undefined);
  assert.equal(moved.access.workers["AL-01"].hash, "derivada");
  assert.equal(moved.employees[0].empresa_codigo, "EDGAR");
  const baja = saveEmployee(state, { ...employee, estatus: "Baja" }, "AL-01");
  assert.equal(baja.employees[0].fecha_baja, localDate());
  const conservada = saveEmployee(
    baja,
    { ...baja.employees[0], puesto: "GENERAL 2" },
    "AL-01",
  );
  assert.equal(
    conservada.employees[0].fecha_baja,
    baja.employees[0].fecha_baja,
  );
  const reactivado = saveEmployee(
    baja,
    { ...baja.employees[0], estatus: "Activo" },
    "AL-01",
  );
  assert.equal(reactivado.employees[0].fecha_baja, undefined);
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
  assert.match(toCSV([{ horario: { hora_inicio: "09:00" } }]), /09:00/);
  assert.doesNotMatch(
    toCSV([{ horario: { hora_inicio: "09:00" } }]),
    /object Object/,
  );
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
test("un respaldo que no es JSON se rechaza en español", () => {
  assert.throws(
    () => leerRespaldo("no-es-json"),
    /El archivo no es un JSON válido/,
  );
  assert.throws(() => leerRespaldo("[]"), /respaldo JSON de Rey Pez/);
  assert.equal(leerRespaldo('{"employees":[]}').employees.length, 0);
});
test("el navegador sin espacio avisa en español", () => {
  const error = Error("quota");
  error.name = "QuotaExceededError";
  assert.match(mensajeGuardado(error), /No hay espacio/);
  assert.equal(mensajeGuardado(Error("Sin espacio")), "Sin espacio");
});
test("almacenamiento corrupto y copias ilegibles avisan en español", async () => {
  const repository = createLocalRepository({
    getItem: (key) => (key === STORAGE_KEY ? "{no-es-json" : "no-es-json"),
    setItem: () => {},
  });
  await assert.rejects(repository.load(), /JSON válido/);
  assert.throws(() => repository.backups(), /copias automáticas/);
});
test("repositorio conserva datos anteriores cuando falla la escritura", async () => {
  const stored = new Map([[STORAGE_KEY, JSON.stringify(initial())]]);
  let failWrite = false;
  const repository = createLocalRepository({
    getItem: (key) => stored.get(key),
    setItem: (key, value) => {
      if (failWrite) throw Error("Sin espacio");
      stored.set(key, value);
    },
  });
  await repository.load();
  failWrite = true;
  await assert.rejects(
    repository.transact((state) => terminateEmployee(state, "AL-01")),
    /Sin espacio/,
  );
  assert.equal(
    JSON.parse(stored.get(STORAGE_KEY)).employees[0].estatus,
    "Activo",
  );
});

test("tolerancia exacta de diez minutos y comida desde salida real", () => {
  const state = initial();
  assert.equal(
    recordAttendance(state, "AL-01", "", time(9, 10)).state.alerts.length,
    0,
  );
  assert.equal(
    recordAttendance(state, "AL-01", "", time(9, 11)).state.alerts.length,
    1,
  );
  const lateMeal = [
    mark("ENTRADA", 9),
    { ...mark("SALIDA_A_COMER", 13), fecha_hora: time(13, 20).toISOString() },
  ];
  assert.equal(
    scheduledEvent(employee, defaultSchedules, lateMeal, time(14, 30)).expected,
    true,
  );
  assert.equal(
    scheduledEvent(employee, defaultSchedules, lateMeal, time(14, 31)).expected,
    false,
  );
  assert.equal(
    scheduledEvent(employee, defaultSchedules, [mark("ENTRADA", 9)], time(12))
      .expected,
    true,
  );
});
