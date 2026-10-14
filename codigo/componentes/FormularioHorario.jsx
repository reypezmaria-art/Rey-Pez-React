import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { saveSchedule } from "../dominio/operaciones.js";
import { OpcionesEmpresa, Campo, Mensaje } from "./ElementosInterfaz.jsx";
export default function FormularioHorario({ schedule, onClose, onSaved }) {
  const { commit, pending } = useAplicacion();
  const [form, setForm] = useState({
    codigo: "",
    empresa_codigo: "ESTUARDO",
    nombre: "",
    hora_inicio: "",
    hora_fin: "",
    comida_inicio: "",
    comida_fin: "",
    vigente_desde: "",
    notas: "",
    ...schedule,
  });
  const [error, setError] = useState("");
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(event) {
    event.preventDefault();
    try {
      await commit((state) => saveSchedule(state, form, schedule?.codigo));
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <h2>{schedule ? "Modificar horario" : "Agregar horario"}</h2>
      <div className="formgrid">
        <Campo
          label="Código *"
          required
          autoFocus
          placeholder="Ej. EST-GEN"
          {...field("codigo")}
        />
        <Campo label="Empresa *" as="select" {...field("empresa_codigo")}>
          <OpcionesEmpresa />
        </Campo>
        <Campo
          label="Nombre del horario *"
          required
          placeholder="Ej. Estuardo general"
          {...field("nombre")}
        />
        <Campo label="Entrada" type="time" {...field("hora_inicio")} />
        <Campo label="Salida de turno" type="time" {...field("hora_fin")} />
        <Campo
          label="Inicio de comida"
          type="time"
          {...field("comida_inicio")}
        />
        <Campo label="Fin de comida" type="time" {...field("comida_fin")} />
        <Campo label="Vigente desde" type="date" {...field("vigente_desde")} />
        <Campo label="Notas / rotación" {...field("notas")} />
      </div>
      <Mensaje error>{error}</Mensaje>
      <div className="actions">
        <button className="primary" disabled={pending}>
          Guardar horario
        </button>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
