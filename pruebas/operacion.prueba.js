import test from "node:test";
import assert from "node:assert/strict";
import { defaultSchedules } from "../codigo/datos/horariosIniciales.js";
import { baseOperation } from "../codigo/datos/operacionInicial.js";
import {
  scheduleForEmployee,
  pendingAbsences,
} from "../codigo/dominio/asistencia.js";
import {
  saveLog,
  pendingPrograms,
  temperatureStatus,
} from "../codigo/dominio/bitacoras.js";
import {
  makeCredential,
  verifyCredential,
  canCapture,
} from "../codigo/dominio/seguridad.js";
import { migrateState } from "../codigo/repositorios/repositorioLocal.js";
const employee = {
  id_empleado: "TEST",
  nombre_completo: "Persona de prueba",
  empresa_codigo: "EDGAR",
  codigo_horario: "EDG-ROT",
  estatus: "Activo",
};
const state = () => ({
  ...structuredClone(baseOperation),
  employees: [{ ...employee }],
  attendance: [],
  alerts: [],
  schedules: structuredClone(defaultSchedules),
});
const admin = { role: "admin", id: "MARIA", name: "María" };
test("rotación semanal y excepción de Pedro", () => {
  const hours = ["06:00", "09:00", "12:00", "06:00"];
  [28, 35, 42, 49].forEach((d, i) =>
    assert.equal(
      scheduleForEmployee(employee, defaultSchedules, new Date(2026, 8, d))
        .hora_inicio,
      hours[i],
    ),
  );
  assert.equal(
    scheduleForEmployee(
      {
        ...employee,
        nombre_completo: "PEDRO MARTIN RODRIGUEZ",
        codigo_horario: "EDG-PED",
      },
      defaultSchedules,
      new Date(2026, 9, 12),
    ).hora_inicio,
    "09:00",
  );
});
test("ausencias no sancionan y excluyen domingos, festivos y revisiones", () => {
  const s = state(),
    now = new Date(2026, 9, 12, 9);
  assert.equal(pendingAbsences(s, now).length, 0);
  assert.equal(pendingAbsences(s, new Date(2026, 9, 12, 12, 11)).length, 1);
  assert.equal(pendingAbsences(s, new Date(2026, 9, 11, 18)).length, 0);
  s.holidays = ["2026-10-12"];
  assert.equal(pendingAbsences(s, new Date(2026, 9, 12, 18)).length, 0);
  s.holidays = [];
  s.absenceReviews = [{ employeeId: "TEST", date: "2026-10-12" }];
  assert.equal(pendingAbsences(s, new Date(2026, 9, 12, 18)).length, 0);
});
test("temperaturas en los límites y bitácora persistida con responsable", () => {
  assert.equal(temperatureStatus(-25), "Óptimo");
  assert.equal(temperatureStatus(-24), "Variación en observación");
  assert.equal(temperatureStatus(-19), "Requiere atención");
  const s = state();
  const saved = saveLog(
    s,
    {
      company: "ALLAN",
      type: "temperature",
      area: "ALLAN-1",
      when: "2026-10-12T09:00",
      value: "-19",
      notes: "",
      notApplicable: false,
    },
    admin,
  );
  assert.equal(saved.logs[0].result, "Requiere atención");
  assert.equal(saved.logs[0].responsible, "María");
  assert.equal(s.logs.length, 0);
});
test("captura restringida por empresa y permiso; no aplica requiere motivo", () => {
  const s = state();
  s.access.workers.TEST = { active: true };
  s.access.permissions.TEST = { company: "EDGAR", logs: ["epp"] };
  const worker = { role: "worker", id: "TEST", name: "Prueba" };
  assert.equal(canCapture(s, worker, "EDGAR", "epp"), true);
  assert.equal(canCapture(s, worker, "ESTUARDO", "epp"), false);
  assert.throws(
    () => saveLog(s, { company: "ALLAN", type: "temperature" }, worker),
    /permiso/,
  );
  assert.throws(
    () =>
      saveLog(
        s,
        {
          company: "ALLAN",
          type: "cleaning",
          area: "ALLAN-Cocción",
          when: "2026-10-12T09:00",
          notApplicable: true,
          notes: "",
        },
        admin,
      ),
    /motivo/,
  );
});
test("registro programado cierra solo su revisión y protege duplicados", () => {
  const s = state();
  const now = new Date(2026, 9, 12, 9, 1);
  const due = pendingPrograms(s, now);
  const p = due.find((p) => p.area === "ALLAN-1");
  const form = {
    company: p.company,
    type: p.type,
    area: p.area,
    when: "2026-10-12T09:00",
    value: "-26",
    notes: "",
    programKey: p.key,
  };
  const saved = saveLog(s, form, admin);
  assert.equal(pendingPrograms(saved, now).length, due.length - 1);
  assert.throws(() => saveLog(saved, form, admin), /ya fue registrada/);
  assert.throws(
    () => saveLog(s, { ...form, area: "ALLAN-2" }, admin),
    /no corresponde/,
  );
});
test("migración recupera el catálogo sin borrar empleados editados ni historial", () => {
  const s = state();
  s.employees = [{ ...employee, nombre_completo: "EMPLEADO DEMO EDGAR 1" }];
  s.attendance = [{ id_empleado: "TEST", movimiento: "ENTRADA" }];
  const real = { ...employee, nombre_completo: "Nombre recuperado" };
  const merged = migrateState(s, [real]);
  assert.equal(merged.employees[0].nombre_completo, "Nombre recuperado");
  assert.equal(merged.attendance.length, 1);
  merged.employees[0].telefono = "123";
  assert.equal(migrateState(merged, [real]).employees[0].telefono, "123");
});
test("contraseñas derivadas con sal, bloqueo y verificación", async () => {
  const c = await makeCredential("ClaveLocal123");
  assert.equal(await verifyCredential(c, "ClaveLocal123"), true);
  assert.equal(await verifyCredential(c, "otra"), false);
  assert.equal(
    await verifyCredential({ ...c, active: false }, "ClaveLocal123"),
    false,
  );
  assert.notEqual(c.hash, "ClaveLocal123");
});

