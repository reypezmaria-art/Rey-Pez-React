import { baseOperation } from "../datos/operacionInicial.js";
import { localDate } from "../utilidades/fechas.js";
import { migrateState } from "./repositorioLocal.js";

export const MOVIMIENTOS_ASISTENCIA = [
  "ENTRADA",
  "SALIDA_A_COMER",
  "REGRESO_DE_COMER",
  "SALIDA_FINAL",
];
const VENTANA_PASADA_MS = 20 * 60 * 60 * 1000;
const VENTANA_FUTURA_MS = 15 * 60 * 1000;

export const COLECCIONES = [
  { clave: "employees", coleccion: "empleados", id: "id_empleado" },
  { clave: "attendance", coleccion: "asistencia", id: "id_registro" },
  { clave: "schedules", coleccion: "horarios", id: "codigo" },
  { clave: "alerts", coleccion: "alertas", id: "id_alerta" },
  { clave: "logs", coleccion: "bitacoras", id: "id" },
  { clave: "maintenance", coleccion: "mantenimiento", id: "id" },
  { clave: "rooms", coleccion: "cuartos", id: "id" },
  { clave: "areas", coleccion: "areas", id: "id" },
  { clave: "programs", coleccion: "programas", id: "id" },
  { clave: "terminals", coleccion: "terminales", id: "id" },
  { clave: "absenceReviews", coleccion: "revisionesAusencia", id: "id" },
  { clave: "scheduleExceptions", coleccion: "excepcionesHorario", id: "id" },
  { clave: "audit", coleccion: "auditoria", id: "id" },
];

const OPERACION = [
  "attendance",
  "logs",
  "maintenance",
  "absenceReviews",
  "audit",
  "alerts",
];

export function sanitizar(valor) {
  if (Array.isArray(valor)) return valor.map(sanitizar);
  if (valor && typeof valor === "object") {
    const salida = {};
    for (const [clave, item] of Object.entries(valor)) {
      if (item === undefined) continue;
      salida[clave] = sanitizar(item);
    }
    return salida;
  }
  return valor;
}

export function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((clave) => [clave, canonico(valor[clave])]),
    );
  }
  return valor;
}

export const iguales = (a, b) =>
  JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

export function idDe(definicion, item) {
  if (item?.[definicion.id]) return String(item[definicion.id]);
  if (definicion.clave === "scheduleExceptions")
    return `${item.employeeId}__${item.date}`;
  throw Error(`Falta identificador en ${definicion.clave}.`);
}

export function definicionDe(coleccion) {
  return COLECCIONES.find((item) => item.coleccion === coleccion);
}

export function consultasDe(cuenta) {
  if (!cuenta?.activo) return [];
  if (cuenta.rol === "admin")
    return COLECCIONES.map((definicion) => ({
      definicion,
      restricciones: [],
    }));
  if (cuenta.rol === "terminal")
    return COLECCIONES.filter((definicion) =>
      [
        "employees",
        "attendance",
        "schedules",
        "scheduleExceptions",
        "rooms",
        "areas",
        "programs",
        "terminals",
      ].includes(definicion.clave),
    ).map((definicion) => ({ definicion, restricciones: [] }));
  const empresa = cuenta.empresa;
  const bitacoras = [...new Set(cuenta.bitacoras || [])];
  const propias = [];
  const agregar = (clave, restricciones) => {
    const definicion = COLECCIONES.find((item) => item.clave === clave);
    if (
      restricciones.some((item) => item.operador === "in" && !item.valor.length)
    )
      return;
    propias.push({ definicion, restricciones });
  };
  agregar("employees", [
    { campo: "empresa_codigo", operador: "==", valor: empresa },
  ]);
  agregar("attendance", [
    { campo: "id_empleado", operador: "==", valor: cuenta.idEmpleado },
  ]);
  agregar("schedules", []);
  agregar("logs", [
    { campo: "company", operador: "==", valor: empresa },
    { campo: "type", operador: "in", valor: bitacoras },
  ]);
  agregar("rooms", [{ campo: "company", operador: "==", valor: empresa }]);
  agregar("areas", [{ campo: "company", operador: "==", valor: empresa }]);
  agregar("programs", [{ campo: "company", operador: "==", valor: empresa }]);
  agregar("scheduleExceptions", [
    { campo: "employeeId", operador: "==", valor: cuenta.idEmpleado },
  ]);
  agregar("terminals", []);
  return propias;
}

