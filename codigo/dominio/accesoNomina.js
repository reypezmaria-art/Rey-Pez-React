import { puedeVerNomina } from "./seguridad.js";
export function puedeConsultarNomina(state, session) {
  if (puedeVerNomina(state, session)) return true;
  if (!session?.id) return false;
  const empleado = state.employees.find((e) => e.id_empleado === session.id);
  const cuenta = state.access.workers[session.id];
  return Boolean(
    empleado &&
    empleado.estatus !== "Baja" &&
    cuenta &&
    cuenta.active !== false &&
    !cuenta.locked &&
    state.access.permissions[session.id]?.consultaNominaTodas === true,
  );
}

export function asignarConsultaNomina(state, id, autorizado) {
  const empleado = state.employees.find(
    (e) => e.id_empleado === id && e.estatus !== "Baja",
  );
  if (!empleado || !state.access.workers[id])
    throw Error("Selecciona una cuenta de empleado existente.");
  return {
    ...state,
    access: {
      ...state.access,
      permissions: {
        ...state.access.permissions,
        [id]: {
          ...state.access.permissions[id],
          consultaNominaTodas: autorizado === true,
        },
      },
    },
    audit: [
      {
        id: crypto.randomUUID(),
        action: autorizado
          ? "Autorizar consulta de nómina de las tres empresas"
          : "Retirar consulta de nómina",
        employeeId: id,
        by: "MARIA",
        when: new Date().toISOString(),
      },
      ...state.audit,
    ],
  };
}

export function puedeConsultarSeccion(state, session, seccion) {
  if (session?.role === "admin") return true;
  if (
    session?.role !== "worker" ||
    !["employees", "maintenance", "reports"].includes(seccion)
  )
    return false;
  const e = state.employees.find(
    (e) => e.id_empleado === session.id && e.estatus !== "Baja",
  );
  const permiso = state.access.permissions[session.id],
    cuenta = state.access.workers[session.id];
  return Boolean(
    e &&
    cuenta?.active &&
    !cuenta.locked &&
    permiso?.company === e.empresa_codigo &&
    permiso.secciones?.includes(seccion),
  );
}
