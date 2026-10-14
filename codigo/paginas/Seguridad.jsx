import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  OpcionesEmpleado,
  Campo,
  Mensaje,
  EncabezadoPagina,
} from "../componentes/ElementosInterfaz.jsx";
import { securityActions } from "../datos/constantes.js";
export default function Seguridad() {
  const { data } = useAplicacion();
  const [employeeId, setEmployeeId] = useState(""),
    [action, setAction] = useState("set");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const needsPassword = ["set", "reset", "change"].includes(action);
  function submit(event) {
    event.preventDefault();
    const employee = data.employees.find((e) => e.id_empleado === employeeId);
    if (!employee) return setMessage("Selecciona un empleado.");
    if (needsPassword && password.length < 8)
      return setMessage(
        "Escribe una contraseña de prueba de al menos 8 caracteres. No uses una contraseña real.",
      );
    if (needsPassword && password !== confirmation)
      return setMessage("Las contraseñas no coinciden.");
    setPassword("");
    setConfirmation("");
    setMessage(
      `Formulario revisado para ${employee.nombre_completo}. Acción: ${securityActions[action]}. No se guardó contraseña ni se cambió el acceso, porque esta demo no tiene autenticación real.`,
    );
  }
  return (
    <section>
      <EncabezadoPagina
        title="Seguridad y contraseñas"
        subtitle="Formulario para asignación y restablecimiento de acceso"
      />
      <div className="note">
        <b>Prototipo:</b> este formulario todavía no constituye un control de
        seguridad real. No uses contraseñas reales aquí; los permisos
        administrativos y el almacenamiento seguro se implementarán en la
        versión de producción.
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>Administrar acceso de trabajador</h2>
        <Campo
          label="Empleado"
          as="select"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <OpcionesEmpleado employees={data.employees} />
        </Campo>
        <Campo
          label="Acción solicitada"
          as="select"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPassword("");
            setConfirmation("");
            setMessage("");
          }}
        >
          {Object.entries(securityActions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Campo>
        {needsPassword && (
          <>
            <Campo
              label="Nueva contraseña temporal (solo maqueta)"
              type="password"
              autoComplete="new-password"
              placeholder="No uses una contraseña real"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Campo
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña de prueba"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </>
        )}
        <button className="primary">Guardar solicitud (demostración)</button>
        <Mensaje error>{message}</Mensaje>
        <p className="small">
          En esta versión no se guarda la contraseña ni se habilita el acceso.
          En producción, Firebase Authentication gestionará las credenciales;
          administración podrá solicitar restablecimientos, nunca ver la
          contraseña existente.
        </p>
      </form>
    </section>
  );
}