export function expandirConsultas(consultas) {
  const salida = [];
  for (const consulta of consultas) {
    const larga = consulta.restricciones.find(
      (item) => item.operador === "in" && item.valor.length > 10,
    );
    if (!larga) {
      salida.push(consulta);
      continue;
    }
    for (let indice = 0; indice < larga.valor.length; indice += 10) {
      salida.push({
        definicion: consulta.definicion,
        restricciones: consulta.restricciones.map((item) =>
          item === larga
            ? { ...item, valor: item.valor.slice(indice, indice + 10) }
            : item,
        ),
      });
    }
  }
  return salida;
}

export function puedeEscribir(cuenta, cambio) {
  if (!cuenta?.activo) return false;
  if (cuenta.rol === "admin" && cuenta.idEmpleado === "MARIA") return true;
  if (cambio.tipo === "borrar") return false;
  if (cuenta.rol === "terminal") {
    if (cambio.coleccion === "secuenciaAsistencia")
      return cambio.tipo === "poner";
    return (
      cambio.tipo === "poner" &&
      !cambio.existia &&
      (cambio.coleccion === "alertas" ||
        (cambio.coleccion === "asistencia" &&
          MOVIMIENTOS_ASISTENCIA.includes(cambio.datos?.movimiento)))
    );
  }
  if (cuenta.rol !== "trabajador") return false;
  const datos = cambio.datos || {};
  if (cambio.coleccion === "secuenciaAsistencia")
    return cambio.tipo === "poner" && cambio.id === cuenta.idEmpleado;
  if (cambio.coleccion === "bitacoras" && !cambio.existia)
    return (
      datos.company === cuenta.empresa &&
      (cuenta.bitacoras || []).includes(datos.type) &&
      datos.createdBy === cuenta.idEmpleado
    );
  if (cambio.coleccion === "asistencia" && !cambio.existia)
    return (
      datos.id_empleado === cuenta.idEmpleado &&
      datos.empresa_codigo === cuenta.empresa &&
      MOVIMIENTOS_ASISTENCIA.includes(datos.movimiento)
    );
  if (cambio.coleccion === "auditoria" && !cambio.existia)
    return (
      datos.by === cuenta.idEmpleado || datos.createdBy === cuenta.idEmpleado
    );
  if (cambio.coleccion === "alertas" && !cambio.existia)
    return datos.id_empleado === cuenta.idEmpleado;
  return false;
}

export function fechaLocalDe(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return localDate(fecha);
}

export function cursorDeEmpleado(attendance, idEmpleado) {
  let elegido = null;
  for (const registro of attendance || []) {
    if (registro.id_empleado !== idEmpleado) continue;
    if (!MOVIMIENTOS_ASISTENCIA.includes(registro.movimiento)) continue;
    const ms = new Date(registro.fecha_hora).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!elegido || ms >= elegido.ms) elegido = { registro, ms };
  }
  if (!elegido) return null;
  return {
    ultimo: elegido.registro.movimiento,
    fecha: fechaLocalDe(elegido.registro.fecha_hora),
    registroId: elegido.registro.id_registro,
    ms: elegido.ms,
  };
}

