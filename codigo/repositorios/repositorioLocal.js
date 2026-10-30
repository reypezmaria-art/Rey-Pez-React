import { defaultSchedules } from "../datos/horariosIniciales.js";
import { demoEmployees } from "../datos/empleadosDemostracion.js";
import { baseOperation } from "../datos/operacionInicial.js";
import { normalizeDate, localDate } from "../utilidades/fechas.js";
export const STORAGE_KEY = "reypez_react_v1";
export const BACKUP_KEY = "reypez_respaldos_v2";
export function leerRespaldo(texto) {
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch (error) {
    throw Error(
      "El archivo no es un JSON válido. Elige un respaldo exportado desde Reportes.",
      { cause: error },
    );
  }
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw Error("El archivo no es un respaldo JSON de Rey Pez.");
  return valor;
}
function leerJsonAlmacenado(texto, aviso) {
  try {
    return JSON.parse(texto);
  } catch (error) {
    throw Error(aviso, { cause: error });
  }
}
export function mensajeGuardado(error) {
  const texto = `${error?.name || ""} ${error?.message || ""}`;
  if (error?.name === "QuotaExceededError" || /quotaexceeded/i.test(texto))
    return "No hay espacio en este navegador. Descarga un respaldo y reduce las evidencias.";
  return error?.message || "Error desconocido.";
}
export function validateState(state) {
  if (
    !state ||
    !["employees", "attendance", "schedules", "alerts"].every(
      (key) =>
        Array.isArray(state[key]) &&
        state[key].every((item) => item && typeof item === "object"),
    )
  )
    throw Error(
      "Los datos locales no tienen un formato válido. Conserva el almacenamiento antes de recuperarlos.",
    );
  for (const key of [
    "logs",
    "maintenance",
    "rooms",
    "areas",
    "programs",
    "terminals",
    "holidays",
    "absenceReviews",
    "scheduleExceptions",
    "audit",
    "securityAlerts",
    "companies",
    "payroll",
  ])
    if (state[key] !== undefined && !Array.isArray(state[key]))
      throw Error(`El respaldo tiene un campo inválido: ${key}.`);
  if (
    new Set(state.employees.map((e) => e.id_empleado)).size !==
    state.employees.length
  )
    throw Error("El catálogo contiene IDs duplicados.");
  return state;
}
export function migrateState(state, catalog = []) {
  const upgraded = {
    ...structuredClone(baseOperation),
    ...validateState(state),
  };
  upgraded.access = {
    ...structuredClone(baseOperation.access),
    ...state.access,
  };
  if (catalog.length) {
    const merged = upgraded.employees.map((e) =>
      /^EMPLEADO DEMO/.test(e.nombre_completo)
        ? catalog.find((c) => c.id_empleado === e.id_empleado) || e
        : e,
    );
    for (const e of catalog)
      if (!merged.some((c) => c.id_empleado === e.id_empleado)) merged.push(e);
    upgraded.employees = merged.filter(
      (e) => !/^EMPLEADO DEMO/.test(e.nombre_completo),
    );
    upgraded.catalogSource = "CSV corregido · 30 empleados recuperados";
  }
  upgraded.employees = upgraded.employees.map((e) => ({
    ...e,
    fecha_ingreso: normalizeDate(e.fecha_ingreso),
  }));
  if (state.schemaVersion !== 2)
    upgraded.schedules = upgraded.schedules.map((s) =>
      s.codigo === "EDG-ROT"
        ? { ...s, ...defaultSchedules.find((d) => d.codigo === "EDG-ROT") }
        : s,
    );
  if (upgraded.structureVersion !== 3) {
    for (const area of baseOperation.areas)
      if (!upgraded.areas.some((a) => a.id === area.id))
        upgraded.areas.push(structuredClone(area));
    upgraded.structureVersion = 3;
  }
  if (upgraded.roomCatalogVersion !== 1) {
    let room = upgraded.rooms.find((r) => r.company === "EDGAR");
    if (!room) {
      room = structuredClone(
        baseOperation.rooms.find((r) => r.id === "EDGAR-1"),
      );
      upgraded.rooms.push(room);
    }
    if (
      !upgraded.programs.some(
        (p) => p.type === "temperature" && p.area === room.id,
      )
    )
      upgraded.programs.push({
        ...structuredClone(
          baseOperation.programs.find((p) => p.area === "EDGAR-1"),
        ),
        id: `temp-${room.id}`,
        area: room.id,
      });
    upgraded.roomCatalogVersion = 1;
  }
  if (upgraded.chlorineAreaVersion !== 1) {
    upgraded.programs = upgraded.programs.map((p) =>
      p.id === `chlorine-${p.company}` &&
      p.type === "chlorine" &&
      p.area === `${p.company}-Cocción`
        ? { ...p, area: `${p.company}-Proceso` }
        : p,
    );
    upgraded.chlorineAreaVersion = 1;
  }
  upgraded.schemaVersion = 2;
  return upgraded;
}
export function createLocalRepository(storage = window.localStorage) {
  let initialState;
  const listeners = new Set();
  const read = () => {
    const stored = storage.getItem(STORAGE_KEY);
    return stored
      ? validateState(
          leerJsonAlmacenado(
            stored,
            "No se pudieron leer los datos de este navegador: el contenido no es JSON válido.",
          ),
        )
      : structuredClone(initialState);
  };
  const snapshot = (state) => {
    let entries = [];
    try {
      const parsed = JSON.parse(storage.getItem(BACKUP_KEY) || "[]");
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      entries = [];
    }
    if (!entries.some((b) => b.date === localDate()))
      storage.setItem(
        BACKUP_KEY,
        JSON.stringify([{ date: localDate(), state }, ...entries].slice(0, 7)),
      );
  };
  return {
    async load() {
      let catalog = globalThis.__REY_PEZ_CATALOG__ || [];
      if (import.meta.env?.DEV && !catalog.length) {
        const response = await fetch("/__local/empleados");
        if (response.ok) catalog = await response.json();
      }
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        const old = leerJsonAlmacenado(
          stored,
          "No se pudieron leer los datos de este navegador: el contenido no es JSON válido.",
        );
        initialState = migrateState(old, catalog);
        if (JSON.stringify(old) !== JSON.stringify(initialState))
          storage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      } else {
        const legacy = (key, fallback) => {
          const value = storage.getItem(key);
          return value
            ? leerJsonAlmacenado(
                value,
                "No se pudo leer un dato anterior de este navegador: no es JSON válido.",
              )
            : fallback;
        };
        initialState = migrateState(
          {
            version: 1,
            employees: legacy(
              "reypez_employees_v1",
              catalog.length ? catalog : demoEmployees,
            ),
            attendance: legacy("reypez_attendance_v1", []),
            schedules: legacy("reypez_schedules_v1", defaultSchedules),
            alerts: legacy("reypez_admin_alerts_v1", []),
          },
          catalog,
        );
        storage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      }
      return structuredClone(initialState);
    },
    async transact(update) {
      const commit = () => {
        const before = read();
        const next = validateState(update(before));
        snapshot(before);
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
        listeners.forEach((listener) => listener(next));
        return next;
      };
      return globalThis.navigator?.locks
        ? navigator.locks.request(STORAGE_KEY, commit)
        : commit();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            listener(validateState(JSON.parse(event.newValue)));
          } catch {
            /* conservar el estado válido */
          }
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    backups() {
      try {
        const value = JSON.parse(storage.getItem(BACKUP_KEY) || "[]");
        if (!Array.isArray(value))
          throw Error("Las copias automáticas no tienen forma de lista.");
        return value;
      } catch (error) {
        if (/copias automáticas/.test(error.message || "")) throw error;
        throw Error(
          "Las copias automáticas locales no se pudieron leer. Descarga un respaldo nuevo.",
          { cause: error },
        );
      }
    },
  };
}
