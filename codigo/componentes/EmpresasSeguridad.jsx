import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Campo, Mensaje, Tabla } from "./ElementosInterfaz.jsx";
import {
  fichaEmpresa,
  guardarEmpresa,
  nombresEmpresas,
} from "../dominio/empresas.js";
import { calendarDate, formatDateTime } from "../utilidades/fechas.js";

export default function EmpresasSeguridad({ abierta = false }) {
  const { data, commit, pending, clock } = useAplicacion();
  const [codigo, setCodigo] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const nombres = nombresEmpresas(data);
  const cambios = (data.audit || []).filter(
    (a) => a.action === "Datos de empresa actualizados" && a.company === codigo,
  );
  function seleccionar(valor) {
    setCodigo(valor);
    setForm(
      valor
        ? {
            ...fichaEmpresa(data, valor),
            motivo: "",
            fechaVigencia: calendarDate(clock),
          }
        : null,
    );
    setError("");
    setMensaje("");
  }
  async function guardar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    try {
      await commit((state) => guardarEmpresa(state, form));
      setForm((actual) => ({ ...actual, motivo: "" }));
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
                label="Fecha de vigencia del cambio"
                type="date"
                max={calendarDate(clock)}
                required
                {...campo("fechaVigencia")}
              />
              <Campo
                label="Motivo del cambio de empresa"
                required
                maxLength={500}
                {...campo("motivo")}
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
          <h3>Historial de cambios de empresa</h3>
          <Tabla
            headings={[
              "Fecha",
              "Cambio",
              "Datos anteriores",
              "Datos actualizados",
              "Responsable",
            ]}
            count={cambios.length}
          >
            {cambios.map((c) => (
              <tr key={c.id}>
                <td>{formatDateTime(c.when)}</td>
                <td>{c.motivo}</td>
                <td>
                  <DatosFicha ficha={c.anterior} />
                </td>
                <td>
                  <DatosFicha ficha={c.siguiente} />
                </td>
                <td>{c.by}</td>
              </tr>
            ))}
          </Tabla>
        </>
      )}
    </details>
  );
}
function DatosFicha({ ficha }) {
  if (!ficha) return "—";
  return (
    <>
      {ficha.razonSocial}
      <br />
      RFC: {ficha.rfc || "Sin registrar"}
      <br />
      Régimen: {ficha.regimenFiscal || "Sin registrar"}
      <br />
      Giro: {ficha.giro || "Sin registrar"}
      <br />
      {ficha.estatus} · {ficha.fechaVigencia || "Sin fecha"}
    </>
  );
}
