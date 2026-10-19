import { baseOperation } from "../datos/operacionInicial.js";
import { defaultSchedules } from "../datos/horariosIniciales.js";
import { migrateState } from "./repositorioLocal.js";

export const COLECCIONES = [
  { estado: "employees", coleccion: "empleados", id: "id_empleado" },
  { estado: "attendance", coleccion: "asistencia", id: "id_registro" },
  { estado: "alerts", coleccion: "alertas", id: "id_alerta" },
  { estado: "schedules", coleccion: "horarios", id: "codigo" },
  { estado: "logs", coleccion: "bitacoras", id: "id" },
  { estado: "maintenance", coleccion: "mantenimiento", id: "id" },
  { estado: "absenceReviews", coleccion: "revisiones", id: "id" },
  { estado: "audit", coleccion: "auditoria", id: "id" },
];
export const CAMPOS_OPERACION = [
  "rooms",
  "areas",
  "programs",
  "holidays",
  "terminals",
  "scheduleExceptions",
  "schemaVersion",
  "structureVersion",
  "roomCatalogVersion",
  "chlorineAreaVersion",
  "catalogSource",
  "version",
];
const RECIENTES = {
  attendance: "fecha_hora",
  alerts: "fecha_hora",
  logs: "createdAt",
  maintenance: "createdAt",
  absenceReviews: "when",
  audit: "when",
};

export function correoDeCuenta(id, dominio) {
  const local = String(id || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(local))
    throw Error("El ID contiene caracteres que no se pueden usar como cuenta.");
  return `${local}@${dominio}`;
}
export function correoTerminal(deviceId, dominio) {
  return correoDeCuenta(`terminal-${deviceId}`, dominio);
}
export function datosFirestore(valor) {
  return JSON.parse(JSON.stringify(valor ?? null));
}
function visitarEvidencias(valor, visitar) {
  if (!valor || typeof valor !== "object") return valor;
  if (Array.isArray(valor))
    return valor.map((item) => visitarEvidencias(item, visitar));
  const copia = { ...valor };
  if (copia.evidence && typeof copia.evidence === "object")
    copia.evidence = visitar(copia.evidence);
  return copia;
}
export function sinDatosDeAdjunto(valor) {
  return visitarEvidencias(datosFirestore(valor), (evidence) => {
    if (!evidence?.path) return evidence;
    const { data: _data, ...resto } = evidence;
    return resto;
  });
}
export function idDocumento(item, campo, indice) {
  const valor = item?.[campo];
  const texto = valor ? String(valor) : `pendiente-${indice}`;
  if (texto.includes("/"))
    throw Error("El identificador no puede contener barras.");
  return texto;
}
function mapaDe(lista, campo) {
  const mapa = new Map();
  (lista || []).forEach((item, indice) => {
    mapa.set(idDocumento(item, campo, indice), sinDatosDeAdjunto(item));
  });
  return mapa;
}
export function configuracionDe(state) {
  const config = {};
  for (const campo of CAMPOS_OPERACION) {
    if (state?.[campo] !== undefined) config[campo] = state[campo];
  }
  config.permissions = state?.access?.permissions || {};
  return datosFirestore(config);
}
export function diferencias(antes, despues) {
  const operaciones = [];
  for (const coleccion of COLECCIONES) {
    const previo = mapaDe(antes?.[coleccion.estado], coleccion.id);
    const siguiente = mapaDe(despues?.[coleccion.estado], coleccion.id);
    for (const [id, item] of siguiente) {
      if (JSON.stringify(previo.get(id)) !== JSON.stringify(item))
        operaciones.push({
          tipo: "set",
          coleccion: coleccion.coleccion,
          id,
          datos: item,
        });
    }
    for (const id of previo.keys()) {
      if (!siguiente.has(id))
        operaciones.push({
          tipo: "delete",
          coleccion: coleccion.coleccion,
          id,
        });
    }
  }
  const configPrevia = JSON.stringify(configuracionDe(antes));
  const configSiguiente = configuracionDe(despues);
  if (configPrevia !== JSON.stringify(configSiguiente))
    operaciones.push({
      tipo: "set",
      coleccion: "operacion",
      id: "config",
      datos: configSiguiente,
    });
  return operaciones;
}
export function cambiosDeIdentidad(antes, despues) {
  const previo = new Map(
    Object.entries(antes?.access?.workers || {})
      .filter(([, worker]) => worker?.uid)
      .map(([id, worker]) => [worker.uid, id]),
  );
  const cambios = [];
  for (const [id, worker] of Object.entries(despues?.access?.workers || {})) {
    if (!worker?.uid) continue;
    if (previo.get(worker.uid) && previo.get(worker.uid) !== id)
      cambios.push({ uid: worker.uid, idEmpleado: id });
  }
  return cambios;
}
export function trabajadoresDesde(usuarios) {
  const workers = {};
  for (const usuario of usuarios || []) {
    if (usuario.rol === "trabajador" && usuario.idEmpleado)
      workers[usuario.idEmpleado] = {
        active: usuario.activo !== false,
        uid: usuario.uid,
      };
  }
  return workers;
}
function porReciente(lista, campo) {
  if (!campo) return lista;
  return [...lista].sort((a, b) =>
    String(b[campo] || "").localeCompare(String(a[campo] || "")),
  );
}
export function armarEstado({
  listas = {},
  config = null,
  usuarios = [],
  adminUid = null,
}) {
  const state = {
    ...structuredClone(baseOperation),
    employees: listas.employees || [],
    attendance: porReciente(listas.attendance || [], RECIENTES.attendance),
    schedules: listas.schedules ?? structuredClone(defaultSchedules),
    alerts: porReciente(listas.alerts || [], RECIENTES.alerts),
    logs: porReciente(listas.logs || [], RECIENTES.logs),
    maintenance: porReciente(listas.maintenance || [], RECIENTES.maintenance),
    absenceReviews: porReciente(
      listas.absenceReviews || [],
      RECIENTES.absenceReviews,
    ),
    audit: porReciente(listas.audit || [], RECIENTES.audit),
    access: {
      admin: adminUid ? { active: true, uid: adminUid } : null,
      workers: trabajadoresDesde(usuarios),
      permissions: config?.permissions || {},
    },
  };
  if (config) {
    for (const campo of CAMPOS_OPERACION) {
      if (config[campo] !== undefined) state[campo] = config[campo];
    }
  }
  return state;
}
export function estadoPublico(adminUid) {
  return armarEstado({ adminUid, listas: { schedules: [] } });
}
export function catalogoParaImportar(state, uidAdmin) {
  const migrado = migrateState(state);
  return {
    ...migrado,
    employees: migrado.employees.filter(
      (empleado) => !/^EMPLEADO DEMO/.test(empleado.nombre_completo || ""),
    ),
    access: {
      admin: uidAdmin ? { active: true, uid: uidAdmin } : null,
      workers: {},
      permissions: migrado.access?.permissions || {},
    },
  };
}
export function rutasDeEvidencia(valor, visitar) {
  if (!valor || typeof valor !== "object") return;
  if (Array.isArray(valor)) {
    valor.forEach((item) => rutasDeEvidencia(item, visitar));
    return;
  }
  if (
    valor.evidence?.path &&
    !String(valor.evidence.data || "").startsWith("http")
  )
    visitar(valor.evidence);
  if (
    valor.evidence?.data &&
    String(valor.evidence.data).startsWith("data:") &&
    !valor.evidence.path
  )
    visitar(valor.evidence);
}
