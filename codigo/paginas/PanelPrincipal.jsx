import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { EncabezadoPagina } from "../componentes/ElementosInterfaz.jsx";
import { formatDateTime, isSameDay } from "../utilidades/fechas.js";
import { pendingAbsences } from "../dominio/asistencia.js";
import { pendingPrograms } from "../dominio/bitacoras.js";
export default function PanelPrincipal({ navigate }) {
  const { data, clock } = useAplicacion();
  const today = data.attendance.filter((a) => isSameDay(a.fecha_hora, clock)),
    absences = pendingAbsences(data, clock),
    due = pendingPrograms(data, clock);
  const status = data.employees
    .filter((e) => e.estatus !== "Baja")
    .map((e) => {
      const last = today.find(
        (a) =>
          a.id_empleado === e.id_empleado &&
          a.movimiento !== "REVISION_ADMINISTRATIVA",
      );
      return last?.movimiento || "SIN_ENTRADA";
    });
  const cards = [
    ["Empresas", 3, "Allan · Edgar · Estuardo"],
    [
      "Empleados cargados",
      data.employees.length,
      data.catalogSource || "Catálogo de demostración",
    ],
    ["Registros de hoy", today.length, "Actualización en este navegador"],
    [
      "Alertas por revisar",
      data.alerts.filter((a) => a.estado === "Pendiente").length +
        absences.length +
        due.length,
      "Solo administración",
    ],
  ];
  return (
    <section>
      <EncabezadoPagina
        title="Panel principal"
        subtitle="María · Supervisión de las tres empresas"
      >
        <button className="primary" onClick={() => navigate("attendance")}>
          Revisar asistencia
        </button>
      </EncabezadoPagina>
      <div className="note">
        Revisión local: guarda sin conexión en este navegador. La nube, la
        sincronización entre dispositivos y la huella digital siguen pendientes
        de configuración.
      </div>
      <div className="cards">
        {cards.map(([label, value, foot]) => (
          <div className="card" key={label}>
            <div className="klabel">{label}</div>
            <div className="kvalue">{value}</div>
            <div className="kfoot">{foot}</div>
          </div>
        ))}
      </div>
      <div className="cards">
        {[
          [
            "Con entrada",
            status.filter((s) => ["ENTRADA", "REGRESO_DE_COMER"].includes(s))
              .length,
          ],
          ["En comida", status.filter((s) => s === "SALIDA_A_COMER").length],
          [
            "Jornada finalizada",
            status.filter((s) => s === "SALIDA_FINAL").length,
          ],
          ["Ausencias por revisar", absences.length],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <div className="klabel">{label}</div>
            <div className="kvalue">{value}</div>
          </div>
        ))}
      </div>
      <div className="columns">
        <div className="panel">
          <h2>Pendientes administrativos</h2>
          <p>{absences.length} ausencias pendientes de revisión</p>
          <p>{due.length} revisiones de bitácoras pendientes</p>
          <p>
            {
              data.logs.filter(
                (l) => l.expiry && l.expiry < clock.toISOString().slice(0, 10),
              ).length
            }{" "}
            certificados vencidos
          </p>
          <div className="actions">
            <button onClick={() => navigate("attendance")}>
              Revisar ausencias
            </button>
            <button onClick={() => navigate("logs")}>Bitácoras de salud</button>
            <button onClick={() => navigate("epp")}>Bitácora de EPP</button>
          </div>
        </div>
        <div className="panel">
          <h2>Actividad reciente</h2>
          {today.length ? (
            today.slice(0, 5).map((a) => (
              <p key={a.id_registro}>
                <b>{a.movimiento.replaceAll("_", " ")}</b> · {a.nombre_completo}
                <br />
                {formatDateTime(a.fecha_hora)}
              </p>
            ))
          ) : (
            <p>Sin registros de hoy.</p>
          )}
        </div>
        <div className="panel">
          <h2>Personal por empresa</h2>
          {["ALLAN", "EDGAR", "ESTUARDO"].map((company) => (
            <p key={company}>
              <b>{company}</b> ·{" "}
              {
                data.employees.filter((e) => e.empresa_codigo === company)
                  .length
              }{" "}
              empleados ·{" "}
              {
                data.employees.filter(
                  (e) => e.empresa_codigo === company && e.estatus === "Baja",
                ).length
              }{" "}
              bajas
            </p>
          ))}
          <p className="small">
            Los 30 registros recuperados se conservan. Las diferencias con los
            conteos posteriores quedan para revisión, sin eliminar ni inventar
            empleados.
          </p>
          <button onClick={() => navigate("employees")}>
            Administrar personal
          </button>
        </div>
      </div>
    </section>
  );
}
