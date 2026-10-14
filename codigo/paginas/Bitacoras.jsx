import { EncabezadoPagina } from "../componentes/ElementosInterfaz.jsx";
export default function Bitacoras() {
  return (
    <section>
      <EncabezadoPagina title="Bitácoras" subtitle="Estructura inicial" />
      <div className="note">
        Los formularios de EPP, temperaturas, cloro, limpieza, baños y residuos
        aún no están implementados. Se construirán después de validar el módulo
        de asistencia y cotejar los formatos originales.
      </div>
    </section>
  );
}
