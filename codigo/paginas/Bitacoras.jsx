import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  Mensaje,
  EncabezadoPagina,
  OpcionesEmpresa,
  Tabla,
} from "../componentes/ElementosInterfaz.jsx";
import { logTypes } from "../datos/operacionInicial.js";
import { canCapture } from "../dominio/seguridad.js";
import { pendingPrograms } from "../dominio/bitacoras.js";
import { readEvidence } from "../utilidades/evidencias.js";
import { localDate, formatDateTime } from "../utilidades/fechas.js";
function nowInput() {
  const now = new Date();
  return `${localDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
export default function Bitacoras({
  operational = false,
  onlyTemperature = false,
}) {
  const { data, session, capture, pending, clock } = useAplicacion();
  const permission = data.access.permissions[session?.id];
  const [company, setCompany] = useState(permission?.company || "ALLAN"),
    [type, setType] = useState(
      onlyTemperature ? "temperature" : permission?.logs?.[0] || "chlorine",
    ),
    [area, setArea] = useState(""),
    [when, setWhen] = useState(nowInput),
    [value, setValue] = useState(""),
    [notes, setNotes] = useState(""),
    [notApplicable, setNotApplicable] = useState(false),
    [evidence, setEvidence] = useState(null),
    [programKey, setProgramKey] = useState(""),
    [expiry, setExpiry] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const qrArea = operational
    ? new URLSearchParams(location.hash.split("?")[1] || "").get("area")
    : null;
  const qr = data.areas.concat(data.rooms).find((a) => a.id === qrArea);
  const selectedCompany =
    qr?.company || (session.role === "worker" ? permission?.company : company);
  const selectedArea = qr?.id || area;
  const types = Object.entries(logTypes).filter(
    ([key]) =>
      (!onlyTemperature || key === "temperature") &&
      canCapture(data, session, selectedCompany, key),
  );
  const selectedType = types.some(([key]) => key === type)
    ? type
    : types[0]?.[0];
  const areas = (
    selectedType === "temperature" ? data.rooms : data.areas
  ).filter((a) => a.company === selectedCompany && a.active !== false);
  const due = pendingPrograms(data, clock).filter(
    (p) =>
      p.company === selectedCompany &&
      p.type === selectedType &&
      (!selectedArea || p.area === selectedArea),
  );
  const history = data.logs.filter(
    (l) =>
      l.company === selectedCompany &&
      (!selectedType || l.type === selectedType) &&
      (!selectedArea || l.area === selectedArea) &&
      canCapture(data, session, l.company, l.type),
  );
  const field = (setter, current) => ({
    value: current,
    onChange: (e) => setter(e.target.value),
  });
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await capture({
        company: selectedCompany,
        type: selectedType,
        area: selectedArea,
        when,
        value,
        notes,
        notApplicable,
        evidence,
        programKey,
        expiry,
      });
      setValue("");
      setNotes("");
      setEvidence(null);
      setProgramKey("");
      setMessage("Registro guardado con responsable, fecha e historial.");
    } catch (err) {
      setError(err.message);
    }
  }
  async function attach(e) {
    setError("");
    try {
      setEvidence(
        await readEvidence(
          e.target.files[0],
          ["health", "fumigation"].includes(selectedType),
        ),
      );
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  }
  return (
    <section>
      <EncabezadoPagina
        title={
          operational
            ? "Captura operativa autorizada"
            : onlyTemperature
              ? "Cuartos fríos · temperaturas"
              : "Bitácoras y EPP"
        }
        subtitle="Registro por empresa, área y responsable. Las revisiones permanecen en el historial."
      />
      {!types.length ? (
        <div className="note">
          María debe autorizar las bitácoras de tu perfil para esta empresa.
        </div>
      ) : (
        <>
          <div className="toolbar">
            {session.role === "admin" && !qr && (
              <select
                aria-label="Empresa de bitácora"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setArea("");
                  setProgramKey("");
                }}
              >
                <OpcionesEmpresa />
              </select>
            )}
            <select
              aria-label="Tipo de bitácora"
              value={selectedType}
              onChange={(e) => {
                setType(e.target.value);
                setArea("");
                setValue("");
                setProgramKey("");
              }}
            >
              {types.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {selectedType === "temperature" && (
            <div className="temperature-guide">
              <span>Óptimo ≤ −25 °C</span>
              <span>Observación: −25 &lt; °C &lt; −19</span>
              <span>Atención ≥ −19 °C</span>
            </div>
          )}
          {selectedType === "temperature" && !areas.length ? (
            <div className="note">
              Los cuartos fríos de Edgar siguen pendientes de confirmación.
              María puede registrarlos en Configuración cuando estén definidos.
            </div>
          ) : (
            <form className="panel" onSubmit={submit}>
              <h2>Nueva revisión · {logTypes[selectedType]}</h2>
              <div className="formgrid">
                <Campo
                  label={
                    selectedType === "temperature" ? "Cuarto frío" : "Área"
                  }
                  as="select"
                  value={selectedArea}
                  disabled={Boolean(qr)}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setProgramKey("");
                  }}
                  required
                >
                  <option value="">Selecciona…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Campo>
                <Campo
                  label="Fecha y hora de revisión"
                  type="datetime-local"
                  required
                  {...field(setWhen, when)}
                />
                <Campo
                  label="Revisión programada (opcional)"
                  as="select"
                  {...field(setProgramKey, programKey)}
                >
                  <option value="">Captura adicional / no programada</option>
                  {due.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.date} · {p.time} ·{" "}
                      {
                        data.areas
                          .concat(data.rooms)
                          .find((a) => a.id === p.area)?.name
                      }
                    </option>
                  ))}
                </Campo>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={notApplicable}
                    onChange={(e) => setNotApplicable(e.target.checked)}
                  />
                  No aplica (requiere motivo)
                </label>
                {!notApplicable && (
                  <Campo
                    label={
                      selectedType === "temperature"
                        ? "Temperatura (°C)"
                        : selectedType === "chlorine"
                          ? "Resultado / concentración y unidad"
                          : "Resultado de revisión"
                    }
                    type={selectedType === "temperature" ? "number" : "text"}
                    step="0.1"
                    required
                    {...field(setValue, value)}
                  />
                )}
                {["health", "fumigation"].includes(selectedType) && (
                  <Campo
                    label="Vencimiento del certificado"
                    type="date"
                    {...field(setExpiry, expiry)}
                  />
                )}
                {selectedType === "epp" && (
                  <p className="small">
                    Describe botas, cofia, guantes, faja y ropa térmica que
                    correspondan al área; registra el estado y las reposiciones
                    necesarias.
                  </p>
                )}
                <Campo
                  label="Observaciones / motivo de No aplica"
                  as="textarea"
                  rows={3}
                  required={notApplicable}
                  {...field(setNotes, notes)}
                />
                <Campo
                  label="Evidencia opcional (máximo 1 MB)"
                  type="file"
                  accept={
                    ["health", "fumigation"].includes(selectedType)
                      ? "image/jpeg,image/png,image/webp,application/pdf"
                      : "image/jpeg,image/png,image/webp"
                  }
                  onChange={attach}
                />
                {evidence && (
                  <p>
                    {evidence.name}{" "}
                    <button type="button" onClick={() => setEvidence(null)}>
                      Quitar adjunto
                    </button>
                  </p>
                )}
              </div>
              <button className="primary" disabled={pending}>
                Guardar revisión
              </button>
            </form>
          )}
          <Mensaje>{message}</Mensaje>
          <Mensaje error>{error}</Mensaje>
          {session.role === "admin" && (
            <div className="panel">
              <h2>Revisiones programadas pendientes: {due.length}</h2>
              {due.map((p) => (
                <p key={p.key}>
                  {p.time} ·{" "}
                  {
                    data.areas.concat(data.rooms).find((a) => a.id === p.area)
                      ?.name
                  }{" "}
                  · Pendiente de captura
                </p>
              ))}
              <p className="small">
                Estos avisos son administrativos. Una captura adicional no
                cierra una revisión programada; selecciona la revisión
                correspondiente.
              </p>
            </div>
          )}
          <div className="panel">
            <h2>Historial</h2>
            <Tabla
              headings={[
                "Fecha",
                "Área",
                "Responsable",
                "Resultado",
                "Observaciones / evidencia",
              ]}
              count={history.length}
            >
              {history.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.when)}</td>
                  <td>
                    {
                      data.rooms.concat(data.areas).find((a) => a.id === l.area)
                        ?.name
                    }
                  </td>
                  <td>{l.responsible}</td>
                  <td>
                    <span
                      className={`status ${l.result === "Requiere atención" ? "attention" : ""}`}
                    >
                      {l.result}
                      {l.type === "temperature" && !l.notApplicable
                        ? ` · ${l.value} °C`
                        : ""}
                    </span>
                    {l.expiry && <p>Vence: {l.expiry}</p>}
                  </td>
                  <td>
                    {l.notes}
                    {l.evidence && (
                      <p>
                        <a href={l.evidence.data} download={l.evidence.name}>
                          Descargar evidencia
                        </a>
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          </div>
        </>
      )}
    </section>
  );
}