test("vigencia futura mantiene el horario anterior hasta la fecha acordada", () => {
  const previous = defaultSchedules.find((s) => s.codigo === "ALL-GEN");
  const modified = {
    ...previous,
    hora_inicio: "08:00",
    vigente_desde: "2026-11-01",
    previousSchedule: previous,
  };
  const e = { ...employee, empresa_codigo: "ALLAN", codigo_horario: "ALL-GEN" };
  assert.equal(
    scheduleForEmployee(e, [modified], new Date(2026, 9, 14)).hora_inicio,
    "09:00",
  );
  assert.equal(
    scheduleForEmployee(e, [modified], new Date(2026, 10, 2)).hora_inicio,
    "08:00",
  );
});

test("cambio de empresa invalida permisos de la empresa anterior", () => {
  const s = state();
  s.access.workers.TEST = { active: true };
  s.access.permissions.TEST = { company: "EDGAR", logs: ["epp"] };
  s.employees[0].empresa_codigo = "ALLAN";
  assert.equal(
    canCapture(s, { role: "worker", id: "TEST" }, "EDGAR", "epp"),
    false,
  );
});

test("contraseña de seis caracteres válida y cinco rechazada", async () => {
  const c = await makeCredential("Clave6");
  assert.equal(await verifyCredential(c, "Clave6"), true);
  await assert.rejects(makeCredential("Corta"), /6 caracteres/);
});

test("recuperación de un cuarto de Edgar sin duplicar equipos ya configurados", () => {
  const s = state();
  s.rooms = s.rooms.filter((r) => r.company !== "EDGAR");
  s.programs = s.programs.filter((p) => p.company !== "EDGAR");
  const restored = migrateState(s);
  assert.equal(restored.rooms.filter((r) => r.company === "EDGAR").length, 1);
  assert.equal(
    restored.programs.filter(
      (p) => p.company === "EDGAR" && p.type === "temperature",
    ).length,
    1,
  );
  const custom = state();
  custom.rooms = custom.rooms.filter((r) => r.company !== "EDGAR");
  custom.rooms.push({
    id: "edgar-local",
    company: "EDGAR",
    name: "Cuarto existente",
    active: true,
  });
  custom.programs = custom.programs.filter((p) => p.company !== "EDGAR");
  const kept = migrateState(custom);
  assert.equal(kept.rooms.filter((r) => r.company === "EDGAR").length, 1);
  assert.ok(kept.programs.some((p) => p.area === "edgar-local"));
});

