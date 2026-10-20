import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  EncabezadoPagina,
  Tabla,
  Mensaje,
} from "../componentes/ElementosInterfaz.jsx";
import FormularioEmpleado from "../componentes/FormularioEmpleado.jsx";
import { assignMissingIds, terminateEmployee } from "../dominio/operaciones.js";
import { nombresEmpresas } from "../dominio/empresas.js";
import { mergeEmployees, parseCSV } from "../utilidades/archivosCsv.js";
import { concordar } from "../utilidades/textos.js";
export default function Personal({ detalleInicial, navigate }) {
  const { data, commit, pending } = useAplicacion();
  const companyNames = nombresEmpresas(data);
  const [query, setQuery] = useState(""),
    [company, setCompany] = useState(detalleInicial?.company || "");
  const [editor, setEditor] = useState(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const filtered = data.employees.filter(
    (e) =>
      (!company || e.empresa_codigo === company) &&
      `${e.nombre_completo} ${e.id_empleado} ${e.curp || ""} ${e.nss || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function run(action, success) {
    setError("");
    setMessage("");
    try {
      await commit(action);
      setMessage(success);
    } catch (err) {
      setError(err.message);
    }
  }
  async function importFile(event) {
    const input = event.target,
      file = input.files[0];
    if (!file) return;
    try {
      const rows = parseCSV(await file.text());
      await run(
        (state) => mergeEmployees(state, rows),
        `Importación terminada: ${concordar(rows.length, "fila procesada", "filas procesadas")}. Revisa el catálogo y exporta un respaldo.`,
      );
    } catch (err) {
      setError(err.message);
    }
    input.value = "";
  }
  return (
    <section>
      <EncabezadoPagina
        title={detalleInicial?.resumen ? "Total de empleados" : "Personal"}
        subtitle="Agrega y administra empleados desde la web. El CSV es opcional para importación masiva o respaldo."
      >
        <button
          className="primary"
          onClick={() => setEditor({ employee: undefined })}
        >
          + Agregar empleado
        </button>
      </EncabezadoPagina>
      <section aria-label="Personal por empresa">
        <h2>Personal por empresa</h2>
        <p>
          Total de empleados: <strong>{data.employees.length}</strong>
        </p>
        <div className="cards company-summary">
          {Object.entries(companyNames).map(([id, nombre]) => {
            const lista = data.employees.filter((e) => e.empresa_codigo === id);
            return (
              <button
                className="card metric-card"
                key={id}
                aria-pressed={company === id}
                onClick={() => setCompany(id)}
              >
                <span className="klabel">{id}</span>
                <span className="kvalue">{lista.length}</span>
                <span>{nombre}</span>
                <span className="kfoot">
                  {lista.filter((e) => e.estatus !== "Baja").length} activos ·{" "}
                  {lista.filter((e) => e.estatus === "Baja").length} bajas
                </span>
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button onClick={() => setCompany("")}>Ver todas las empresas</button>
          {navigate && (
            <button onClick={() => navigate("dashboard")}>
              Volver al panel
            </button>
          )}
        </div>
      </section>
      <div className="toolbar">
        <input
          aria-label="Buscar personal"
          placeholder="Buscar nombre, ID o CURP..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filtrar empresa"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">Todas las empresas</option>
          <option value="ALLAN">Allan</option>
          <option value="EDGAR">Edgar</option>
          <option value="ESTUARDO">Estuardo</option>
        </select>
        <button
          disabled={pending}
          onClick={() =>
            run(
              assignMissingIds,
              "ID faltantes asignados. Exporta el CSV para conservar una copia.",
            )
          }
        >
          Asignar ID faltantes
        </button>
        <label className="btn file-label">
          Importar CSV (opcional)
          <input
            aria-label="Importar CSV"
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={importFile}
          />
        </label>
      </div>
      <Mensaje>{message}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      {editor && (
        <FormularioEmpleado
          key={editor.employee?.id_empleado || "new"}
          employee={editor.employee}
          onClose={() => setEditor(null)}
          onSaved={(text) => {
            setEditor(null);
            setMessage(text);
          }}
        />
      )}
      <Tabla
        headings={[
          "ID",
          "Empleado",
          "Empresa",
          "Puesto / función",
          "Horario",
          "Ingreso",
          "Estado",
          "Acciones",
        ]}
        count={filtered.length}
      >
        {filtered.map((e, i) => (
          <tr key={e.id_empleado || `missing-${i}`}>
            <td>
              <b>{e.id_empleado || "Pendiente"}</b>
            </td>
            <td>{e.nombre_completo}</td>
            <td>{companyNames[e.empresa_codigo] || e.empresa_nombre}</td>
            <td>
              {e.puesto}
              {e.observaciones && (
                <>
                  <br />
                  <span className="small">{e.observaciones}</span>
                </>
              )}
            </td>
            <td>{e.codigo_horario || "Automático"}</td>
            <td>{e.fecha_ingreso}</td>
            <td>
              <span
                className={`status ${e.estatus === "Baja" ? "inactive" : ""}`}
              >
                {e.estatus || "Activo"}
              </span>
            </td>
            <td>
              <div className="table-actions">
                <button
                  disabled={!e.id_empleado}
                  onClick={() => setEditor({ employee: e })}
                >
                  Modificar
                </button>
                <button
                  disabled={pending || !e.id_empleado || e.estatus === "Baja"}
                  className="btn-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Dar de baja a ${e.nombre_completo}? Se conservarán sus registros históricos.`,
                      )
                    )
                      run(
                        (state) => terminateEmployee(state, e.id_empleado),
                        "Empleado dado de baja. Su historial se conserva.",
                      );
                  }}
                >
                  Dar de baja
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Tabla>
    </section>
  );
}
