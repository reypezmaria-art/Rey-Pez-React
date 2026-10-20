import { useId } from "react";
import { nombresEmpresas } from "../dominio/empresas.js";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
export function EncabezadoPagina({ title, subtitle, children }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        <div className="sub">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
export function Campo({
  label,
  as: Control = "input",
  children,
  className = "",
  ...props
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <Control id={id} className="biginput" {...props}>
        {children}
      </Control>
    </div>
  );
}
export function OpcionesEmpresa() {
  const { data } = useAplicacion();
  const companyNames = nombresEmpresas(data);
  return Object.entries(companyNames).map(([code, name]) => (
    <option key={code} value={code}>
      {name}
    </option>
  ));
}
export function OpcionesEmpleado({ employees }) {
  return (
    <>
      <option value="">Selecciona un empleado…</option>
      {employees
        .filter((e) => e.id_empleado)
        .map((e) => (
          <option key={e.id_empleado} value={e.id_empleado}>
            {e.id_empleado} — {e.nombre_completo}
          </option>
        ))}
    </>
  );
}
export function Mensaje({ children, error = false }) {
  return children ? (
    <div className={error ? "note" : "toast"} role={error ? "alert" : "status"}>
      {children}
    </div>
  ) : null;
}
export function Tabla({ headings, children, empty, count }) {
  return (
    <div
      className="tablewrap"
      tabIndex={0}
      role="region"
      aria-label={headings.join(", ")}
    >
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {count === 0 ? (
            <tr>
              <td colSpan={headings.length}>{empty || "Sin resultados"}</td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
