import { baseOperation } from "../datos/operacionInicial.js";
import { defaultSchedules } from "../datos/horariosIniciales.js";
import { migrateState } from "./repositorioLocal.js";

export const COLECCIONES = [
  { estado: "companies", coleccion: "empresas", id: "codigo" },
  { estado: "employees", coleccion: "empleados", id: "id_empleado" },
  { estado: "attendance", coleccion: "asistencia", id: "id_registro" },
  { estado: "alerts", coleccion: "alertas", id: "id_alerta" },
  { estado: "schedules", coleccion: "horarios", id: "codigo" },
  { estado: "logs", coleccion: "bitacoras", id: "id" },
  { estado: "maintenance", coleccion: "mantenimiento", id: "id" },
  { estado: "absenceReviews", coleccion: "revisiones", id: "id" },
  { estado: "audit", coleccion: "auditoria", id: "id" },
  { estado: "securityAlerts", coleccion: "alertasSeguridad", id: "id_alerta" },
];
export const CAMPOS_OPERACION = [
  "companyDirectory",
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
    companies: listas.companies || [],
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
    securityAlerts: porReciente(listas.securityAlerts || [], "fecha_hora"),
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
export const CORREO_MARIA = "maria@acceso.reypez.app";
export const MOVIMIENTOS_TURNO = [
  "ENTRADA",
  "SALIDA_A_COMER",
  "REGRESO_DE_COMER",
  "SALIDA_FINAL",
];
export const DESFASE_GUATEMALA_MS = 6 * 60 * 60 * 1000;
export const DIA_MS = 24 * 60 * 60 * 1000;
export const VENTANA_PASADO_MS = 20 * 60 * 60 * 1000;
export const VENTANA_FUTURO_MS = 15 * 60 * 1000;
export const AVISOS_COPIA = {
  conservar:
    "Este navegador y Firebase ya tienen información. No se copió ni se reemplazó nada.",
  copiar:
    "Se copió a Firebase la información de este navegador, sin contraseñas ni empleados de demostración.",
};

export function correoEsDeMaria(email) {
  return (
    String(email || "")
      .trim()
      .toLowerCase() === CORREO_MARIA
  );
}
export function diaGuatemala(ms) {
  return Math.floor((ms - DESFASE_GUATEMALA_MS) / DIA_MS);
}
export function fechaLocalGuatemala(ms) {
  return new Date(diaGuatemala(ms) * DIA_MS).toISOString().slice(0, 10);
}
export function tieneOperacionPropia(state) {
  return [
    "employees",
    "attendance",
    "logs",
    "maintenance",
    "absenceReviews",
    "audit",
  ].some((clave) => Array.isArray(state?.[clave]) && state[clave].length > 0);
}
export function decidirCopiaLocal({ localTieneOperacion, nubeTieneOperacion }) {
  if (nubeTieneOperacion && localTieneOperacion) return "conservar";
  if (!nubeTieneOperacion && localTieneOperacion) return "copiar";
  if (!nubeTieneOperacion) return "sembrar";
  return "nada";
}
export function marcaOperativa(record, ahora = Date.now()) {
  if (!record || !MOVIMIENTOS_TURNO.includes(record.movimiento)) return false;
  const ms = Date.parse(record.fecha_hora);
  if (!Number.isFinite(ms)) return false;
  return ms <= ahora + VENTANA_FUTURO_MS && ms >= ahora - VENTANA_PASADO_MS;
}
export function enriquecerMarca(record, ahora = Date.now()) {
  if (!marcaOperativa(record, ahora)) return record;
  const ms = Date.parse(record.fecha_hora);
  return {
    ...record,
    fecha_ms: ms,
    fecha_local: fechaLocalGuatemala(ms),
    fecha_dia: diaGuatemala(ms),
  };
}
export function enriquecerAsistenciaNueva(antes, despues, ahora = Date.now()) {
  const previos = new Set(
    (antes?.attendance || []).map((item) => item?.id_registro),
  );
  return {
    ...despues,
    attendance: (despues?.attendance || []).map((item) =>
      previos.has(item?.id_registro) ? item : enriquecerMarca(item, ahora),
    ),
  };
}
export function cursoresDeAsistencia(antes, despues) {
  const previos = new Set(
    (antes?.attendance || []).map((item) => item?.id_registro),
  );
  const porEmpleado = new Map();
  for (const record of despues?.attendance || []) {
    if (!record?.id_registro || previos.has(record.id_registro)) continue;
    if (
      !Number.isInteger(record.fecha_ms) ||
      !Number.isInteger(record.fecha_dia)
    )
      continue;
    const actual = porEmpleado.get(record.id_empleado);
    if (!actual || record.fecha_ms >= actual.fecha_ms)
      porEmpleado.set(record.id_empleado, record);
  }
  return [...porEmpleado.values()].map((record) => ({
    tipo: "set",
    coleccion: "secuenciaAsistencia",
    id: record.id_empleado,
    datos: {
      ultimo: record.movimiento,
      fecha: record.fecha_local,
      fecha_dia: record.fecha_dia,
      registroId: record.id_registro,
      idEmpleado: record.id_empleado,
    },
  }));
}
export function cursoresFaltantes(
  attendance,
  idsExistentes,
  ahora = Date.now(),
) {
  const hoy = fechaLocalGuatemala(ahora);
  const tienen = new Set(idsExistentes || []);
  const ultimo = new Map();
  for (const record of attendance || []) {
    if (!MOVIMIENTOS_TURNO.includes(record?.movimiento)) continue;
    const ms = Date.parse(record.fecha_hora);
    if (!Number.isFinite(ms) || fechaLocalGuatemala(ms) !== hoy) continue;
    const previo = ultimo.get(record.id_empleado);
    if (!previo || ms >= previo.ms)
      ultimo.set(record.id_empleado, { ms, record });
  }
  const operaciones = [];
  for (const [idEmpleado, { ms, record }] of ultimo) {
    if (tienen.has(idEmpleado)) continue;
    operaciones.push({
      tipo: "set",
      coleccion: "secuenciaAsistencia",
      id: idEmpleado,
      datos: {
        ultimo: record.movimiento,
        fecha: fechaLocalGuatemala(ms),
        fecha_dia: diaGuatemala(ms),
        registroId: record.id_registro,
        idEmpleado,
      },
    });
  }
  return operaciones;
}
export function lotesAtomicos(operaciones, secuencia, tamano = 400) {
  const cursorPorRegistro = new Map(
    (secuencia || []).map((op) => [op.datos.registroId, op]),
  );
  const usados = new Set();
  const planos = [];
  for (const op of operaciones || []) {
    planos.push(op);
    if (op.coleccion === "asistencia" && op.tipo === "set") {
      const cursor = cursorPorRegistro.get(op.id);
      if (cursor && !usados.has(cursor)) {
        planos.push(cursor);
        usados.add(cursor);
      }
    }
  }
  for (const cursor of secuencia || [])
    if (!usados.has(cursor)) planos.push(cursor);
  const lotes = [];
  let actual = [];
  for (let i = 0; i < planos.length; i++) {
    const op = planos[i];
    const siguienteEsCursor =
      i + 1 < planos.length &&
      planos[i + 1].coleccion === "secuenciaAsistencia";
    const cabe = actual.length + 1 + (siguienteEsCursor ? 1 : 0) <= tamano;
    if (actual.length && !cabe) {
      lotes.push(actual);
      actual = [];
    }
    actual.push(op);
  }
  if (actual.length) lotes.push(actual);
  return lotes;
}
export function rutaAdjunto(coleccion, id, item, nombre) {
  const archivo = String(nombre || "adjunto")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const limpio = (valor, reserva) =>
    String(valor || reserva).replace(/[^A-Za-z0-9_-]/g, "") || reserva;
  if (coleccion === "bitacoras")
    return `evidencias/bitacoras/${limpio(item?.company, "sin-empresa")}/${limpio(item?.type, "sin-tipo")}/${id}/${archivo}`;
  if (coleccion === "mantenimiento")
    return `evidencias/mantenimiento/${id}/${archivo}`;
  return `evidencias/${coleccion}/${id}/${archivo}`;
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