export function marcajePermitido(cursor, registro) {
  const movimiento = registro?.movimiento;
  if (!MOVIMIENTOS_ASISTENCIA.includes(movimiento)) return false;
  const fecha = fechaLocalDe(registro.fecha_hora);
  if (!fecha) return false;
  if (!cursor || cursor.fecha !== fecha || cursor.ultimo === "SALIDA_FINAL")
    return movimiento === "ENTRADA";
  if (cursor.ultimo === "ENTRADA")
    return movimiento === "SALIDA_A_COMER" || movimiento === "SALIDA_FINAL";
  if (cursor.ultimo === "SALIDA_A_COMER")
    return movimiento === "REGRESO_DE_COMER";
  if (cursor.ultimo === "REGRESO_DE_COMER")
    return movimiento === "SALIDA_FINAL";
  return false;
}

export function marcajeVigente(registro, ahora = Date.now()) {
  const ms = new Date(registro?.fecha_hora).getTime();
  return (
    Number.isFinite(ms) &&
    ms <= ahora + VENTANA_FUTURA_MS &&
    ms >= ahora - VENTANA_PASADA_MS
  );
}

function quitarMetadatosMarcaje(datos, id) {
  const copia = { ...datos };
  delete copia.fecha_local;
  delete copia.fecha_ms;
  if (!copia.id_registro && id) copia.id_registro = id;
  return copia;
}

export function anexarSecuencia({
  cuenta,
  antes,
  cambios,
  ahora = Date.now(),
}) {
  const nuevas = cambios.filter(
    (cambio) =>
      cambio.coleccion === "asistencia" &&
      cambio.tipo === "poner" &&
      !cambio.existia,
  );
  if (!nuevas.length) return cambios;
  const admin = cuenta?.rol === "admin" && cuenta?.idEmpleado === "MARIA";
  const simulada = [...(antes?.attendance || [])];
  const ordenadas = [...nuevas].sort(
    (a, b) =>
      new Date(a.datos?.fecha_hora).getTime() -
      new Date(b.datos?.fecha_hora).getTime(),
  );
  const reales = ordenadas.filter(
    (cambio) => cambio.datos?.movimiento !== "REVISION_ADMINISTRATIVA",
  );
  if (!admin && reales.length > 1) throw Error("Registra un marcaje a la vez.");
  for (const cambio of ordenadas) {
    const datos = cambio.datos || {};
    const id = datos.id_empleado;
    if (!id) throw Error("El marcaje no indica el empleado.");
    const revision = datos.movimiento === "REVISION_ADMINISTRATIVA";
    if (revision && !admin)
      throw Error("Solo María puede registrar una revisión administrativa.");
    if (!revision && !admin) {
      const cursor = cursorDeEmpleado(simulada, id);
      if (!marcajePermitido(cursor, datos))
        throw Error(
          "Ese marcaje no sigue la secuencia del día: entrada, salida a comer, regreso y salida.",
        );
      if (!marcajeVigente(datos, ahora))
        throw Error(
          "La fecha del marcaje queda fuera del turno que se puede registrar.",
        );
      if (cursor && new Date(datos.fecha_hora).getTime() < cursor.ms)
        throw Error(
          "La fecha del marcaje queda fuera del turno que se puede registrar.",
        );
      const empleado = (antes?.employees || []).find(
        (item) => item.id_empleado === id,
      );
      if (!empleado)
        throw Error("No se encontró ese ID. Solicita apoyo a administración.");
      if ((empleado.estatus || "Activo") !== "Activo")
        throw Error("La cuenta no está activa. Consulta a administración.");
      if (datos.empresa_codigo !== empleado.empresa_codigo)
        throw Error("El marcaje no corresponde a la empresa del empleado.");
      if (cuenta.rol === "trabajador" && id !== cuenta.idEmpleado)
        throw Error("No tienes permiso para guardar ese cambio.");
    }
    const ms = new Date(datos.fecha_hora).getTime();
    cambio.datos = {
      ...datos,
      fecha_local: fechaLocalDe(datos.fecha_hora),
      fecha_ms: Number.isFinite(ms) ? ms : null,
    };
    simulada.push(cambio.datos);
  }
  const extras = [];
  for (const id of new Set(
    ordenadas.map((cambio) => cambio.datos.id_empleado),
  )) {
    const cursor = admin
      ? cursorDeEmpleado(simulada, id)
      : {
          ultimo: ordenadas.find((cambio) => cambio.datos.id_empleado === id)
            ?.datos.movimiento,
          fecha: ordenadas.find((cambio) => cambio.datos.id_empleado === id)
            ?.datos.fecha_local,
          registroId: ordenadas.find(
            (cambio) => cambio.datos.id_empleado === id,
          )?.id,
        };
    if (!cursor?.ultimo || !MOVIMIENTOS_ASISTENCIA.includes(cursor.ultimo))
      continue;
    extras.push({
      tipo: "poner",
      coleccion: "secuenciaAsistencia",
      id,
      datos: {
        ultimo: cursor.ultimo,
        fecha: cursor.fecha,
        registroId: cursor.registroId,
        idEmpleado: id,
      },
      existia: true,
    });
  }
  return [...cambios, ...extras];
}

