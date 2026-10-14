import { isSameDay, localDate } from "../utilidades/fechas.js";
export function timeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}
export function scheduleForEmployee(
  employee,
  schedules,
  now = new Date(),
  exceptions = [],
) {
  const date = localDate(now);
  const exception = exceptions.find(
    (e) => e.employeeId === employee.id_empleado && e.date === date,
  );
  const eligible = schedules
    .map((s) => {
      let current = s;
      while (current?.vigente_desde && current.vigente_desde > date)
        current = current.previousSchedule;
      return current;
    })
    .filter(Boolean);
  let schedule = eligible.find(
    (s) => s.codigo === (exception?.scheduleCode || employee.codigo_horario),
  );
  if (!schedule && /PEDRO MART[IÍ]N/i.test(employee.nombre_completo))
    schedule = eligible.find((s) => s.codigo === "EDG-PED");
  if (!schedule) {
    const suffix = /ADMIN/i.test(`${employee.puesto} ${employee.tipo_puesto}`)
      ? "ADM"
      : "GEN";
    schedule = eligible.find(
      (s) =>
        s.empresa_codigo === employee.empresa_codigo &&
        s.codigo.endsWith(suffix),
    );
    if (!schedule && employee.empresa_codigo === "EDGAR")
      schedule = eligible.find((s) => s.codigo === "EDG-ROT");
  }
  if (!schedule) return undefined;
  if (!schedule.rotativo || exception) return { ...schedule };
  const [y, m, d] = (schedule.rotacion_desde || "2026-09-28")
    .split("-")
    .map(Number);
  const days = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(y, m - 1, d)) /
      86400000,
  );
  const index = ((Math.floor(days / 7) % 3) + 3) % 3;
  const shifts = [
    ["06:00", "14:00", "10:00", "10:30"],
    ["09:00", "17:00", "13:00", "13:30"],
    ["12:00", "20:00", "16:00", "16:30"],
  ];
  const [hora_inicio, hora_fin, comida_inicio, comida_fin] = shifts[index];
  return {
    ...schedule,
    hora_inicio,
    hora_fin,
    comida_inicio,
    comida_fin,
    comida_minutos: 30,
    semana_rotacion: index + 1,
  };
}
export function isWorkingDay(now, holidays = []) {
  return now.getDay() !== 0 && !holidays.includes(localDate(now));
}
export function scheduledEvent(
  employee,
  schedules,
  attendance,
  now = new Date(),
  exceptions = [],
) {
  const schedule = scheduleForEmployee(employee, schedules, now, exceptions);
  const last = attendance
    .filter(
      (a) =>
        a.id_empleado === employee.id_empleado &&
        isSameDay(a.fecha_hora, now) &&
        a.movimiento !== "REVISION_ADMINISTRATIVA",
    )
    .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))[0];
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(schedule?.hora_inicio),
    end = timeToMinutes(schedule?.hora_fin);
  const tolerance = Number(schedule?.tolerancia_minutos ?? 10);
  const within = (target) =>
    target !== null && Math.abs(current - target) <= tolerance;
  if (!last || last.movimiento === "SALIDA_FINAL")
    return { movement: "ENTRADA", label: "Entrada", expected: within(start) };
  if (last.movimiento === "ENTRADA") {
    if (end !== null && current >= end - 60)
      return {
        movement: "SALIDA_FINAL",
        label: "Salida de turno",
        expected: within(end),
      };
    return {
      movement: "SALIDA_A_COMER",
      label: "Salida a comer",
      expected: true,
    };
  }
  if (last.movimiento === "SALIDA_A_COMER") {
    const duration =
      Number(schedule?.comida_minutos) ||
      (timeToMinutes(schedule?.comida_fin) ?? 0) -
        (timeToMinutes(schedule?.comida_inicio) ?? 0) ||
      30;
    const elapsed = (now - new Date(last.fecha_hora)) / 60000;
    return {
      movement: "REGRESO_DE_COMER",
      label: "Regreso de comer",
      expected: elapsed >= 0 && elapsed <= duration + tolerance,
    };
  }
  return {
    movement: "SALIDA_FINAL",
    label: "Salida de turno",
    expected: within(end),
  };
}
export function pendingAbsences(state, now = new Date()) {
  if (!isWorkingDay(now, state.holidays || [])) return [];
  return state.employees.filter((e) => {
    if (
      e.estatus === "Baja" ||
      (e.fecha_ingreso &&
        /^\d{4}-/.test(e.fecha_ingreso) &&
        e.fecha_ingreso > localDate(now))
    )
      return false;
    const s = scheduleForEmployee(
      e,
      state.schedules,
      now,
      state.scheduleExceptions,
    );
    const start = timeToMinutes(s?.hora_inicio);
    return (
      start !== null &&
      now.getHours() * 60 + now.getMinutes() >
        start + Number(s?.tolerancia_minutos ?? 10) &&
      !state.attendance.some(
        (a) =>
          a.id_empleado === e.id_empleado &&
          isSameDay(a.fecha_hora, now) &&
          a.movimiento === "ENTRADA",
      ) &&
      !(state.absenceReviews || []).some(
        (r) => r.employeeId === e.id_empleado && r.date === localDate(now),
      )
    );
  });
}
