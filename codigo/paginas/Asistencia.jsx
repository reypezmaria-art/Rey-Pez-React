import RevisionAusencia from "../componentes/RevisionAusencia.jsx";
import { pendingAbsences } from "../dominio/asistencia.js";
import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  EncabezadoPagina,
  Tabla,
  Mensaje,
} from "../componentes/ElementosInterfaz.jsx";
import LogoMarca from "../componentes/LogoMarca.jsx";
import ExportarPdf from "../componentes/ExportarPdf.jsx";
import { nombresEmpresas } from "../dominio/empresas.js";
import { formatDateTime } from "../utilidades/fechas.js";
import { concordar } from "../utilidades/textos.js";
import { reviewAlerts } from "../dominio/operaciones.js";
export default function Asistencia({ navigate, openKiosk }) {
  const { data, commit, pending, clock } = useAplicacion();
  const companyNames = nombresEmpresas(data);
  const [error, setError] = useState("");
  const [company, setCompany] = useState("ALLAN");
  const [apartado, setApartado] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [limite, setLimite] = useState(30);
  const absences = pendingAbsences(data, clock);
  const belongs = (r) =>
    (r.empresa_codigo ||
      data.employees.find(
        (e) => e.id_empleado === (r.id_empleado || r.employeeId),
      )?.empresa_codigo) === company;
  const records = data.attendance
    .filter(belongs)
    .sort((a, b) => Date.parse(b.fecha_hora) - Date.parse(a.fecha_hora));
  const historial = (data.absenceReviews || []).filter(belongs);
  const coincide = (r) =>
    !buscar.trim() ||
    JSON.stringify(r)
      .toLocaleLowerCase("es-MX")
      .includes(buscar.trim().toLocaleLowerCase("es-MX"));
  const registrosFiltrados = records.filter(coincide);
  const historialFiltrado = historial.filter(coincide);
  const pdfRecords = [
    ...records,
    ...(data.absenceReviews || []).filter(belongs),
  ];
  const alerts = data.alerts.filter(
    (a) => a.estado === "Pendiente" && belongs(a),
  );
  async function review() {
    try {
      await commit((state) => reviewAlerts(state, company));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <EncabezadoPagina
        title="Asistencia 2 — Administración"
        subtitle="Revisión y reportes de asistencia por empresa."
      >
        <button onClick={() => navigate("employees")}>Ver personal</button>
      </EncabezadoPagina>
      <div className="toolbar">
        <label>
          Empresa de asistencia{" "}
          <select
            aria-label="Empresa de asistencia"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setBuscar("");
              setLimite(30);
            }}
          >
            {Object.keys(companyNames).map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      {!apartado ? (
        <div className="folder-grid" aria-label="Apartados de asistencia">
          {[
            [
              "ausencias",
              "♙",
              "Revisar ausencias",
              `${absences.filter((e) => e.empresa_codigo === company).length} pendientes`,
              "Clasificar faltas, permisos, incapacidades y otras ausencias.",
            ],
            [
              "registros",
              "◷",
              "Registros de asistencia",
              `${records.length} registros`,
              "Consultar entradas, comida, regresos y salidas.",
            ],
            [
              "historial",
              "▤",
              "Historial de incidencias",
              `${historial.length} revisiones`,
              "Consultar motivos y responsables de las revisiones.",
            ],
            [
              "alertas",
              "⚑",
              "Alertas pendientes",
              `${alerts.length} pendientes`,
              "Revisar marcaciones que requieren atención.",
            ],
            [
              "pdf",
              "▣",
              "Reporte en PDF",
              "Elegir fechas",
              "Generar el reporte de asistencia e incidencias.",
            ],
            [
              "terminal",
              "◉",
              "Pantalla de trabajador",
              "Abrir registro",
              "Acceder a la pantalla de marcación.",
            ],
          ].map(([id, icono, titulo, cantidad, descripcion]) => (
            <button
              className="folder-card"
              key={id}
              onClick={() => {
                setApartado(id);
                setBuscar("");
                setLimite(30);
              }}
            >
              <span aria-hidden="true">{icono}</span>
              <strong>{titulo}</strong>
              <small>
                {cantidad} · {descripcion}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="actions">
          <button
            onClick={() => {
              setApartado(null);
              setBuscar("");
            }}
          >
            ← Volver a Asistencia 2
          </button>
          <span>{companyNames[company]}</span>
        </div>
      )}
      {apartado === "ausencias" && (
        <div className="panel">
          <h2>Ausencias pendientes de revisión</h2>
          <p className="small">
            Lunes a sábado, después de la entrada y su tolerancia. Sin sanciones
            ni descuentos automáticos.
          </p>
          {[company].map((code) => (
            <details
              key={code}
              open={code === company}
              className="company-incidents"
            >
              <summary>
                {code} ·{" "}
                {concordar(
                  absences.filter((e) => e.empresa_codigo === code).length,
                  "pendiente",
                  "pendientes",
                )}
              </summary>
              {absences
                .filter((e) => e.empresa_codigo === code)
                .map((employee) => (
                  <RevisionAusencia
                    key={employee.id_empleado}
                    employee={employee}
                  />
                ))}
              {!absences.some((e) => e.empresa_codigo === code) && (
                <p>Sin ausencias pendientes.</p>
              )}
            </details>
          ))}
        </div>
      )}
      {apartado === "pdf" && (
        <ExportarPdf
          data={data}
          records={pdfRecords}
          kind="attendance"
          title="Asistencia e incidencias"
          company={company}
        />
      )}
      {apartado === "historial" && (
        <div className="panel">
          <h2>Historial de incidencias · {company}</h2>
          <Campo
            label="Buscar incidencia"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <Tabla
            headings={[
              "Fecha",
              "Empleado",
              "Clasificación",
              "Motivo",
              "Revisó",
            ]}
            count={historialFiltrado.length}
          >
            {historialFiltrado.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.name}</td>
                <td>{r.classification}</td>
                <td>{r.notes}</td>
                <td>{r.by}</td>
              </tr>
            ))}
          </Tabla>
        </div>
      )}
      {apartado === "terminal" && (
        <div className="panel">
          <LogoMarca variant="attendance" />
          <h2 className="center">Pantalla de registro</h2>
          <p className="sub center">
            Para registrar como trabajador, abre Asistencia 1 · Trabajador.
          </p>
          <button className="attbtn primary" onClick={openKiosk}>
            Abrir pantalla de trabajador
          </button>
        </div>
      )}
      {apartado === "registros" && (
        <div className="panel">
          <h2>Registros de asistencia</h2>
          <Campo
            label="Buscar registro"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              setLimite(30);
            }}
          />
          <p className="small">
            Mostrando {Math.min(limite, registrosFiltrados.length)} de{" "}
            {registrosFiltrados.length} registros.
          </p>
          <Tabla
            headings={[
              "Fecha y hora",
              "ID / empleado",
              "Movimiento",
              "Incidencia",
            ]}
            count={registrosFiltrados.length}
            empty="Sin registros todavía"
          >
            {registrosFiltrados.slice(0, limite).map((a, i) => (
              <tr key={a.id_registro || i}>
                <td>{formatDateTime(a.fecha_hora)}</td>
                <td>
                  {a.id_empleado}
                  <br />
                  {a.nombre_completo}
                </td>
                <td>{a.movimiento.replaceAll("_", " ")}</td>
                <td>{a.incidencia || "—"}</td>
              </tr>
            ))}
          </Tabla>
          {registrosFiltrados.length > limite && (
            <button onClick={() => setLimite((n) => n + 30)}>
              Mostrar más registros
            </button>
          )}
        </div>
      )}
      {apartado === "alertas" && (
        <div className="panel">
          <h2>Alertas para administración</h2>
          <p className="small">
            Estas alertas son internas; el trabajador no verá avisos por
            marcaciones fuera del intervalo previsto.
          </p>
          {alerts.length ? (
            alerts.map((a, i) => (
              <div className="note alert-note" key={a.id_alerta || i}>
                <b>{a.nombre_completo}</b> · {a.tipo}
                <br />
                <span className="small">
                  {formatDateTime(a.fecha_hora)} — {a.detalle}
                </span>
              </div>
            ))
          ) : (
            <p className="small">No hay alertas pendientes.</p>
          )}
          <div className="actions">
            <button disabled={pending || !alerts.length} onClick={review}>
              Marcar alertas como revisadas
            </button>
          </div>
          <Mensaje error>{error}</Mensaje>
        </div>
      )}
      {apartado && (
        <p className="small">
          Tolerancia de 10 minutos. La comida se mide desde la salida real. Las
          revisiones no generan descuentos ni autorizan tiempo extra
          automáticamente.
        </p>
      )}
    </section>
  );
}
