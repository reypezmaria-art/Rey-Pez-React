import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  OpcionesEmpleado,
  Campo,
  Mensaje,
  EncabezadoPagina,
} from "../componentes/ElementosInterfaz.jsx";
import { securityActions, companyNames } from "../datos/constantes.js";
import { logTypes } from "../datos/operacionInicial.js";
import { makeCredential } from "../dominio/seguridad.js";
import { repository, usandoFirebase } from "../repositorios/repositorio.js";
export default function Seguridad() {
  const { data, commit, pending } = useAplicacion();
  const [employeeId, setEmployeeId] = useState(""),
    [action, setAction] = useState("set"),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [company, setCompany] = useState("ESTUARDO"),
    [allowed, setAllowed] = useState([]);
  const [adminNew, setAdminNew] = useState(""),
    [adminConfirm, setAdminConfirm] = useState("");
  const needsPassword = ["set", "reset", "change"].includes(action);
  function select(id) {
    setEmployeeId(id);
    const p = data.access.permissions[id];
    const e = data.employees.find((e) => e.id_empleado === id);
    setCompany(p?.company || e?.empresa_codigo || "ESTUARDO");
    setAllowed(p?.logs || []);
    setMessage("");
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!employeeId) throw Error("Selecciona un empleado.");
      if (needsPassword && password !== confirmation)
        throw Error("Las contraseñas no coinciden.");
      if (usandoFirebase) {
        if (needsPassword)
          await repository.asignarContrasena(
            employeeId,
            password,
            securityActions[action],
          );
        else
          await repository.cambiarEstadoTrabajador(
            employeeId,
            action === "enable",
          );
      } else {
        const credential = needsPassword
          ? await makeCredential(password)
          : null;
        await commit((state) => ({
          ...state,
          access: {
            ...state.access,
            workers: {
              ...state.access.workers,
              [employeeId]: credential || {
                ...state.access.workers[employeeId],
                active: action === "enable",
              },
            },
          },
          audit: [
            {
              id: crypto.randomUUID(),
              action: securityActions[action],
              employeeId,
              by: "MARIA",
              when: new Date().toISOString(),
            },
            ...state.audit,
          ],
        }));
      }
      setPassword("");
      setConfirmation("");
      setMessage(
        "Acceso actualizado. La contraseña se guarda como una derivación con sal; no se muestra ni se exporta en CSV.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  async function permissions(e) {
    e.preventDefault();
    try {
      if (!employeeId) throw Error("Selecciona un empleado.");
      const employee = data.employees.find((e) => e.id_empleado === employeeId);
      if (company !== employee.empresa_codigo)
        throw Error("Autoriza únicamente la empresa del empleado.");
      await commit((state) => ({
        ...state,
        access: {
          ...state.access,
          permissions: {
            ...state.access.permissions,
            [employeeId]: { company, logs: allowed },
          },
        },
      }));
      setMessage(
        "Permisos guardados. Solo verá las bitácoras seleccionadas de su empresa.",
      );
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  async function adminPassword(e) {
    e.preventDefault();
    try {
      if (adminNew !== adminConfirm)
        throw Error("Las contraseñas no coinciden.");
      if (usandoFirebase) {
        await repository.cambiarContrasenaAdministrador(adminNew);
        setAdminNew("");
        setAdminConfirm("");
        setMessage("Contraseña de María actualizada.");
        setError("");
        return;
      }
      const credential = await makeCredential(adminNew);
      await commit((state) => ({
        ...state,
        access: { ...state.access, admin: credential },
      }));
      setAdminNew("");
      setAdminConfirm("");
      setMessage("Contraseña de María actualizada.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <EncabezadoPagina
        title="Seguridad y permisos"
        subtitle="María administra contraseñas y autoriza la captura por empresa y bitácora."
      />
      <div className="note">
        {usandoFirebase
          ? "María entra con Firebase Authentication. Los permisos de empresa y bitácora se aplican en las reglas de Firestore. La primera contraseña de un trabajador se crea aquí; cambiar una ya registrada requiere la función descrita en documentacion/firebase.md."
          : "Control local para revisión. La sincronización y los permisos de servidor deben configurarse antes de operar entre equipos."}
      </div>
      <Mensaje>{message}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      <div className="columns">
        <form className="panel" onSubmit={submit}>
          <h2>Acceso del trabajador</h2>
          <Campo
            label="Empleado"
            as="select"
            value={employeeId}
            onChange={(e) => select(e.target.value)}
          >
            <OpcionesEmpleado employees={data.employees} />
          </Campo>
          <Campo
            label="Acción"
            as="select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
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
                label="Nueva contraseña"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <Campo
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </>
          )}
          <button className="primary" disabled={pending}>
            Guardar acceso
          </button>
          <p className="small">
            Estado:{" "}
            {data.access.workers[employeeId]?.hash
              ? data.access.workers[employeeId].active
                ? "Habilitado"
                : "Bloqueado"
              : "Contraseña pendiente de asignación"}
          </p>
        </form>
        <form className="panel" onSubmit={permissions}>
          <h2>Bitácoras autorizadas</h2>
          <p>
            Selecciona al empleado en el formulario de acceso. Brenda solo debe
            tener Estuardo y las bitácoras que tú autorices.
          </p>
          <Campo
            label="Empresa autorizada"
            as="select"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            {Object.entries(companyNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Campo>
          <div className="permission-list">
            {Object.entries(logTypes).map(([key, name]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={allowed.includes(key)}
                  onChange={(e) =>
                    setAllowed(
                      e.target.checked
                        ? [...allowed, key]
                        : allowed.filter((t) => t !== key),
                    )
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <button className="primary" disabled={pending || !employeeId}>
            Guardar permisos
          </button>
        </form>
      </div>
      <form className="panel" onSubmit={adminPassword}>
        <h2>Cambiar contraseña de María</h2>
        <p>ID: MARIA</p>
        <Campo
          label="Nueva contraseña de María"
          type="password"
          autoComplete="new-password"
          value={adminNew}
          onChange={(e) => setAdminNew(e.target.value)}
          required
          minLength={6}
        />
        <Campo
          label="Confirmar contraseña de María"
          type="password"
          autoComplete="new-password"
          value={adminConfirm}
          onChange={(e) => setAdminConfirm(e.target.value)}
          required
        />
        <button disabled={pending}>
          Actualizar contraseña de administración
        </button>
      </form>
    </section>
  );
}
