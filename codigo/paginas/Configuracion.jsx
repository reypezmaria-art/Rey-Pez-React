import OperacionConfiguracion from "./OperacionConfiguracion.jsx";
import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  EncabezadoPagina,
  Tabla,
  Mensaje,
} from "../componentes/ElementosInterfaz.jsx";
import FormularioHorario from "../componentes/FormularioHorario.jsx";
import { companyNames } from "../datos/constantes.js";
import { deleteSchedule } from "../dominio/operaciones.js";
export default function Configuracion() {
  const { data, commit, pending } = useAplicacion();
  const [editor, setEditor] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function remove(code) {
    if (!window.confirm(`¿Eliminar el horario ${code}?`)) return;
    setError("");
    setMessage("");
    try {
      await commit((state) => deleteSchedule(state, code));
      setMessage("Horario eliminado.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <EncabezadoPagina
        title="Configuración"
        subtitle="Administra horarios, comida y vigencias desde la web"
      >
        <button
          className="primary"
          onClick={() => setEditor({ schedule: undefined })}
        >
          + Agregar horario
        </button>
      </EncabezadoPagina>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{message}</Mensaje>
      {editor && (
        <FormularioHorario
          key={editor.schedule?.codigo || "new"}
          schedule={editor.schedule}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setMessage("Horario guardado localmente.");
          }}
        />
      )}
      <Tabla
        headings={[
          "Código",
          "Empresa",
          "Horario",
          "Comida",
          "Vigencia",
          "Notas",
          "Acciones",
        ]}
        count={data.schedules.length}
        empty="No hay horarios configurados."
      >
        {data.schedules.map((s) => (
          <tr key={s.codigo}>
            <td>{s.codigo}</td>
            <td>{companyNames[s.empresa_codigo] || s.empresa_codigo}</td>
            <td>
              {s.nombre}
              <br />
              {s.hora_inicio || "—"}–{s.hora_fin || "—"}
            </td>
            <td>
              {s.comida_inicio || "—"}–{s.comida_fin || "—"}
            </td>
            <td>{s.vigente_desde || "Sin fecha"}</td>
            <td>{s.notas}</td>
            <td>
              <div className="table-actions">
                <button onClick={() => setEditor({ schedule: s })}>
                  Modificar
                </button>
                <button
                  className="btn-danger"
                  disabled={pending}
                  onClick={() => remove(s.codigo)}
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Tabla>
      <p className="small">
        Los horarios iniciales se cargan como configuración de prueba y se
        pueden editar. El horario rotativo de Edgar se conserva como nota y
        requiere reglas semanales más específicas antes de automatizarse.
      </p>
      <OperacionConfiguracion />
    </section>
  );
}