export function prepararEstadoNube(estado) {
  const copia = structuredClone(estado);
  const workers = {};
  for (const [id, credencial] of Object.entries(copia.access?.workers || {})) {
    if (!credencial) continue;
    workers[id] =
      credencial.hash === "firebase"
        ? {
            proveedor: "firebase",
            active: credencial.active !== false,
            hash: "firebase",
          }
        : { proveedor: "firebase", active: credencial.active !== false };
  }
  copia.access = {
    admin: { proveedor: "firebase", active: true, hash: "firebase" },
    workers,
    permissions: structuredClone(copia.access?.permissions || {}),
  };
  copia.attendance = (copia.attendance || []).map(marcarSincronizado);
  return copia;
}

export function marcarSincronizado(registro) {
  return registro?.estado_sincronizacion === "Local - no sincronizado"
    ? { ...registro, estado_sincronizacion: "Sincronizado" }
    : registro;
}

export function principalDesdeEstado(estado, extra = {}) {
  return sanitizar({
    revision: extra.revision ?? 0,
    origen: extra.origen || "navegador",
    version: estado.version ?? 1,
    schemaVersion: estado.schemaVersion ?? 2,
    structureVersion: estado.structureVersion ?? 3,
    roomCatalogVersion: estado.roomCatalogVersion ?? 1,
    chlorineAreaVersion: estado.chlorineAreaVersion ?? 1,
    catalogSource: estado.catalogSource || "",
    holidays: estado.holidays || [],
    adminConfigurado: Boolean(estado.access?.admin),
    permisosMigrados: estado.access?.permissions || {},
    trabajadoresActivos: extra.trabajadoresActivos || {},
  });
}

export function trabajadoresActivosDe(estado) {
  const mapa = {};
  const ids = new Set([
    ...Object.keys(estado.access?.workers || {}),
    ...Object.keys(estado.access?.permissions || {}),
  ]);
  for (const id of ids) {
    const credencial = estado.access?.workers?.[id];
    mapa[id] = {
      activo: credencial ? credencial.active !== false : true,
      vinculado: credencial?.hash === "firebase",
    };
  }
  return mapa;
}

