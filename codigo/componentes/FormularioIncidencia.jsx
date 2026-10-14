import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { incidentTypes } from "../datos/constantes.js";
import { saveManualIncident } from "../dominio/operaciones.js";
import { OpcionesEmpleado, Campo, Mensaje } from "./ElementosInterfaz.jsx";
export default function FormularioIncidencia() {
  const { data, commit, pending } = useAplicacion();
  const [form, setForm] = useState({
    employeeId: "",
    type: incidentTypes[0],
    when: "",
    reviewer: "",
    reason: "",
  });
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await commit((state) => saveManualIncident(state, form));
      setMessage(
        "Revisión guardada localmente. Descarga un respaldo para conservarla.",
      );
      setForm({ ...form, reason: "" });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Registrar / justificar una incidencia</h2>
      <p className="small">
        Para emergencias, correcciones justificadas o tiempo adicional. Esto no
        autoriza automáticamente horas extra.
      </p>
      <div className="formgrid">
        <Campo label="Empleado" as="select" required {...field("employeeId")}>
          <OpcionesEmpleado employees={data.employees} />
        </Campo>
        <Campo label="Tipo" as="select" {...field("type")}>
          {incidentTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Campo>
        <Campo
          label="Fecha y hora"
          type="datetime-local"
          required
          {...field("when")}
        />
        <Campo
          label="Revisó"
          placeholder="Nombre de quien revisa"
          required
          {...field("reviewer")}
        />
        <Campo
          label="Motivo / evidencia / autorización"
          as="textarea"
          rows={2}
          className="span2"
          placeholder="Describe el motivo y la autorización, si existe"
          required
          {...field("reason")}
        />
      </div>
      <button className="primary" disabled={pending}>
        Guardar revisión administrativa
      </button>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{message}</Mensaje>
    </form>
  );
}
