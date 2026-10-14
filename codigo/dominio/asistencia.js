import { isSameDay } from "../utilidades/fechas.js";

export function scheduleForEmployee(employee, schedules) {
  const direct = schedules.find((s) => s.codigo === employee.codigo_horario);
  if (direct) return direct;
  if (
    employee.empresa_codigo === "EDGAR" &&
    /PEDRO MART[IÍ]N/i.test(employee.nombre_completo)
  )
    return schedules.find((s) => s.codigo === "EDG-PED");
  if (/ADMIN/i.test(`${employee.puesto} ${employee.tipo_puesto}`))
    return (
      schedules.find(
        (s) =>
          s.empresa_codigo === employee.empresa_codigo &&
          s.codigo.endsWith("ADM"),
      ) || schedules.find((s) => s.codigo === "EST-ADM")
    );
  if (employee.empresa_codigo === "EDGAR")
    return schedules.find((s) => s.codigo === "EDG-ROT");
  return (
    schedules.find(
      (s) =>
        s.empresa_codigo === employee.empresa_codigo &&
        s.codigo.endsWith("GEN"),
    ) || schedules[0]
  );
}
export function timeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}
const close = (time, target, tolerance) =>
  time !== null && target !== null && Math.abs(time - target) <= tolerance;

// Las revisiones administrativas no alteran la secuencia del trabajador.
export function scheduledEvent(
  employee,
  schedules,
  attendance,
  now = new Date(),
) {
  const schedule = scheduleForEmployee(employee, schedules);
  const last = attendance
    .filter(
      (a) =>
        a.id_empleado === employee.id_empleado &&
        isSameDay(a.fecha_hora, now) &&
        a.movimiento !== "REVISION_ADMINISTRATIVA",
    )
    .sort(
      (a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora),
    )[0]?.movimiento;
  if (!schedule)
    return { movement: "ENTRADA", label: "Entrada", expected: false };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(schedule.hora_inicio),
    end = timeToMinutes(schedule.hora_fin);
  const mealStart = timeToMinutes(schedule.comida_inicio),
    mealEnd = timeToMinutes(schedule.comida_fin);
  if (!last || last === "SALIDA_FINAL")
    return {
      movement: "ENTRADA",
      label: "Entrada",
      expected: close(current, start, 90),
    };
  if (last === "ENTRADA") {
    if (
      mealStart !== null &&
      current >= mealStart - 30 &&
      (mealEnd === null || current < mealEnd + 120)
    )
      return {
        movement: "SALIDA_A_COMER",
        label: "Salida a comer",
        expected: close(current, mealStart, 30),
      };
    if (end !== null && current >= end - 60)
      return {
        movement: "SALIDA_FINAL",
        label: "Salida de turno",
        expected: close(current, end, 30),
      };
    return {
      movement: "SALIDA_A_COMER",
      label: "Salida a comer",
      expected: false,
    };
  }
  if (last === "SALIDA_A_COMER")
    return {
      movement: "REGRESO_DE_COMER",
      label: "Regreso de comer",
      expected: mealEnd === null || close(current, mealEnd, 30),
    };
  if (last === "REGRESO_DE_COMER")
    return {
      movement: "SALIDA_FINAL",
      label: "Salida de turno",
      expected: close(current, end, 30),
    };
  return { movement: "ENTRADA", label: "Entrada", expected: false };
}