export function construirAcceso({ principal, cuentas = [], cuenta }) {
  const admin = principal?.adminConfigurado
    ? { proveedor: "firebase", active: true, hash: "firebase" }
    : null;
  const workers = {};
  const permissions = {};
  const rol = cuenta?.rol;
  if (rol === "admin") {
    Object.assign(permissions, principal?.permisosMigrados || {});
    for (const [id, marca] of Object.entries(
      principal?.trabajadoresActivos || {},
    )) {
      workers[id] = marca.vinculado
        ? {
            proveedor: "firebase",
            active: marca.activo !== false,
            hash: "firebase",
          }
        : { proveedor: "firebase", active: marca.activo !== false };
    }
    for (const item of cuentas) {
      if (item.rol !== "trabajador" || !item.idEmpleado) continue;
      workers[item.idEmpleado] = {
        proveedor: "firebase",
        active: item.activo !== false,
        hash: "firebase",
      };
      permissions[item.idEmpleado] = {
        company: item.empresa,
        logs: item.bitacoras || [],
      };
    }
  } else if (rol === "trabajador") {
    workers[cuenta.idEmpleado] = {
      proveedor: "firebase",
      active: cuenta.activo !== false,
      hash: "firebase",
    };
    permissions[cuenta.idEmpleado] = {
      company: cuenta.empresa,
      logs: cuenta.bitacoras || [],
    };
  } else if (rol === "terminal") {
    for (const [id, marca] of Object.entries(
      principal?.trabajadoresActivos || {},
    )) {
      if (!marca.vinculado) continue;
      workers[id] = {
        proveedor: "firebase",
        active: marca.activo !== false,
        hash: "firebase",
      };
    }
  }
  return { admin, workers, permissions };
}

export function armarEstado(principal, documentos, cuenta, cuentas = []) {
  const estado = {
    version: principal?.version ?? 1,
    schemaVersion: principal?.schemaVersion ?? 2,
    structureVersion: principal?.structureVersion ?? 3,
    roomCatalogVersion: principal?.roomCatalogVersion ?? 1,
    chlorineAreaVersion: principal?.chlorineAreaVersion ?? 1,
    catalogSource: principal?.catalogSource || "",
    holidays: principal?.holidays || [],
    access: construirAcceso({ principal, cuentas, cuenta }),
  };
  for (const definicion of COLECCIONES) estado[definicion.clave] = [];
  for (const [coleccion, lista] of Object.entries(documentos)) {
    const definicion = definicionDe(coleccion);
    if (!definicion) continue;
    estado[definicion.clave] = lista.map(({ id, datos }) => {
      if (definicion.clave === "scheduleExceptions") return datos;
      if (definicion.clave === "attendance")
        return quitarMetadatosMarcaje(datos, id);
      return datos[definicion.id] ? datos : { ...datos, [definicion.id]: id };
    });
  }
  return migrateState(estado);
}

export function estadoDesdeDocumentos(principal, documentos) {
  const estado = estadoVacio();
  estado.version = principal?.version ?? 1;
  estado.schemaVersion = principal?.schemaVersion ?? 2;
  estado.structureVersion = principal?.structureVersion ?? 3;
  estado.roomCatalogVersion = principal?.roomCatalogVersion ?? 1;
  estado.chlorineAreaVersion = principal?.chlorineAreaVersion ?? 1;
  estado.catalogSource = principal?.catalogSource || "";
  estado.holidays = principal?.holidays || [];
  for (const [coleccion, lista] of Object.entries(documentos || {})) {
    const definicion = definicionDe(coleccion);
    if (!definicion) continue;
    estado[definicion.clave] = lista.map(({ id, datos }) => {
      if (definicion.clave === "attendance")
        return quitarMetadatosMarcaje(datos, id);
      return definicion.clave === "scheduleExceptions" || datos[definicion.id]
        ? datos
        : { ...datos, [definicion.id]: id };
    });
  }
  return estado;
}

export function estadoPublico(adminConfigurado) {
  const estado = migrateState({
    version: 1,
    employees: [],
    attendance: [],
    schedules: [],
    alerts: [],
    access: { admin: null, workers: {}, permissions: {} },
  });
  estado.employees = [];
  estado.access = {
    admin: adminConfigurado
      ? { proveedor: "firebase", active: true, hash: "firebase" }
      : null,
    workers: {},
    permissions: {},
  };
  return estado;
}

export function estadoVacio() {
  const estado = structuredClone(baseOperation);
  for (const definicion of COLECCIONES) estado[definicion.clave] = [];
  estado.employees = [];
  estado.attendance = [];
  estado.schedules = [];
  estado.alerts = [];
  estado.holidays = [];
  estado.access = { admin: null, workers: {}, permissions: {} };
  return estado;
}

