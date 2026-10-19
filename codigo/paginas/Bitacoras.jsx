import ExportarPdf from "../componentes/ExportarPdf.jsx";
import ListaCumplimiento from "../componentes/ListaCumplimiento.jsx";
import { checklistFor, logAreas, areaLabel } from "../datos/listasRevision.js";
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
import { enlaceEvidencia, readEvidence } from "../utilidades/evidencias.js";
import { usandoFirebase } from "../repositorios/repositorio.js";
import { localDate, formatDateTime } from "../utilidades/fechas.js";
function nowInput() {
  const now = new Date();
  return `${localDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
export default function Bitacoras({
  operational = false,
  fixedType,
  fixedCompany,
  fixedArea,
  allowedAreaIds,
  sectionTitle,
}) {
  const { data, session, capture, pending, clock } = useAplicacion();
  const permission = data.access.permissions[session?.id];
  const [company, setCompany] = useState(permission?.company || "ALLAN"),
    [type, setType] = useState(
      fixedType || permission?.logs?.[0] || "chlorine",
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
    [error, setError] = useState(""),
    [answers, setAnswers] = useState([]),
    [subjectEmployeeId, setSubjectEmployeeId] = useState(""),
    [performedBy, setPerformedBy] = useState("");
  const qrArea = operational
    ? new URLSearchParams(location.hash.split("?")[1] || "").get("area")
    : null;
  const qr = data.areas.concat(data.rooms).find((a) => a.id === qrArea);
  const selectedCompany =
    qr?.company ||
    fixedCompany ||
    (session.role === "worker" ? permission?.company : company);
  const selectedArea = qr?.id || fixedArea || area;
  const types = Object.entries(logTypes).filter(
    ([key]) =>
      (!fixedType || key === fixedType) &&
      canCapture(data, session, selectedCompany, key),
  );
  const selectedType = types.some(([key]) => key === type)
    ? type
    : types[0]?.[0];
  const areas = logAreas(data, selectedType, selectedCompany).filter(
    (a) => !allowedAreaIds || allowedAreaIds.includes(a.id),
  );
  const template = checklistFor(data, selectedType, selectedArea);
  const checks = answers.filter((a) =>
    template?.items.some((i) => i.id === a.id),
  );
  const isChlorine = selectedType === "chlorine";
  const due = pendingPrograms(data, clock).filter(
    (p) =>
      p.company === selectedCompany &&
      p.type === selectedType &&
      (!selectedArea || p.area === selectedArea) &&
      (!allowedAreaIds || allowedAreaIds.includes(p.area)),
  );
  const history = data.logs.filter(
    (l) =>
      l.company === selectedCompany &&
      (!selectedType || l.type === selectedType) &&
      (!selectedArea || l.area === selectedArea) &&
      (!allowedAreaIds || allowedAreaIds.includes(l.area)) &&
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
        checks,
        subjectEmployeeId,
        performedBy,
      });
      setValue("");
      setNotes("");
      setEvidence(null);
      setProgramKey("");
      setAnswers([]);
      setSubjectEmployeeId("");
      setPerformedBy("");
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
          usandoFirebase ? { limiteImagen: 8000000 } : {},
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
            : sectionTitle || logTypes[selectedType]
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
            {session.role === "admin" && !qr && !fixedCompany && (
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
            {!fixedType && (
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
            )}
          </div>
          {selectedType === "temperature" && (
            <div className="temperature-guide">
              <span>Óptimo ≤ −25 °C</span>
              <span>Observación: −25 &lt; °C &lt; −19</span>
              <span>Atención ≥ −19 °C</span>
            </div>
          )}
          {!areas.length ? (
            <div className="note">
              {selectedType === "temperature" ||
              (selectedType === "epp" && allowedAreaIds)
                ? "Los cuartos fríos de esta empresa siguen pendientes de confirmación."
                : "Este apartado no tiene áreas confirmadas todavía."}{" "}
              María puede registrarlas en Configuración cuando estén definidas.
            </div>
          ) : (
            <form className="panel" onSubmit={submit}>
              <h2>Nueva revisión · {logTypes[selectedType]}</h2>
              <p className="small">Revisó: {session.name}</p>
              <div className="formgrid">
                <Campo
                  label={
                    selectedType === "temperature"
                      ? "Cuarto frío"
                      : isChlorine
                        ? "Lugar / área"
                        : "Área"
                  }
                  as="select"
                  value={selectedArea}
                  disabled={Boolean(qr || fixedArea)}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setProgramKey("");
                    setAnswers([]);
                  }}
                  required
                >
                  <option value="">Selecciona…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {areaLabel(a, selectedType)}
                    </option>
                  ))}
                </Campo>
                <Campo
                  label="Fecha y hora de revisión"
                  type="datetime-local"
                  required
                  {...field(setWhen, when)}
                />
                {!isChlorine && (
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
                )}
                {!isChlorine && !template && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={notApplicable}
                      onChange={(e) => setNotApplicable(e.target.checked)}
                    />
                    No aplica (requiere motivo)
                  </label>
                )}
                {!notApplicable && !template && (
                  <Campo
                    label={
                      selectedType === "temperature"
                        ? "Temperatura (°C)"
                        : selectedType === "chlorine"
                          ? "Valores de cloro en agua"
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
                  <Campo
                    label="Empleado revisado"
                    as="select"
                    value={subjectEmployeeId}
                    onChange={(e) => setSubjectEmployeeId(e.target.value)}
                    required={!notApplicable}
                  >
                    <option value="">Selecciona…</option>
                    {data.employees
                      .filter(
                        (e) =>
                          e.empresa_codigo === selectedCompany &&
                          e.estatus !== "Baja",
                      )
                      .map((e) => (
                        <option key={e.id_empleado} value={e.id_empleado}>
                          {e.nombre_completo}
                        </option>
                      ))}
                  </Campo>
                )}
                {!notApplicable && template && (
                  <ListaCumplimiento
                    template={template}
                    answers={checks}
                    onChange={setAnswers}
                  />
                )}
                {isChlorine && (
                  <Campo
                    label="Realizó"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    required
                  />
                )}
                <Campo
                  label={
                    isChlorine
                      ? "Observaciones"
                      : "Observaciones / motivo de No aplica"
                  }
                  as="textarea"
                  rows={3}
                  required={notApplicable}
                  {...field(setNotes, notes)}
                />
                {!isChlorine && (
                  <Campo
                    label={
                      usandoFirebase
                        ? "Evidencia opcional (se comprime y se guarda en Storage)"
                        : "Evidencia opcional (máximo 1 MB)"
                    }
                    type="file"
                    accept={
                      ["health", "fumigation"].includes(selectedType)
                        ? "image/jpeg,image/png,image/webp,application/pdf"
                        : "image/jpeg,image/png,image/webp"
                    }
                    onChange={attach}
                  />
                )}
                {evidence && (
                  <p>
                    {evidence.name}{" "}
                    <button type="button" onClick={() => setEvidence(null)}>
                      Quitar adjunto
                    </button>
                  </p>
                )}
              </div>
              <button
                className="primary"
                disabled={
                  pending || (!notApplicable && Boolean(template?.pending))
                }
              >
                Guardar revisión
              </button>
            </form>
          )}
          <Mensaje>{message}</Mensaje>
          <Mensaje error>{error}</Mensaje>
          {session.role === "admin" && !isChlorine && (
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
          <ExportarPdf
            data={data}
            records={history}
            kind={selectedType}
            title={sectionTitle || logTypes[selectedType]}
            company={selectedCompany}
          />
          <div className="panel">
            <h2>Historial</h2>
            <Tabla
              headings={
                isChlorine
                  ? [
                      "Fecha y hora",
                      "Lugar / área",
                      "Realizó",
                      "Valores de cloro en agua",
                      "Observaciones",
                    ]
                  : [
                      "Fecha",
                      "Área",
                      "Responsable",
                      "Resultado",
                      "Observaciones / evidencia",
                    ]
              }
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
                  <td>
                    {isChlorine
                      ? l.performedBy || l.responsible
                      : l.responsible}
                  </td>
                  <td>
                    <span
                      className={`status ${l.result === "Requiere atención" ? "attention" : ""}`}
                    >
                      {l.result}
                      {l.type === "temperature" && !l.notApplicable
                        ? ` · ${l.value} °C`
                        : ""}
                    </span>
                    {l.subjectName && <p>Empleado: {l.subjectName}</p>}
                    {l.checks?.length > 0 && (
                      <details>
                        <summary>Ver elementos revisados</summary>
                        {l.checks.map((c) => (
                          <p key={c.id}>
                            <b>{c.label}</b>:{" "}
                            {c.status === "yes" ? "Cumplió" : "No cumplió"}
                            {c.reason ? ` — ${c.reason}` : ""}
                          </p>
                        ))}
                      </details>
                    )}
                    {!isChlorine && l.performedBy && (
                      <p>Realizó: {l.performedBy}</p>
                    )}
                    {l.expiry && <p>Vence: {l.expiry}</p>}
                  </td>
                  <td>
                    {l.notes}
                    {enlaceEvidencia(l.evidence) && (
                      <p>
                        <a
                          href={enlaceEvidencia(l.evidence)}
                          download={l.evidence.name}
                        >
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
