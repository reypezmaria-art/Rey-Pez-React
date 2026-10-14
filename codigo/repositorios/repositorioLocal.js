import { defaultSchedules } from "../datos/horariosIniciales.js";
import { demoEmployees } from "../datos/empleadosDemostracion.js";

export const STORAGE_KEY = "reypez_react_v1";
function validateState(state) {
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
  return state;
}
export function createLocalRepository(storage = window.localStorage) {
  let initialState;
  const listeners = new Set();
  function read() {
    const stored = storage.getItem(STORAGE_KEY);
    return stored
      ? validateState(JSON.parse(stored))
      : structuredClone(initialState);
  }
  return {
    async load() {
      if (storage.getItem(STORAGE_KEY)) return read();
      let employees = demoEmployees;
      if (import.meta.env?.DEV) {
        const response = await fetch("/__local/empleados");
        if (response.ok) employees = await response.json();
      }
      const legacy = (key, fallback) => {
        const value = storage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      };
      initialState = validateState({
        version: 1,
        employees: legacy("reypez_employees_v1", employees),
        attendance: legacy("reypez_attendance_v1", []),
        schedules: legacy("reypez_schedules_v1", defaultSchedules),
        alerts: legacy("reypez_admin_alerts_v1", []),
      });
      storage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      return structuredClone(initialState);
    },
    async transact(update) {
      const commit = () => {
        const next = validateState(update(read()));
        // Un único documento evita escrituras parciales entre empleados y asistencia.
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
            /* No sustituir datos válidos por un evento corrupto. */
          }
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
