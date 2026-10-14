import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  Mensaje,
  Tabla,
  EncabezadoPagina,
} from "../componentes/ElementosInterfaz.jsx";
import { saveMaintenance } from "../dominio/bitacoras.js";
import { readEvidence } from "../utilidades/evidencias.js";
import { localDate } from "../utilidades/fechas.js";
export default function Mantenimiento() {
  const { data, commit, session, pending } = useAplicacion();
  const [form, setForm] = useState({
      room: "",
      type: "Mantenimiento",
      when: localDate(),
      description: "",
      provider: "",
      cost: "",
      notes: "",
      evidence: null,
    }),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    try {
      await commit((state) => saveMaintenance(state, form, session));
      setMessage("Actividad guardada.");
      setError("");
      setForm({
        ...form,
        description: "",
        notes: "",
        cost: "",
        evidence: null,
      });
    } catch (err) {
      setError(err.message);
    }
  }
  async function attach(e) {
    try {
      setForm({
        ...form,
        evidence: await readEvidence(e.target.files[0], true),
      });
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  }
  return (
    <section>
      <EncabezadoPagina
        title="Mantenimiento y compras"
        subtitle="Reparaciones, piezas y equipo de cuartos fríos."
      />
      <form className="panel" onSubmit={submit}>
        <div className="formgrid">
          <Campo label="Cuarto frío" as="select" required {...field("room")}>
            <option value="">Selecciona…</option>
            {data.rooms
              .filter((r) => r.active)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.company} · {r.name}
                </option>
              ))}
          </Campo>
          <Campo label="Actividad" as="select" {...field("type")}>
            {["Mantenimiento", "Reparación", "Compra de pieza o equipo"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </Campo>
          <Campo label="Fecha" type="date" required {...field("when")} />
          <Campo label="Descripción" required {...field("description")} />
          <Campo
            label="Proveedor / técnico (opcional)"
            {...field("provider")}
          />
          <Campo
            label="Costo MXN (opcional)"
            type="number"
            min="0"
            step="0.01"
            {...field("cost")}
          />
          <Campo label="Observaciones" as="textarea" {...field("notes")} />
          <Campo
            label="Comprobante / foto (opcional, máximo 1 MB)"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={attach}
          />
          {form.evidence && <p>{form.evidence.name}</p>}
        </div>
        <button className="primary" disabled={pending}>
          Guardar actividad
        </button>
        <Mensaje>{message}</Mensaje>
        <Mensaje error>{error}</Mensaje>
      </form>
      <Tabla
        headings={[
          "Fecha",
          "Cuarto",
          "Actividad",
          "Descripción",
          "Proveedor",
          "Costo / comprobante",
        ]}
        count={data.maintenance.length}
      >
        {data.maintenance.map((m) => (
          <tr key={m.id}>
            <td>{m.when}</td>
            <td>{m.room}</td>
            <td>{m.type}</td>
            <td>
              {m.description}
              <p>{m.notes}</p>
            </td>
            <td>{m.provider}</td>
            <td>
              {m.cost === null
                ? "—"
                : new Intl.NumberFormat("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  }).format(m.cost)}
              {m.evidence && (
                <p>
                  <a href={m.evidence.data} download={m.evidence.name}>
                    Comprobante
                  </a>
                </p>
              )}
            </td>
          </tr>
        ))}
      </Tabla>
    </section>
  );
}
