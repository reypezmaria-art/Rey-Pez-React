import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  EncabezadoPagina,
  Mensaje,
  Campo,
  OpcionesEmpresa,
  Tabla,
} from "../componentes/ElementosInterfaz.jsx";
import { toCSV } from "../utilidades/archivosCsv.js";
import { download } from "../utilidades/descargas.js";
import { localDate } from "../utilidades/fechas.js";
import { repository, usaFirebase } from "../repositorios/repositorio.js";
import {
  validateState,
  migrateState,
} from "../repositorios/repositorioLocal.js";
export default function Reportes() {
  const { data, commit, logout } = useAplicacion();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [company, setCompany] = useState(""),
    [from, setFrom] = useState(localDate()),
    [to, setTo] = useState(localDate()),
    [type, setType] = useState("attendance");
  const source = type === "absenceReviews" ? data.absenceReviews : data[type];
  const rows = source.filter((r) => {
    const code =
      r.empresa_codigo ||
      r.company ||
      data.rooms.find((a) => a.id === r.room)?.company ||
      data.employees.find((e) => e.id_empleado === r.employeeId)
        ?.empresa_codigo;
    const day = (r.fecha_hora || r.when || r.date || "").slice(0, 10);
    return (
      (!company || code === company) &&
      (!from || day >= from) &&
      (!to || day <= to)
    );
  });
  const exportCSV = (key, items = data[key]) => {
    try {
      download(
        `${key === "employees" ? "empleados" : key === "attendance" ? "asistencia" : key}_rey_pez.csv`,
        toCSV(
          items.map(({ evidence, ...r }) => ({
            ...r,
            adjunto: evidence?.name || "",
          })),
        ),
      );
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };
  function backup() {
    download(
      "respaldo_rey_pez.json",
      JSON.stringify(
        { ...data, fecha_respaldo: new Date().toISOString() },
        null,
        2,
      ),
      "application/json",
    );
  }
  async function restore(input) {
    try {
      let state = input;
      if (input.empleados)
        state = {
          employees: input.empleados,
          attendance: input.asistencia,
          schedules: input.horarios,
          alerts: input.alertas,
        };
      validateState(state);
      if (
        !confirm(
          "¿Restaurar este respaldo? Se conserva un respaldo automático previo. Se cerrará la sesión.",
        )
      )
        return;
      await commit((current) =>
        migrateState({ ...state, access: state.access || current.access }),
      );
      setMessage("Respaldo restaurado.");
      logout();
    } catch (err) {
      setError(err.message);
    }
  }
  async function restoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await restore(JSON.parse(await file.text()));
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  }
  const backups = repository.backups();
  return (
    <section>
      <EncabezadoPagina
        title="Reportes y respaldos"
        subtitle="Filtros por empresa y fechas; exportación CSV y restauración completa."
      />
      <Mensaje error>{error}</Mensaje>
      <Mensaje>{message}</Mensaje>
      <div className="panel">
        <h2>Reporte de operación</h2>
        <div className="formgrid">
          <Campo
            label="Reporte"
            as="select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {Object.entries({
              attendance: "Asistencia",
              absenceReviews: "Ausencias revisadas",
              logs: "Bitácoras y temperaturas",
              maintenance: "Mantenimiento",
              audit: "Historial de acciones",
            }).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Campo>
          <Campo
            label="Empresa del reporte"
            as="select"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="">Todas</option>
            <OpcionesEmpresa />
          </Campo>
          <Campo
            label="Desde"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Campo
            label="Hasta"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button onClick={() => exportCSV(type, rows)}>
          Exportar reporte filtrado CSV
        </button>
        <p>{rows.length} registros</p>
        <Tabla
          headings={[
            "Fecha",
            "Empleado / responsable",
            "Movimiento / resultado",
            "Observaciones",
          ]}
          count={rows.length}
        >
          {rows.slice(0, 100).map((r, i) => (
            <tr key={r.id || r.id_registro || i}>
              <td>{r.fecha_hora || r.when || r.date}</td>
              <td>{r.nombre_completo || r.name || r.responsible || r.by}</td>
              <td>
                {r.movimiento ||
                  r.result ||
                  r.classification ||
                  r.action ||
                  r.type}
              </td>
              <td>{r.incidencia || r.notes || r.description}</td>
            </tr>
          ))}
        </Tabla>
      </div>
      <div className="panel">
        <h2>Exportar y respaldar</h2>
        <div className="actions">
          <button className="primary" onClick={() => exportCSV("employees")}>
            Exportar personal CSV
          </button>
          <button onClick={() => exportCSV("attendance")}>
            Exportar asistencia CSV
          </button>
          <button onClick={backup}>Descargar respaldo JSON</button>
          <label className="btn file-label">
            Restaurar respaldo JSON
            <input
              aria-label="Restaurar respaldo JSON"
              type="file"
              accept=".json,application/json"
              onChange={restoreFile}
            />
          </label>
        </div>
        <p className="small">
          El respaldo incluye personal, horarios, permisos, contraseñas
          derivadas, bitácoras, evidencias y configuración. Consérvalo en un
          lugar privado. Las contraseñas no se incluyen en CSV.
        </p>
        <h3>
          {usaFirebase
            ? "Respaldos automáticos"
            : "Respaldos automáticos locales"}
        </h3>
        <p>
          {usaFirebase
            ? "Se conserva el estado anterior al primer cambio de cada día, hasta siete días, en Cloud Storage. Descarga también un respaldo externo."
            : "Se conserva el estado anterior al primer cambio de cada día, hasta siete días con actividad. Son copias en este navegador; descarga también un respaldo externo."}
        </p>
        {backups.map((b) => (
          <p key={b.date}>
            {b.date}{" "}
            <button
              onClick={async () => {
                try {
                  const state =
                    b.state || (await repository.leerRespaldo?.(b.date));
                  await restore(state);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Restaurar copia del día
            </button>
          </p>
        ))}
      </div>
    </section>
  );
}
