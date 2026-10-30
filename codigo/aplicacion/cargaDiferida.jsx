import { lazy, Suspense } from "react";

function diferida(cargar, nombre) {
  const Componente = lazy(cargar);
  function Pantalla(props) {
    return (
      <Suspense fallback={null}>
        <Componente {...props} />
      </Suspense>
    );
  }
  Pantalla.displayName = nombre;
  return Pantalla;
}

export const DetallePanel = diferida(
  () => import("../paginas/DetallePanel.jsx"),
  "DetallePanel",
);
export const PanelPrincipal = diferida(
  () => import("../paginas/PanelPrincipal.jsx"),
  "PanelPrincipal",
);
export const Nomina = diferida(() => import("../paginas/Nomina.jsx"), "Nomina");
export const Personal = diferida(
  () => import("../paginas/Personal.jsx"),
  "Personal",
);
export const Asistencia = diferida(
  () => import("../paginas/Asistencia.jsx"),
  "Asistencia",
);
export const Configuracion = diferida(
  () => import("../paginas/Configuracion.jsx"),
  "Configuracion",
);
export const Reportes = diferida(
  () => import("../paginas/Reportes.jsx"),
  "Reportes",
);
export const Seguridad = diferida(
  () => import("../paginas/Seguridad.jsx"),
  "Seguridad",
);
export const CarpetasBitacoras = diferida(
  () => import("../paginas/CarpetasBitacoras.jsx"),
  "CarpetasBitacoras",
);
export const Mantenimiento = diferida(
  () => import("../paginas/Mantenimiento.jsx"),
  "Mantenimiento",
);
export const AvisoAcceso = diferida(
  () => import("../componentes/AvisoAcceso.jsx"),
  "AvisoAcceso",
);
