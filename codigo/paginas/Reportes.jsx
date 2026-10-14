import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  EncabezadoPagina,
  Mensaje,
} from "../componentes/ElementosInterfaz.jsx";
import { toCSV } from "../utilidades/archivosCsv.js";
import { download } from "../utilidades/descargas.js";
export default function Reportes() {
  const { data } = useAplicacion();
  const [error, setError] = useState("");
  function exportCSV(type) {
    try {
      download(
        `${type === "employees" ? "empleados" : "asistencia"}_rey_pez.csv`,
        toCSV(data[type]),
      );
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  function backup() {
    download(
      "respaldo_rey_pez.json",
      JSON.stringify(
        {
          version: 1,
          fecha_respaldo: new Date().toISOString(),
          empleados: data.employees,
          asistencia: data.attendance,
          horarios: data.schedules,
          alertas: data.alerts,
        },
        null,
        2,
      ),
      "application/json",
    );
  }
  return (
    <section>
      <EncabezadoPagina
        title="Reportes y CSV"
        subtitle="Exportación de los datos de este prototipo"
      />
      <div className="panel">
        <h2>Exportar</h2>
        <div className="actions">
          <button className="primary" onClick={() => exportCSV("employees")}>
            Exportar personal CSV
          </button>
          <button className="teal" onClick={() => exportCSV("attendance")}>
            Exportar asistencia CSV
          </button>
          <button onClick={backup}>Descargar respaldo JSON</button>
        </div>
        <p className="small">
          El archivo CSV se puede abrir con Excel. El respaldo JSON contiene los
          datos que están guardados en este navegador.
        </p>
        <Mensaje error>{error}</Mensaje>
      </div>
    </section>
  );
}
