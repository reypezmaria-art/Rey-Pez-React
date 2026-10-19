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
const sections = [
  {
    id: "horarios",
    title: "Horarios",
    description:
      "Horarios, comida, vigencias, excepciones y días no laborables",
    icon: "clock",
  },
  {
    id: "areas",
    title: "Áreas y cuartos fríos",
    description: "Administra las áreas y sus códigos QR",
    icon: "areas",
  },
  {
    id: "programacion",
    title: "Programación de bitácoras",
    description: "Organiza las revisiones por empresa, área, días y horas",
    icon: "calendar",
  },
  {
    id: "equipos",
    title: "Vinculación de equipos",
    description: "Configura los equipos de asistencia y captura",
    icon: "device",
  },
];
function SectionIcon({ type }) {
  return (
    <svg
      className="log-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "clock" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : type === "areas" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h4v4h-7Z" />
        </>
      ) : type === "calendar" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 11h18m-13 5h3m3 0h2" />
        </>
      ) : (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </>
      )}
    </svg>
  );
}
export default function Configuracion() {
  const { data, commit, pending } = useAplicacion();
  const [selected, setSelected] = useState(null);
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
  const current = sections.find((s) => s.id === selected);
  if (!current)
    return (
      <section>
        <EncabezadoPagina
          title="Configuración"
          subtitle="Elige el apartado que quieres administrar."
        />
        <div className="folder-grid">
          {sections.map((s) => (
            <button
              key={s.id}
              className="folder-card"
              onClick={() => setSelected(s.id)}
            >
              <SectionIcon type={s.icon} />
              <strong>{s.title}</strong>
              <small>{s.description}</small>
            </button>
          ))}
        </div>
      </section>
    );
  return (
    <section>
      <div className="actions">
        <button
          onClick={() => {
            setSelected(null);
            setEditor(null);
            setError("");
            setMessage("");
          }}
        >
          ← Volver a Configuración
        </button>
      </div>
      <EncabezadoPagina
        title={current.title}
        subtitle={
          selected === "horarios"
            ? "Administra horarios, comida y vigencias desde la web"
            : current.description
        }
      >
        {selected === "horarios" && (
          <button
            className="primary"
            onClick={() => setEditor({ schedule: undefined })}
          >
            + Agregar horario
          </button>
        )}
      </EncabezadoPagina>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{message}</Mensaje>
      {selected === "horarios" && (
        <>
          {editor && (
            <FormularioHorario
              key={editor.schedule?.codigo || "new"}
              schedule={editor.schedule}
              onClose={() => setEditor(null)}
              onSaved={() => {
                setEditor(null);
                setMessage("Horario guardado.");
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
        </>
      )}
      <OperacionConfiguracion key={selected} section={selected} />
    </section>
  );
}