export function empresaDeRegistro(item, estado) {
  if (item.company) return item.company;
  if (item.empresa_codigo) return item.empresa_codigo;
  return (
    estado.rooms?.find((cuarto) => cuarto.id === item.room)?.company ||
    "general"
  );
}

export function nombreArchivo(nombre) {
  const base = String(nombre || "adjunto")
    .split(/[/\\]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return (base || "adjunto").slice(-80);
}

export function separarEvidencias(estado) {
  const pendientes = [];
  const copia = structuredClone(estado);
  for (const clave of ["logs", "maintenance"]) {
    copia[clave] = (copia[clave] || []).map((item) => {
      if (!item.evidence?.data || item.evidence.ruta) return item;
      const id = item.id || item.id_registro || crypto.randomUUID();
      const empresa = empresaDeRegistro(item, estado);
      const ruta = `evidencias/${empresa}/${id}/${nombreArchivo(item.evidence.name)}`;
      pendientes.push({
        ruta,
        data: item.evidence.data,
        type: item.evidence.type || "application/octet-stream",
        name: item.evidence.name,
      });
      return {
        ...item,
        evidence: {
          name: item.evidence.name,
          type: item.evidence.type,
          ruta,
          pendiente: true,
        },
      };
    });
  }
  return { estado: copia, pendientes };
}

export function quitarDatosEvidencia(estado) {
  const copia = structuredClone(estado);
  for (const clave of ["logs", "maintenance"]) {
    for (const item of copia[clave] || []) {
      if (item.evidence?.ruta && "data" in item.evidence)
        delete item.evidence.data;
    }
  }
  return copia;
}

export function diferencias(antes, despues) {
  const cambios = [];
  for (const definicion of COLECCIONES) {
    const previos = new Map(
      (antes[definicion.clave] || []).map((item) => [
        idDe(definicion, item),
        item,
      ]),
    );
    const siguientes = new Map();
    for (const item of despues[definicion.clave] || []) {
      const id = idDe(definicion, item);
      siguientes.set(id, item);
      const previo = previos.get(id);
      const datos = sanitizar(item);
      if (!previo || !iguales(sanitizar(previo), datos))
        cambios.push({
          tipo: "poner",
          coleccion: definicion.coleccion,
          id,
          datos,
          existia: Boolean(previo),
        });
    }
    for (const id of previos.keys()) {
      if (!siguientes.has(id))
        cambios.push({
          tipo: "borrar",
          coleccion: definicion.coleccion,
          id,
          existia: true,
        });
    }
  }
  return cambios;
}

export function sinOperacion(estado) {
  return OPERACION.every((clave) => !(estado?.[clave] || []).length);
}

export function localAportaDatos(estado) {
  if (!estado) return false;
  if (OPERACION.some((clave) => estado[clave]?.length)) return true;
  if (estado.catalogSource) return true;
  if (estado.access?.admin) return true;
  if (Object.keys(estado.access?.workers || {}).length) return true;
  if (Object.keys(estado.access?.permissions || {}).length) return true;
  return (estado.employees || []).some(
    (empleado) => !/^EMPLEADO DEMO/.test(empleado.nombre_completo || ""),
  );
}

export function decidirMigracion({
  marca,
  localAporta,
  remotoVacio,
  origenRemoto,
  remotoSinOperacion,
  manual = false,
}) {
  if (!localAporta) return "omitir";
  if (!manual && (marca === "hecha" || marca === "omitida")) return "omitir";
  if (remotoVacio) return "subir";
  if (origenRemoto === "semilla" && remotoSinOperacion)
    return "sustituir-semilla";
  return "conflicto";
}

export function listaEvidencias(estado) {
  return [...(estado.logs || []), ...(estado.maintenance || [])].flatMap(
    (item) => (item.evidence?.ruta ? [item.evidence] : []),
  );
}
