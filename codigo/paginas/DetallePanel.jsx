import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { EncabezadoPagina, Tabla } from "../componentes/ElementosInterfaz.jsx";
import {
  personalDeHoy,
  pendientesPanel,
  filtrarIncidencias,
} from "../dominio/panel.js";
import { nombresEmpresas, fichaEmpresa } from "../dominio/empresas.js";
import { formatDateTime, isSameDay } from "../utilidades/fechas.js";
const titulos = {
  empresas: "Empresas",
  pendientes: "Alertas por revisar",
  registros: "Registros de hoy",
  entrada: "Personal con entrada",
  comida: "Personal en comida",
  salida: "Jornada finalizada",
  ausencias: "Ausencias por revisar",
  incidencias: "Detalle de incidencias",
};
export default function DetallePanel({ navigate, detalleInicial = {} }) {
  const { data, clock } = useAplicacion();
  const { tipo = "pendientes", company, rango } = detalleInicial;
  const nombres = nombresEmpresas(data);
  const pendientes = pendientesPanel(data, clock);
  const registros = data.attendance.filter((r) =>
    isSameDay(r.fecha_hora, clock),
  );
  const movimientos = {
    entrada: ["ENTRADA", "REGRESO_DE_COMER"],
    comida: ["SALIDA_A_COMER"],
    salida: ["SALIDA_FINAL"],
  };
  const personal = personalDeHoy(data, clock).filter((e) =>
    movimientos[tipo]?.includes(e.movimientoHoy),
  );
  const incidencias = filtrarIncidencias(data, rango, company);
  return (
    <section>
      <EncabezadoPagina title={titulos[tipo] || "Detalle del panel"}>
        <button onClick={() => navigate("dashboard")}>Volver al panel</button>
      </EncabezadoPagina>
      {tipo === "empresas" ? (
        <>
          <div className="cards company-summary">
            {Object.entries(nombres).map(([id, nombre]) => (
              <article className="panel" key={id}>
                <h2>{id}</h2>
                <p>{nombre}</p>
                <p>Estado: {fichaEmpresa(data, id).estatus}</p>
                <p>
                  {data.employees.filter((e) => e.empresa_codigo === id).length}{" "}
                  empleados registrados
                </p>
                <button onClick={() => navigate("employees", { company: id })}>
                  Ver empleados de {id}
                </button>
              </article>
            ))}
          </div>
          <button onClick={() => navigate("security", { empresas: true })}>
            Editar datos de empresas
          </button>
        </>
      ) : tipo === "pendientes" || tipo === "ausencias" ? (
        <>
          <p>
            {
              (tipo === "ausencias"
                ? pendientes.filter((r) => r.id.startsWith("ausencia-"))
                : pendientes
              ).length
            }{" "}
            pendientes de revisión.
          </p>
          {(tipo === "ausencias"
            ? pendientes.filter((r) => r.id.startsWith("ausencia-"))
            : pendientes
          ).map((a) => (
            <article className="panel pending-card" key={a.id}>
              <h2>{a.tipo}</h2>
              <p>
                {a.nombre} · {a.company || "Sin empresa registrada"}
              </p>
              <p>{a.detalle}</p>
              <button onClick={() => navigate(a.destino)}>
                Revisar {a.tipo.toLowerCase()}
              </button>
            </article>
          ))}
        </>
      ) : tipo === "registros" ? (
        <Tabla
          headings={[
            "Fecha y hora",
            "Empleado",
            "Empresa",
            "Movimiento",
            "Incidencia",
          ]}
          count={registros.length}
        >
          {registros.map((r) => (
            <tr key={r.id_registro}>
              <td>{formatDateTime(r.fecha_hora)}</td>
              <td>{r.nombre_completo || r.id_empleado}</td>
              <td>{r.empresa_codigo}</td>
              <td>{r.movimiento?.replaceAll("_", " ")}</td>
              <td>{r.incidencia || "—"}</td>
            </tr>
          ))}
        </Tabla>
      ) : tipo === "incidencias" ? (
        <>
          <p>
            {rango?.desde} al {rango?.hasta} ·{" "}
            {company === undefined
              ? "Todas las empresas"
              : company || "Sin empresa registrada"}
          </p>
          <Tabla
            headings={[
              "Fecha",
              "Empresa",
              "Cuenta",
              "Incidencia",
              "Detalle",
              "Estado",
            ]}
            count={incidencias.length}
          >
            {incidencias.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.fecha.includes("T") ? formatDateTime(r.fecha) : r.fecha}
                </td>
                <td>{r.company || "Sin empresa registrada"}</td>
                <td>{r.nombre}</td>
                <td>{r.tipo}</td>
                <td>{r.detalle}</td>
                <td>{r.estado}</td>
              </tr>
            ))}
          </Tabla>
        </>
      ) : (
        <Tabla
          headings={["ID", "Empleado", "Empresa", "Último movimiento de hoy"]}
          count={personal.length}
        >
          {personal.map((e) => (
            <tr key={e.id_empleado}>
              <td>{e.id_empleado}</td>
              <td>{e.nombre_completo}</td>
              <td>{e.empresa_codigo}</td>
              <td>{e.movimientoHoy.replaceAll("_", " ")}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </section>
  );
}
