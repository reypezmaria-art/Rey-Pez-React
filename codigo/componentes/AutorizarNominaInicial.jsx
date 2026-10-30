import { useEffect, useRef } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { asignarConsultaNomina } from "../dominio/accesoNomina.js";

// Configuración opcional de una instalación: nunca contiene nombres ni credenciales.
// Solo se aplica en una sesión administrativa autenticada y una sola vez por cuenta.
export default function AutorizarNominaInicial() {
  const { data, session, commit, avisar } = useAplicacion();
  const ejecutando = useRef(false);
  const id = String(import.meta.env.VITE_NOMINA_CONSULTA_INICIAL || "")
    .trim()
    .toUpperCase();
  useEffect(() => {
    if (
      !id ||
      session?.role !== "admin" ||
      ejecutando.current ||
      (data.permisosInicialesAplicados || []).includes(id)
    )
      return;
    if (
      !data.employees.some((e) => e.id_empleado === id) ||
      !data.access.workers[id]
    ) {
      avisar(
        "No se encontró la cuenta indicada para Nómina. Revisa el ID en Seguridad.",
      );
      return;
    }
    ejecutando.current = true;
    commit((state) => {
      if ((state.permisosInicialesAplicados || []).includes(id)) return state;
      const next = asignarConsultaNomina(state, id, true);
      next.permisosInicialesAplicados = [
        ...(state.permisosInicialesAplicados || []),
        id,
      ];
      return next;
    })
      .then(() =>
        avisar(
          `Consulta de Nómina de las tres empresas autorizada para ${id}.`,
        ),
      )
      .catch((err) => avisar(err.message));
  }, [id, session, data, commit, avisar]);
  return null;
}
