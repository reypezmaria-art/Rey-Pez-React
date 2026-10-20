import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Campo, Mensaje } from "./ElementosInterfaz.jsx";
import { localDate } from "../utilidades/fechas.js";
export default function RevisionAusencia({ employee }) {
  const { commit, pending } = useAplicacion();
  const [classification, setClassification] = useState("Permiso"),
    [notes, setNotes] = useState(""),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      if (!notes.trim()) throw Error("Indica el motivo de la revisión.");
      await commit((state) => ({
        ...state,
        absenceReviews: [
          {
            id: crypto.randomUUID(),
            employeeId: employee.id_empleado,
            empresa_codigo: employee.empresa_codigo,
            name: employee.nombre_completo,
            date: localDate(),
            classification,
            notes,
            by: "MARIA",
            when: new Date().toISOString(),
          },
          ...state.absenceReviews,
        ],
      }));
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="note" onSubmit={submit}>
      <b>{employee.nombre_completo}</b> · {employee.empresa_codigo}
      <p>Ausencia pendiente de revisión</p>
      <div className="formgrid">
        <Campo
          label={`Clasificación ${employee.id_empleado}`}
          as="select"
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
        >
          {[
            "Falta",
            "Permiso",
            "Incapacidad",
            "Vacaciones",
            "Emergencia",
            "Registro pendiente de corrección",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Campo>
        <Campo
          label={`Motivo ${employee.id_empleado}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required
        />
      </div>
      <button disabled={pending}>Guardar revisión de ausencia</button>
      <Mensaje error>{error}</Mensaje>
    </form>
  );
}
