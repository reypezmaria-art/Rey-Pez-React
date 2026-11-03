// Solo cuenta intervalos observados; no reconstruye sueño del equipo ni uso sin señal.
export function crearContadorUso(ahora = 0, visibleInicial = true) {
  let ultimo = ahora,
    interaccion = ahora,
    visible = visibleInicial;
  let visibleMs = 0,
    activoMs = 0;
  return {
    actualizar(instante, alFrente = visible, actividad = false) {
      const inicio = Math.max(ultimo, instante - 30000);
      if (visible) {
        visibleMs += Math.max(0, instante - inicio);
        activoMs += Math.max(
          0,
          Math.min(instante, interaccion + 300000) - inicio,
        );
      }
      ultimo = instante;
      visible = alFrente;
      if (actividad && visible) interaccion = instante;
      return {
        visibleMs: Math.floor(visibleMs),
        activoMs: Math.floor(activoMs),
        visible,
        activo: visible && instante - interaccion < 300000,
      };
    },
  };
}
export const modulosUso = {
  dashboard: "Inicio",
  employees: "Personal",
  payroll: "Nómina",
  attendance: "Asistencia 2",
  logs: "Bitácoras de salud",
  epp: "EPP",
  labor: "Normas del Trabajo",
  maintenance: "Mantenimiento",
  reports: "Reportes y CSV",
  settings: "Configuración",
  security: "Seguridad",
  administration: "Administración",
  capture: "Bitácoras",
  kiosk: "Asistencia 1",
};
export function duracionUso(ms = 0) {
  const minutos = Math.floor(ms / 60000);
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
}