test("listas fijas exigen respuestas completas y motivo por incumplimiento", async () => {
  const { checklistFor, validateChecklist } =
    await import("../codigo/datos/listasRevision.js");
  const s = state();
  const template = checklistFor(s, "epp", "EDGAR-Carga y descarga");
  const checks = template.items.map((i) => ({
    ...i,
    status: "yes",
    reason: "",
  }));
  assert.throws(() => validateChecklist(template, checks.slice(1)), /todos/);
  const fail = checks.map((c, i) => (i === 1 ? { ...c, status: "no" } : c));
  assert.throws(() => validateChecklist(template, fail), /por qué/);
  fail[1].reason = "Botas rotas";
  const record = saveLog(
    s,
    {
      company: "EDGAR",
      type: "epp",
      area: "EDGAR-Carga y descarga",
      when: "2026-10-14T12:00",
      notes: "",
      checks: fail,
      subjectEmployeeId: "TEST",
    },
    admin,
  ).logs[0];
  assert.equal(record.result, "No cumplió");
  assert.equal(record.checks[1].reason, "Botas rotas");
  assert.throws(
    () => saveLog(s, { ...record, subjectEmployeeId: "OTRO" }, admin),
    /empleado revisado/,
  );
  assert.equal(
    validateChecklist(
      template,
      checks.map((c) => ({ ...c, label: "alterado" })),
    )[0].label,
    template.items[0].label,
  );
});
test("Cloro limita áreas y enlaza la revisión programada sin campos ajenos", () => {
  const s = state();
  const form = {
    company: "ALLAN",
    type: "chlorine",
    area: "ALLAN-Proceso",
    when: "2026-10-12T09:15",
    value: "10 ml / 100 L",
    notes: "",
    performedBy: "Persona revisora",
  };
  assert.throws(
    () => saveLog(s, { ...form, area: "ALLAN-Sanitarios" }, admin),
    /área/,
  );
  assert.throws(
    () => saveLog(s, { ...form, performedBy: "" }, admin),
    /realizó/,
  );
  assert.equal(
    saveLog(s, form, admin).logs[0].programKey,
    "chlorine-ALLAN-2026-10-12-09:00",
  );
});
test("PDF filtra días completos y conserva los motivos sin mezclar registros", async () => {
  const { reportRows } = await import("../codigo/utilidades/reportesPdf.js");
  const s = state();
  const records = [
    {
      type: "epp",
      when: "2026-10-01T00:00:00",
      area: "EDGAR-Carga y descarga",
      checks: [{ label: "Botas", status: "no", reason: "Rotas" }],
    },
    { when: "2026-10-02T00:00:00" },
    { when: "2026-09-30T23:59:59" },
  ];
  const rows = reportRows(s, records, "epp", "2026-10-01", "2026-10-01");
  assert.equal(rows.length, 1);
  assert.match(rows[0][3], /Rotas/);
  assert.throws(
    () => reportRows(s, records, "epp", "2026-10-02", "2026-10-01"),
    /rango válido/,
  );
  const nocturno = "2026-10-15T02:30:00.000Z";
  const { withinRange } = await import("../codigo/utilidades/reportesPdf.js");
  assert.equal(withinRange(nocturno, "2026-10-14", "2026-10-14"), true);
  assert.equal(withinRange(nocturno, "2026-10-15", "2026-10-15"), false);
  assert.equal(
    reportRows(
      s,
      [
        {
          fecha_hora: nocturno,
          id_empleado: "TEST",
          nombre_completo: "Noche",
          movimiento: "ENTRADA",
        },
      ],
      "attendance",
      "2026-10-14",
      "2026-10-14",
    ).length,
    1,
  );
});
