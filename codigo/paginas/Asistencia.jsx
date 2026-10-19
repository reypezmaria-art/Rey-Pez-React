import RevisionAusencia from "../componentes/RevisionAusencia.jsx";
import { pendingAbsences } from "../dominio/asistencia.js";
import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  EncabezadoPagina,
  Tabla,
  Mensaje,
} from "../componentes/ElementosInterfaz.jsx";
import LogoMarca from "../componentes/LogoMarca.jsx";
import ExportarPdf from "../componentes/ExportarPdf.jsx";
import { companyNames } from "../datos/constantes.js";
import { formatDateTime } from "../utilidades/fechas.js";
import { concordar } from "../utilidades/textos.js";
import { reviewAlerts } from "../dominio/operaciones.js";
export default function Asistencia({ navigate, openKiosk }) {
  const { data, commit, pending, clock } = useAplicacion();
  const [error, setError] = useState("");
  const [company, setCompany] = useState("ALLAN");
  const absences = pendingAbsences(data, clock);
  const belongs = (r) =>
    (r.empresa_codigo ||
      data.employees.find(
        (e) => e.id_empleado === (r.id_empleado || r.employeeId),
      )?.empresa_codigo) === company;
  const records = data.attendance.filter(belongs);
  const pdfRecords = [
    ...records,
    ...(data.absenceReviews || []).filter(belongs),
  ];
  const alerts = data.alerts
    .filter((a) => a.estado === "Pendiente")
    .slice(0, 50);
  async function review() {
    try {
      await commit(reviewAlerts);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <EncabezadoPagina
        title="Asistencia 2 — Administración"
        subtitle="Supervisión de registros, actividad del equipo e incidencias; las decisiones quedan bajo revisión administrativa."
      >
        <button onClick={() => navigate("employees")}>Ver personal</button>
      </EncabezadoPagina>
      <div className="panel">
        <h2>Ausencias pendientes de revisión</h2>
        <p className="small">
          Lunes a sábado, después de la entrada y su tolerancia. Sin sanciones
          ni descuentos automáticos.
        </p>
        {Object.keys(companyNames).map((code) => (
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
      <div className="toolbar">
        <label>
          Empresa de asistencia{" "}
          <select
            aria-label="Empresa de asistencia"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            {Object.keys(companyNames).map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      <ExportarPdf
        data={data}
        records={pdfRecords}
        kind="attendance"
        title="Asistencia e incidencias"
        company={company}
      />
      <div className="panel">
        <h2>Historial de incidencias · {company}</h2>
        <Tabla
          headings={["Fecha", "Empleado", "Clasificación", "Motivo", "Revisó"]}
          count={(data.absenceReviews || []).filter(belongs).length}
        >
          {(data.absenceReviews || []).filter(belongs).map((r) => (
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
      <div className="columns">
        <div className="panel">
          <LogoMarca variant="attendance" />
          <h2 className="center">Vista de prueba del registro</h2>
          <p className="sub center">
            Para registrar como trabajador, abre Asistencia 1 · Trabajador.
          </p>
          <button className="attbtn primary" onClick={openKiosk}>
            Abrir pantalla de trabajador
          </button>
          <p className="small">
            Esta vista administrativa no sustituye una autenticación real.
          </p>
        </div>
        <div className="panel">
          <h2>Registros recientes</h2>
          <Tabla
            headings={[
              "Fecha y hora",
              "ID / empleado",
              "Movimiento",
              "Incidencia",
            ]}
            count={records.length}
            empty="Sin registros todavía"
          >
            {records.slice(0, 30).map((a, i) => (
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
        </div>
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
      </div>
      <p className="small">
        Tolerancia de 10 minutos. La comida se mide desde la salida real. Las
        revisiones no generan descuentos ni autorizan tiempo extra
        automáticamente.
      </p>
    </section>
  );
}
