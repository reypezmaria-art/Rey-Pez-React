import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { saveEmployee } from "../dominio/operaciones.js";
import { normalizeDate } from "../utilidades/fechas.js";
import { OpcionesEmpresa, Campo, Mensaje } from "./ElementosInterfaz.jsx";
export default function FormularioEmpleado({ employee, onClose, onSaved }) {
  const { data, commit, pending } = useAplicacion();
  const [form, setForm] = useState({
    id_empleado: "",
    nombre_completo: "",
    empresa_codigo: "ALLAN",
    puesto: "",
    curp: "",
    tipo_puesto: "General",
    telefono: "",
    domicilio: "",
    fecha_nacimiento: "",
    contacto_emergencia: "",
    funciones: "",
    nss: "",
    codigo_horario: "",
    estatus: "Activo",
    observaciones: "",
    ...employee,
    fecha_ingreso: normalizeDate(employee?.fecha_ingreso),
  });
  const [error, setError] = useState("");
  const field = (key) => ({
    value: form[key] || "",
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(event) {
    event.preventDefault();
    try {
      await commit((state) => saveEmployee(state, form, employee?.id_empleado));
      onSaved(
        "Empleado guardado en este navegador. Descarga un respaldo periódicamente.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <h2>{employee ? "Modificar empleado" : "Agregar empleado"}</h2>
      <div className="formgrid">
        <Campo
          label="Nombre completo *"
          required
          autoFocus
          {...field("nombre_completo")}
        />
        <Campo label="Empresa *" as="select" {...field("empresa_codigo")}>
          <OpcionesEmpresa />
        </Campo>
        <Campo
          label="ID permanente (dejar vacío para asignar)"
          placeholder="Ej. RP-0031"
          {...field("id_empleado")}
        />
        <Campo
          label="Puesto / función *"
          required
          placeholder="Ej. Empleado general — descarga, limpieza..."
          {...field("puesto")}
        />
        <Campo label="Tipo de puesto" as="select" {...field("tipo_puesto")}>
          <option>General</option>
          <option>Administrativo</option>
        </Campo>
        <Campo label="Teléfono" type="tel" {...field("telefono")} />
        <Campo label="Domicilio" {...field("domicilio")} />
        <Campo
          label="Fecha de nacimiento"
          type="date"
          {...field("fecha_nacimiento")}
        />
        <Campo
          label="Contacto de emergencia"
          {...field("contacto_emergencia")}
        />
        <Campo
          label="Funciones específicas"
          as="textarea"
          {...field("funciones")}
        />
        <Campo
          label="CURP"
          maxLength={18}
          placeholder="CURP (opcional)"
          {...field("curp")}
        />
        <Campo
          label="Número de Seguro Social (NSS)"
          maxLength={11}
          placeholder="NSS (opcional)"
          {...field("nss")}
        />
        <Campo
          label="Fecha de ingreso"
          type="date"
          {...field("fecha_ingreso")}
        />
        <Campo
          label="Horario asignado"
          as="select"
          {...field("codigo_horario")}
        >
          <option value="">Según puesto / empresa</option>
          {form.codigo_horario &&
            !data.schedules.some((s) => s.codigo === form.codigo_horario) && (
              <option value={form.codigo_horario}>
                {form.codigo_horario} — Según puesto / empresa
              </option>
            )}
          {data.schedules.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.codigo} — {s.nombre}
            </option>
          ))}
        </Campo>
        <Campo label="Estado" as="select" {...field("estatus")}>
          <option>Activo</option>
          <option>Baja</option>
        </Campo>
        <Campo
          label="Observaciones / qué hace"
          as="textarea"
          className="span2"
          rows={3}
          placeholder="Funciones, áreas y observaciones"
          {...field("observaciones")}
        />
      </div>
      <Mensaje error>{error}</Mensaje>
      <div className="actions">
        <button className="primary" disabled={pending}>
          Guardar empleado
        </button>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
      <p className="small">
        Al dar de baja, se conserva el historial de asistencia. CURP y NSS son
        datos personales: limita el acceso y no los incluyas en reportes
        públicos.
      </p>
    </form>
  );
}
