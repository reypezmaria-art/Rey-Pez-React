import { canCapture, puedeVerNomina } from "./seguridad.js";

export const LIMITE_INTENTOS = 4;
export const TEXTO_BLOQUEO = "Comunícate con el personal autorizado";

export function errorBloqueo() {
  return Object.assign(Error(`Demasiados intentos. ${TEXTO_BLOQUEO}.`), {
    code: "acceso/bloqueado",
  });
}
export function alertaSeguridad(state, id, tipo, detalle, modulo = "acceso") {
  const empleado = state.employees.find((e) => e.id_empleado === id);
  return {
    id_alerta: crypto.randomUUID(),
    id_empleado: id,
    nombre_completo: empleado?.nombre_completo || id,
    empresa_codigo: empleado?.empresa_codigo || "",
    tipo,
    detalle,
    modulo,
    fecha_hora: new Date().toISOString(),
    estado: "Pendiente",
    seguridad: true,
  };
}
export function registrarIntentoLocal(state, id, correcto) {
  const admin = id === "MARIA";
  const cuenta = admin ? state.access.admin : state.access.workers[id];
  if (!cuenta) return { state, bloqueado: false };
  if (cuenta.locked || cuenta.active === false)
    return { state, bloqueado: true };
  const intentos = correcto ? 0 : (cuenta.failedAttempts || 0) + 1;
  const bloqueado = intentos >= LIMITE_INTENTOS;
  const nueva = {
    ...cuenta,
    failedAttempts: intentos,
    locked: bloqueado,
    active: !bloqueado,
  };
  return {
    bloqueado,
    state: {
      ...state,
      access: {
        ...state.access,
        ...(admin
          ? { admin: nueva }
          : { workers: { ...state.access.workers, [id]: nueva } }),
      },
      securityAlerts: bloqueado
        ? [
            alertaSeguridad(
              state,
              id,
              "Cuenta bloqueada",
              "Cuatro intentos fallidos sobre esta cuenta. Requiere desbloqueo administrativo.",
            ),
            ...(state.securityAlerts || []),
          ]
        : state.securityAlerts || [],
    },
  };
}
export function destinoRestringido(state, session, hash) {
  if (session?.role !== "worker") return null;
  if (hash.startsWith("#nomina"))
    return puedeVerNomina(state, session) ? null : "nomina";
  if (!hash.startsWith("#captura")) return "administracion";
  const id = new URLSearchParams(hash.split("?")[1] || "").get("area");
  const area = [...state.rooms, ...state.areas].find((a) => a.id === id);
  const permiso = state.access.permissions[session.id];
  if (id && (!area || area.active === false)) return id;
  if (area) {
    const cuarto = state.rooms.some((r) => r.id === id);
    const autorizado = cuarto
      ? canCapture(state, session, area.company, "temperature")
      : (permiso?.logs || []).some((tipo) =>
          canCapture(state, session, area.company, tipo),
        );
    return autorizado ? null : id;
  }
  return (permiso?.logs || []).some((tipo) =>
    canCapture(state, session, permiso.company, tipo),
  )
    ? null
    : "bitacoras";
}
