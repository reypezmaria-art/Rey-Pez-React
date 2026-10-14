import { logTypes } from "../datos/operacionInicial.js";
import { canCapture } from "./seguridad.js";
import { localDate } from "../utilidades/fechas.js";
import { isWorkingDay, timeToMinutes } from "./asistencia.js";
export const temperatureStatus = (n) =>
  n <= -25
    ? "Óptimo"
    : n >= -19
      ? "Requiere atención"
      : "Variación en observación";
export function saveLog(state, form, session) {
  if (!canCapture(state, session, form.company, form.type))
    throw Error("No tienes permiso para esta empresa y bitácora.");
  const date = new Date(form.when);
  if (
    !logTypes[form.type] ||
    !form.area ||
    !form.when ||
    Number.isNaN(date.getTime())
  )
    throw Error("Completa bitácora, área y fecha/hora.");
  const area = [...state.rooms, ...state.areas].find(
    (a) =>
      a.id === form.area && a.company === form.company && a.active !== false,
  );
  if (
    !area ||
    (form.type === "temperature" &&
      !state.rooms.some((r) => r.id === form.area))
  )
    throw Error("Selecciona un área o cuarto autorizado.");
  if (form.notApplicable && !form.notes.trim())
    throw Error("Indica el motivo de No aplica.");
  if (
    !form.notApplicable &&
    (String(form.value).trim() === "" ||
      (form.type === "temperature" && !Number.isFinite(Number(form.value))))
  )
    throw Error("Captura el resultado de la revisión.");
  if (form.programKey) {
    const valid = state.programs.some(
      (p) =>
        p.active &&
        p.company === form.company &&
        p.area === form.area &&
        p.type === form.type &&
        p.days.includes(date.getDay()) &&
        p.times.some(
          (t) => form.programKey === `${p.id}-${localDate(date)}-${t}`,
        ),
    );
    if (!valid)
      throw Error(
        "La revisión programada no corresponde al área, fecha o bitácora.",
      );
    if (state.logs.some((l) => l.programKey === form.programKey))
      throw Error(
        "Esa revisión programada ya fue registrada. Conserva su historial.",
      );
  }
  const result = form.notApplicable
    ? "No aplica"
    : form.type === "temperature"
      ? temperatureStatus(Number(form.value))
      : String(form.value).trim();
  const record = {
    ...form,
    id: crypto.randomUUID(),
    when: date.toISOString(),
    result,
    createdAt: new Date().toISOString(),
    createdBy: session.id,
    responsible: session.name,
  };
  return {
    ...state,
    logs: [record, ...state.logs],
    audit: [
      {
        id: record.id,
        action: "Bitácora registrada",
        by: session.id,
        when: record.createdAt,
      },
      ...state.audit,
    ],
  };
}
export function pendingPrograms(state, now = new Date()) {
  if (!isWorkingDay(now, state.holidays)) return [];
  const date = localDate(now),
    minute = now.getHours() * 60 + now.getMinutes();
  return state.programs
    .filter(
      (p) =>
        p.active &&
        p.days.includes(now.getDay()) &&
        state.rooms
          .concat(state.areas)
          .some((a) => a.id === p.area && a.active !== false),
    )
    .flatMap((p) =>
      p.times
        .filter((t) => timeToMinutes(t) <= minute)
        .map((t) => ({ ...p, time: t, date, key: `${p.id}-${date}-${t}` })),
    )
    .filter(
      (p) =>
        !state.logs.some(
          (l) =>
            l.company === p.company &&
            l.type === p.type &&
            l.area === p.area &&
            l.programKey === p.key,
        ),
    );
}
export function saveMaintenance(state, form, session) {
  if (session?.role !== "admin")
    throw Error("Solo María administra mantenimiento.");
  if (
    !state.rooms.some((r) => r.id === form.room && r.active) ||
    !form.description.trim() ||
    !form.when
  )
    throw Error("Completa cuarto, fecha y descripción.");
  if (
    form.cost !== "" &&
    (!Number.isFinite(Number(form.cost)) || Number(form.cost) < 0)
  )
    throw Error("El costo debe ser un número mayor o igual a cero.");
  return {
    ...state,
    maintenance: [
      {
        ...form,
        id: crypto.randomUUID(),
        cost: form.cost === "" ? null : Number(form.cost),
        createdBy: session.id,
        createdAt: new Date().toISOString(),
      },
      ...state.maintenance,
    ],
  };
}
