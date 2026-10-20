import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Campo } from "./ElementosInterfaz.jsx";
import { calendarDate } from "../utilidades/fechas.js";
import { contarIncidencias, rangoPeriodo } from "../dominio/panel.js";
export default function GraficasIncidencias({ navigate }) {
  const { data, clock } = useAplicacion();
  const [semana, setSemana] = useState(calendarDate(clock));
  const [mes, setMes] = useState(calendarDate(clock).slice(0, 7));
  return (
    <section aria-label="Gráficas de incidencias">
      <h2>Incidencias por empresa</h2>
      <p className="small">
        Alertas de asistencia, revisiones de ausencias y alertas de seguridad
        registradas. Las revisadas permanecen en el conteo. Los registros sin
        empresa se muestran por separado.
      </p>
      <div className="columns">
        <Grafica
          data={data}
          titulo="Incidencias semanales"
          rango={rangoPeriodo("semana", semana)}
          navigate={navigate}
        >
          <Campo
            label="Semana que incluye"
            type="date"
            value={semana}
            onChange={(e) => setSemana(e.target.value)}
          />
        </Grafica>
        <Grafica
          data={data}
          titulo="Incidencias mensuales"
          rango={rangoPeriodo("mes", mes)}
          navigate={navigate}
        >
          <Campo
            label="Mes de incidencias"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </Grafica>
      </div>
    </section>
  );
}
function Grafica({ data, titulo, rango, children, navigate }) {
  const grupos = contarIncidencias(data, rango);
  const total = grupos.reduce((sum, g) => sum + g.total, 0);
  const max = Math.max(1, ...grupos.map((g) => g.total));
  const lideres = grupos
    .filter((g) => g.codigo && g.total === max)
    .map((g) => g.codigo);
  return (
    <section className="panel incidence-chart" aria-label={titulo}>
      <h3>{titulo}</h3>
      {children}
      {rango ? (
        <p>
          {rango.desde} al {rango.hasta}
        </p>
      ) : (
        <p>Selecciona un período válido.</p>
      )}
      <p>
        <strong>{total}</strong> incidencias en el período
      </p>
      <div className="chart-bars">
        {grupos.map((g, i) => (
          <button
            type="button"
            className="chart-row"
            key={g.codigo}
            aria-label={`Ver incidencias de ${g.codigo || "Sin empresa"}: ${g.total}`}
            disabled={!rango}
            onClick={() =>
              navigate("dashboardDetail", {
                tipo: "incidencias",
                rango,
                company: g.codigo,
              })
            }
          >
            <span>{g.codigo || "Sin empresa"}</span>
            <span className="chart-track" aria-hidden="true">
              <span
                className={`chart-fill color-${i % 3}`}
                style={{ width: `${(g.total / max) * 100}%` }}
              />
            </span>
            <strong>{g.total}</strong>
          </button>
        ))}
      </div>
      {total === 0 ? (
        <p>Sin incidencias registradas en este período.</p>
      ) : lideres.length > 0 ? (
        <p>Mayor número: {lideres.join(" · ")}.</p>
      ) : null}
      <button
        disabled={!rango}
        onClick={() =>
          navigate("dashboardDetail", { tipo: "incidencias", rango })
        }
      >
        Ver detalle del período
      </button>
    </section>
  );
}
