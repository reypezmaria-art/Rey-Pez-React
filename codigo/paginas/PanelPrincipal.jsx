import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { EncabezadoPagina } from "../componentes/ElementosInterfaz.jsx";
import GraficasIncidencias from "../componentes/GraficasIncidencias.jsx";
import {
  calendarDate,
  formatDateTime,
  isSameDay,
} from "../utilidades/fechas.js";
import { concordar } from "../utilidades/textos.js";
import { pendingAbsences } from "../dominio/asistencia.js";
import { pendingPrograms } from "../dominio/bitacoras.js";
import { pendientesPanel, personalDeHoy } from "../dominio/panel.js";
export default function PanelPrincipal({ navigate }) {
  const { data, clock } = useAplicacion();
  const today = data.attendance.filter((a) => isSameDay(a.fecha_hora, clock));
  const absences = pendingAbsences(data, clock);
  const due = pendingPrograms(data, clock);
  const personal = personalDeHoy(data, clock);
  const cards = [
    [
      "Empresas",
      3,
      "Datos y estado de cada empresa",
      () => navigate("dashboardDetail", { tipo: "empresas" }),
    ],
    [
      "Total de empleados",
      data.employees.length,
      "Ver personal por empresa",
      () => navigate("employees", { resumen: true }),
    ],
    [
      "Registros de hoy",
      today.length,
      "Ver movimientos de hoy",
      () => navigate("dashboardDetail", { tipo: "registros" }),
    ],
    [
      "Alertas por revisar",
      pendientesPanel(data, clock).length,
      "Ver todos los pendientes",
      () => navigate("dashboardDetail", { tipo: "pendientes" }),
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
      <div className="cards">
        {cards.map(([label, value, foot, abrir]) => (
          <button className="card metric-card" key={label} onClick={abrir}>
            <span className="klabel">{label}</span>
            <span className="kvalue">{value}</span>
            <span className="kfoot">{foot}</span>
          </button>
        ))}
      </div>
      <GraficasIncidencias navigate={navigate} />
      <div className="cards">
        {[
          [
            "Con entrada",
            personal.filter((e) =>
              ["ENTRADA", "REGRESO_DE_COMER"].includes(e.movimientoHoy),
            ).length,
            "entrada",
          ],
          [
            "En comida",
            personal.filter((e) => e.movimientoHoy === "SALIDA_A_COMER").length,
            "comida",
          ],
          [
            "Jornada finalizada",
            personal.filter((e) => e.movimientoHoy === "SALIDA_FINAL").length,
            "salida",
          ],
          ["Ausencias por revisar", absences.length, "ausencias"],
        ].map(([label, value, tipo]) => (
          <button
            className="card metric-card"
            key={label}
            onClick={() => navigate("dashboardDetail", { tipo })}
          >
            <span className="klabel">{label}</span>
            <span className="kvalue">{value}</span>
            <span className="kfoot">Ver detalle</span>
          </button>
        ))}
      </div>
      <div className="columns">
        <div className="panel">
          <h2>Pendientes administrativos</h2>
          <p>
            {concordar(
              absences.length,
              "ausencia pendiente de revisión",
              "ausencias pendientes de revisión",
            )}
          </p>
          <p>
            {concordar(
              due.length,
              "revisión de bitácora pendiente",
              "revisiones de bitácoras pendientes",
            )}
          </p>
          <p>
            {concordar(
              data.logs.filter(
                (l) => l.expiry && l.expiry < calendarDate(clock),
              ).length,
              "certificado vencido",
              "certificados vencidos",
            )}
          </p>
          <div className="actions">
            <button
              onClick={() =>
                navigate("dashboardDetail", { tipo: "pendientes" })
              }
            >
              Ver todos los pendientes
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
          <button
            onClick={() => navigate("dashboardDetail", { tipo: "registros" })}
          >
            Ver todos los registros de hoy
          </button>
        </div>
      </div>
    </section>
  );
}
