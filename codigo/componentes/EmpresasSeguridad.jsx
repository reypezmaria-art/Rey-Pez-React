import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Campo, Mensaje } from "./ElementosInterfaz.jsx";
import {
  fichaEmpresa,
  guardarEmpresa,
  nombresEmpresas,
} from "../dominio/empresas.js";
import { calendarDate } from "../utilidades/fechas.js";

export default function EmpresasSeguridad({ abierta = false }) {
  const { data, commit, pending, clock } = useAplicacion();
  const [codigo, setCodigo] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const nombres = nombresEmpresas(data);
  function seleccionar(valor) {
    setCodigo(valor);
    setForm(valor ? { ...fichaEmpresa(data, valor) } : null);
    setError("");
    setMensaje("");
  }
  async function guardar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    try {
      await commit((state) => guardarEmpresa(state, form));
      setMensaje("Datos de empresa guardados.");
    } catch (err) {
      setError(err.message);
    }
  }
  const campo = (clave) => ({
    value: form[clave],
    onChange: (e) =>
      setForm((actual) => ({ ...actual, [clave]: e.target.value })),
  });
  return (
    <details className="panel company-settings" open={abierta || undefined}>
      <summary>Datos de empresas</summary>
      <Campo
        label="Empresa a editar"
        as="select"
        value={codigo}
        onChange={(e) => seleccionar(e.target.value)}
      >
        <option value="">Selecciona una empresa…</option>
        {Object.entries(nombres).map(([id, nombre]) => (
          <option key={id} value={id}>
            {id} · {nombre}
          </option>
        ))}
      </Campo>
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{mensaje}</Mensaje>
      {form && (
        <>
          <form onSubmit={guardar}>
            <div className="formgrid">
              <Campo
                label="Razón social"
                required
                maxLength={200}
                {...campo("razonSocial")}
              />
              <Campo
                label="RFC de la empresa"
                maxLength={13}
                {...campo("rfc")}
              />
              <Campo
                label="Régimen fiscal"
                maxLength={200}
                {...campo("regimenFiscal")}
              />
              <Campo
                label="Giro de la empresa"
                maxLength={200}
                {...campo("giro")}
              />
              <Campo
                label="Estado de la empresa"
                as="select"
                {...campo("estatus")}
              >
                <option>Activa</option>
                <option>Baja</option>
              </Campo>
              <Campo
                label="Activa desde"
                type="date"
                max={calendarDate(clock)}
                {...campo("activaDesde")}
              />
            </div>
            <p className="small">
              La baja conserva el personal y el historial. Los accesos de
              trabajadores se administran por separado.
            </p>
            <button className="primary" disabled={pending}>
              Guardar datos de empresa
            </button>
          </form>
        </>
      )}
    </details>
  );
}
