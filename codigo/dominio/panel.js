import { calendarDate, isSameDay } from "../utilidades/fechas.js";
import { pendingAbsences } from "./asistencia.js";
import { pendingPrograms } from "./bitacoras.js";
import { nombresEmpresas } from "./empresas.js";
import { companyNames } from "../datos/constantes.js";
const empresaRegistrada = (a) =>
  Object.hasOwn(companyNames, a.empresa_codigo || a.company)
    ? a.empresa_codigo || a.company
    : "";

export function personalDeHoy(data, clock) {
  const registros = [...data.attendance]
    .filter(
      (a) =>
        isSameDay(a.fecha_hora, clock) &&
        a.movimiento !== "REVISION_ADMINISTRATIVA",
    )
    .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)));
  return data.employees
    .filter((e) => e.estatus !== "Baja")
    .map((e) => ({
      ...e,
      movimientoHoy:
        registros.find((r) => r.id_empleado === e.id_empleado)?.movimiento ||
        "SIN_ENTRADA",
    }));
}
export function pendientesPanel(data, clock) {
  return [
    ...(data.alerts || [])
      .filter((a) => a.estado === "Pendiente")
      .map((a) => ({
        id: `asistencia-${a.id_alerta}`,
        tipo: a.tipo,
        nombre: a.nombre_completo || a.id_empleado,
        company: a.empresa_codigo || "",
        detalle: a.detalle,
        fecha: a.fecha_hora,
        destino: "attendance",
      })),
    ...(data.securityAlerts || [])
      .filter((a) => a.estado !== "Revisada")
      .map((a) => ({
        id: `seguridad-${a.id_alerta}`,
        tipo: a.tipo,
        nombre: a.nombre_completo || a.id_empleado,
        company: a.empresa_codigo || "",
        detalle: a.detalle,
        fecha: a.fecha_hora,
        destino: "security",
      })),
    ...pendingAbsences(data, clock).map((e) => ({
      id: `ausencia-${e.id_empleado}`,
      tipo: "Ausencia pendiente de revisión",
      nombre: e.nombre_completo,
      company: e.empresa_codigo,
      detalle: "Sin entrada registrada para el turno de hoy.",
      fecha: calendarDate(clock),
      destino: "attendance",
    })),
    ...(data.logs || [])
      .filter((l) => l.expiry && l.expiry < calendarDate(clock))
      .map((l) => ({
        id: `certificado-${l.id}`,
        tipo: "Certificado vencido",
        nombre: l.area || l.type || "Bitácora",
        company: l.company || "",
        detalle: `Venció el ${l.expiry}.`,
        fecha: l.expiry,
        destino: l.type?.startsWith("epp") ? "epp" : "logs",
      })),
    ...pendingPrograms(data, clock).map((p) => ({
      id: `bitacora-${p.key}`,
      tipo: "Bitácora pendiente",
      nombre: p.area,
      company: p.company,
      detalle: `${p.type} · ${p.time}`,
      fecha: p.date,
      destino: p.type.startsWith("epp") ? "epp" : "logs",
    })),
  ];
}
export function incidenciasRegistradas(data) {
  return [
    ...(data.alerts || []).map((a) => ({
      id: `asistencia-${a.id_alerta}`,
      company: empresaRegistrada(a),
      fecha: a.fecha_hora,
      tipo: a.tipo,
      nombre: a.nombre_completo || a.id_empleado,
      detalle: a.detalle,
      estado: a.estado || "Pendiente",
    })),
    ...(data.absenceReviews || []).map((a) => ({
      id: `revision-${a.id}`,
      company: empresaRegistrada(a),
      fecha: a.date || a.when,
      tipo: a.classification,
      nombre: a.name || a.employeeId,
      detalle: a.notes,
      estado: "Revisada",
    })),
    ...(data.securityAlerts || []).map((a) => ({
      id: `seguridad-${a.id_alerta}`,
      company: empresaRegistrada(a),
      fecha: a.fecha_hora,
      tipo: a.tipo,
      nombre: a.nombre_completo || a.id_empleado,
      detalle: a.detalle,
      estado: a.estado || "Pendiente",
    })),
  ];
}
export function rangoPeriodo(tipo, valor) {
  if (tipo === "mes") {
    if (!/^\d{4}-\d{2}$/.test(valor)) return null;
    const inicio = new Date(`${valor}-01T12:00:00Z`);
    if (Number.isNaN(+inicio) || inicio.toISOString().slice(0, 7) !== valor)
      return null;
    const fin = new Date(
      Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0, 12),
    );
    return { desde: `${valor}-01`, hasta: fin.toISOString().slice(0, 10) };
  }
  const fecha = new Date(`${valor}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    Number.isNaN(+fecha) ||
    fecha.toISOString().slice(0, 10) !== valor
  )
    return null;
  fecha.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));
  const desde = fecha.toISOString().slice(0, 10);
  fecha.setUTCDate(fecha.getUTCDate() + 6);
  return { desde, hasta: fecha.toISOString().slice(0, 10) };
}
export function filtrarIncidencias(data, rango, company) {
  if (!rango) return [];
  return incidenciasRegistradas(data)
    .filter((r) => {
      const fecha = calendarDate(r.fecha);
      return (
        fecha &&
        fecha >= rango.desde &&
        fecha <= rango.hasta &&
        (company === undefined || r.company === company)
      );
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
export function contarIncidencias(data, rango) {
  const registros = filtrarIncidencias(data, rango);
  const nombres = nombresEmpresas(data);
  const grupos = Object.entries(nombres).map(([codigo, nombre]) => ({
    codigo,
    nombre,
    total: registros.filter((r) => r.company === codigo).length,
  }));
  const sinEmpresa = registros.filter(
    (r) => !Object.hasOwn(nombres, r.company),
  ).length;
  if (sinEmpresa)
    grupos.push({
      codigo: "",
      nombre: "Sin empresa registrada",
      total: sinEmpresa,
    });
  return grupos;
}
