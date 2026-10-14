import { companyNames } from "../datos/constantes.js";
import { scheduleForEmployee, scheduledEvent } from "./asistencia.js";
import { isSameDay, localDate } from "../utilidades/fechas.js";

export function generateEmployeeId(employees) {
  const used = new Set(employees.map((e) => e.id_empleado));
  let next = 1;
  while (used.has(`RP-${String(next).padStart(4, "0")}`)) next++;
  return `RP-${String(next).padStart(4, "0")}`;
}
export function saveEmployee(state, employee, originalId) {
  const name = employee.nombre_completo.trim(),
    role = employee.puesto.trim();
  const id =
    employee.id_empleado.trim().toUpperCase() ||
    originalId ||
    generateEmployeeId(state.employees);
  if (!name || !role || !companyNames[employee.empresa_codigo])
    throw Error("Completa nombre, empresa y puesto/función.");
  if (
    state.employees.some(
      (e) => e.id_empleado === id && e.id_empleado !== originalId,
    )
  )
    throw Error("Ese ID ya está asignado a otro empleado.");
  const value = {
    ...employee,
    id_empleado: id,
    nombre_completo: name,
    puesto: role,
    curp: (employee.curp || "").trim().toUpperCase(),
    nss: (employee.nss || "").trim(),
    empresa_nombre: companyNames[employee.empresa_codigo],
    tipo_puesto: /ADMIN/i.test(role) ? "Administrativo" : "General",
  };
  return {
    ...state,
    employees: originalId
      ? state.employees.map((e) => (e.id_empleado === originalId ? value : e))
      : [...state.employees, value],
    attendance: state.attendance.map((a) =>
      originalId && a.id_empleado === originalId
        ? { ...a, id_empleado: id }
        : a,
    ),
    alerts: state.alerts.map((a) =>
      originalId && a.id_empleado === originalId
        ? { ...a, id_empleado: id }
        : a,
    ),
  };
}
export function assignMissingIds(state) {
  const employees = [...state.employees];
  for (let i = 0; i < employees.length; i++)
    if (!employees[i].id_empleado)
      employees[i] = {
        ...employees[i],
        id_empleado: generateEmployeeId(employees),
      };
  return { ...state, employees };
}
export const terminateEmployee = (state, id) => ({
  ...state,
  employees: state.employees.map((e) =>
    e.id_empleado === id
      ? { ...e, estatus: "Baja", fecha_baja: localDate() }
      : e,
  ),
});
export function saveSchedule(state, schedule, originalCode) {
  const value = {
    ...schedule,
    codigo: schedule.codigo.trim().toUpperCase(),
    nombre: schedule.nombre.trim(),
  };
  if (!value.codigo || !value.nombre)
    throw Error("Completa código y nombre del horario.");
  if (
    state.schedules.some(
      (s) => s.codigo === value.codigo && s.codigo !== originalCode,
    )
  )
    throw Error("Ese código ya existe.");
  return {
    ...state,
    schedules: originalCode
      ? state.schedules.map((s) => (s.codigo === originalCode ? value : s))
      : [...state.schedules, value],
    employees: state.employees.map((e) =>
      originalCode && e.codigo_horario === originalCode
        ? { ...e, codigo_horario: value.codigo }
        : e,
    ),
  };
}
export function deleteSchedule(state, code) {
  if (
    state.employees.some(
      (e) => scheduleForEmployee(e, state.schedules)?.codigo === code,
    )
  )
    throw Error(
      "Hay empleados asignados a este horario. Cambia su horario antes de eliminarlo.",
    );
  return {
    ...state,
    schedules: state.schedules.filter((s) => s.codigo !== code),
  };
}
export function recordAttendance(state, id, password, now = new Date()) {
  const employee = state.employees.find(
    (e) => e.id_empleado === id.trim().toUpperCase(),
  );
  if (!id.trim()) throw Error("Escribe tu ID de empleado.");
  if (!employee)
    throw Error("No se encontró ese ID. Solicita apoyo a administración.");
  if ((employee.estatus || "Activo") !== "Activo")
    throw Error("La cuenta no está activa. Consulta a administración.");
  if (password)
    throw Error(
      "La contraseña aún no se valida en esta versión de prueba. Deja el campo vacío; no uses una contraseña real.",
    );
  const event = scheduledEvent(
    employee,
    state.schedules,
    state.attendance,
    now,
  );
  const record = {
    id_registro: crypto.randomUUID(),
    id_empleado: employee.id_empleado,
    nombre_completo: employee.nombre_completo,
    empresa_codigo: employee.empresa_codigo,
    movimiento: event.movement,
    fecha_hora: now.toISOString(),
    incidencia: "",
    estado_sincronizacion: "Local - no sincronizado",
  };
  const alerts = [...state.alerts];
  const addAlert = (type, detail) =>
    alerts.unshift({
      ...record,
      id_alerta: crypto.randomUUID(),
      tipo: type,
      detalle: detail,
      estado: "Pendiente",
    });
  if (
    state.attendance.some(
      (a) =>
        a.id_empleado === employee.id_empleado &&
        isSameDay(a.fecha_hora, now) &&
        a.movimiento === event.movement,
    )
  )
    addAlert(
      "Marcación repetida",
      "Registro repetido; requiere revisión administrativa.",
    );
  if (!event.expected)
    addAlert(
      "Revisión de horario",
      "Marcación fuera del intervalo previsto. Revisar contexto; no implica autorización automática de tiempo extra.",
    );
  return {
    state: { ...state, attendance: [record, ...state.attendance], alerts },
    employee,
    event,
    now,
  };
}
export function saveManualIncident(state, form) {
  const employee = state.employees.find(
    (e) => e.id_empleado === form.employeeId,
  );
  const date = new Date(form.when);
  if (
    !employee ||
    !form.when ||
    Number.isNaN(date.getTime()) ||
    !form.reviewer.trim() ||
    !form.reason.trim()
  )
    throw Error("Completa empleado, fecha/hora, quién revisa y motivo.");
  const record = {
    id_registro: crypto.randomUUID(),
    id_empleado: employee.id_empleado,
    nombre_completo: employee.nombre_completo,
    empresa_codigo: employee.empresa_codigo,
    movimiento: "REVISION_ADMINISTRATIVA",
    fecha_hora: date.toISOString(),
    incidencia: `${form.type} — ${form.reason.trim()} | Revisó: ${form.reviewer.trim()}`,
    estado_sincronizacion: "Local - no sincronizado",
  };
  return {
    ...state,
    attendance: [record, ...state.attendance],
    alerts: [
      {
        ...record,
        id_alerta: crypto.randomUUID(),
        tipo: form.type,
        detalle: `${form.reason.trim()} | Revisó: ${form.reviewer.trim()}`,
        estado: "Revisada",
      },
      ...state.alerts,
    ],
  };
}
export const reviewAlerts = (state) => ({
  ...state,
  alerts: state.alerts.map((a) => ({ ...a, estado: "Revisada" })),
});
