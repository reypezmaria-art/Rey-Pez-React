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
import FormularioIncidencia from "../componentes/FormularioIncidencia.jsx";
import { formatDateTime } from "../utilidades/fechas.js";
import { reviewAlerts } from "../dominio/operaciones.js";
export default function Asistencia({ navigate, openKiosk }) {
  const { data, commit, pending, clock } = useAplicacion();
  const [error, setError] = useState("");
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
        {pendingAbsences(data, clock).map((employee) => (
          <RevisionAusencia key={employee.id_empleado} employee={employee} />
        ))}
        {!pendingAbsences(data, clock).length && (
          <p>Sin ausencias pendientes.</p>
        )}
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
            count={data.attendance.length}
            empty="Sin registros todavía"
          >
            {data.attendance.slice(0, 30).map((a, i) => (
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
        <FormularioIncidencia />
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
