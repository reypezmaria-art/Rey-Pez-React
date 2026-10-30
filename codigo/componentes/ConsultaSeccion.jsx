import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Tabla, Campo, EncabezadoPagina } from "./ElementosInterfaz.jsx";
import { toCSV } from "../utilidades/archivosCsv.js";
import { download } from "../utilidades/descargas.js";

export default function ConsultaSeccion({ tipo }) {
  const { data, session } = useAplicacion();
  const permiso = data.access.permissions[session.id];
  const empresa = permiso.company;
  const [dataset, setDataset] = useState("attendance");
  const [buscar, setBuscar] = useState("");
  const titulos = {
    employees: "Personal",
    maintenance: "Mantenimiento y compras",
    reports: "Reportes y CSV",
  };
  const origen = tipo === "reports" ? dataset : tipo;
  const columnas = {
    employees: [
      ["id_empleado", "ID"],
      ["nombre_completo", "Trabajador"],
      ["puesto", "Puesto"],
      ["fecha_ingreso", "Ingreso"],
      ["estatus", "Estado"],
    ],
    maintenance: [
      ["when", "Fecha"],
      ["room", "Cuarto"],
      ["type", "Actividad"],
      ["description", "Descripción"],
      ["provider", "Proveedor"],
      ["cost", "Costo MXN"],
    ],
    attendance: [
      ["fecha_hora", "Fecha y hora"],
      ["id_empleado", "ID"],
      ["nombre_completo", "Trabajador"],
      ["movimiento", "Movimiento"],
    ],
    alerts: [
      ["fecha_hora", "Fecha y hora"],
      ["id_empleado", "ID"],
      ["tipo", "Tipo"],
      ["detalle", "Detalle"],
      ["estado", "Estado"],
    ],
  }[origen];
  const filas = (data[origen] || []).filter((r) => {
    const company =
      r.empresa_codigo ||
      data.rooms.find((room) => room.id === r.room)?.company;
    return (
      company === empresa &&
      (!buscar ||
        JSON.stringify(r).toLowerCase().includes(buscar.toLowerCase()))
    );
  });
  return (
    <section>
      <EncabezadoPagina title={titulos[tipo]} subtitle={empresa} />
      <div className="toolbar">
        {tipo === "reports" && (
          <Campo
            label="Información para exportar"
            as="select"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          >
            <option value="attendance">Asistencia</option>
            <option value="alerts">Incidencias de asistencia</option>
            <option value="employees">Personal</option>
          </Campo>
        )}
        <Campo
          label="Buscar en la sección"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {tipo === "reports" && (
          <button
            onClick={() =>
              download(
                `${origen}_${empresa}.csv`,
                toCSV(
                  filas.map((r) =>
                    Object.fromEntries(columnas.map(([k]) => [k, r[k] ?? ""])),
                  ),
                ),
              )
            }
          >
            Descargar CSV
          </button>
        )}
      </div>
      <Tabla
        headings={columnas.map(([, titulo]) => titulo)}
        count={filas.length}
      >
        {filas.map((r, i) => (
          <tr key={r.id || r.id_registro || r.id_alerta || r.id_empleado || i}>
            {columnas.map(([key]) => (
              <td key={key}>{String(r[key] ?? "—")}</td>
            ))}
          </tr>
        ))}
      </Tabla>
    </section>
  );
}
