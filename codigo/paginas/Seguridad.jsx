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
import {
  cuentaAsignada,
  makeCredential,
  verifyCredential,
} from "../dominio/seguridad.js";
import { usaFirebase } from "../repositorios/repositorio.js";
import { gestionarPanelAdmin, gestionarAcceso } from "../firebase/sesion.js";
export default function Seguridad() {
  const { data, commit, pending } = useAplicacion();
  const [employeeId, setEmployeeId] = useState(""),
    [action, setAction] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [company, setCompany] = useState("ESTUARDO"),
    [allowed, setAllowed] = useState([]);
  const [permissionId, setPermissionId] = useState("");
  const activeEmployees = data.employees.filter(
    (e) =>
      e.empresa_codigo === company &&
      e.estatus !== "Baja" &&
      data.access.workers[e.id_empleado]?.active !== false,
  );
  const [adminNew, setAdminNew] = useState(""),
    [adminConfirm, setAdminConfirm] = useState("");
  const [adminKey, setAdminKey] = useState(""),
    [adminOpen, setAdminOpen] = useState(false),
    [adminError, setAdminError] = useState(""),
    [adminBusy, setAdminBusy] = useState(false);
  function closeAdmin() {
    setAdminOpen(false);
    setAdminKey("");
    setAdminNew("");
    setAdminConfirm("");
    setAdminError("");
  }
  async function unlockAdmin(e) {
    e.preventDefault();
    setAdminError("");
    setAdminBusy(true);
    try {
      if (usaFirebase) await gestionarPanelAdmin({ clave: adminKey });
      else if (!(await verifyCredential(data.access.admin, adminKey)))
        throw Error("Contraseña incorrecta.");
      setAdminOpen(true);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminBusy(false);
    }
  }
  const needsPassword = ["set", "reset", "change"].includes(action);
  function select(id) {
    setEmployeeId(id);
    setAction("");
    setPassword("");
    setConfirmation("");
    setMessage("");
    setError("");
  }
  function selectPermission(id) {
    setPermissionId(id);
    const p = data.access.permissions[id];
    setAllowed(p?.company === company ? p.logs || [] : []);
    setMessage("");
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!employeeId) throw Error("Selecciona un empleado.");
      if (!Object.hasOwn(securityActions, action))
        throw Error("Selecciona una acción.");
      if (needsPassword && password !== confirmation)
        throw Error("Las contraseñas no coinciden.");
      if (usaFirebase)
        await gestionarAcceso({
          accion: action,
          idEmpleado: employeeId,
          contrasena: needsPassword ? password : "",
        });
      const credential =
        !usaFirebase && needsPassword ? await makeCredential(password) : null;
      await commit((state) => ({
        ...state,
        access: usaFirebase
          ? state.access
          : {
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
      setPassword("");
      setConfirmation("");
      setMessage(
        usaFirebase
          ? "Acceso actualizado en Firebase. La contraseña no se muestra ni se exporta."
          : "Acceso actualizado. La contraseña se guarda como una derivación con sal; no se muestra ni se exporta en CSV.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  async function permissions(e) {
    e.preventDefault();
    try {
      const employee = activeEmployees.find(
        (e) => e.id_empleado === permissionId,
      );
      if (!employee) throw Error("Selecciona un usuario activo.");
      if (company !== employee.empresa_codigo)
        throw Error("Autoriza únicamente la empresa del empleado.");
      await commit((state) => ({
        ...state,
        access: {
          ...state.access,
          permissions: {
            ...state.access.permissions,
            [permissionId]: { company, logs: allowed },
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
    setAdminError("");
    setAdminBusy(true);
    try {
      if (!adminOpen) throw Error("Desbloquea Admin para continuar.");
      if (adminNew !== adminConfirm)
        throw Error("Las contraseñas no coinciden.");
      if (usaFirebase) {
        await gestionarPanelAdmin({
          clave: adminKey,
          nuevaContrasena: adminNew,
        });
        closeAdmin();
        setMessage("Contraseña de Admin actualizada.");
        setError("");
        return;
      }
      const credential = await makeCredential(adminNew);
      await commit((state) => ({
        ...state,
        access: { ...state.access, admin: credential },
      }));
      closeAdmin();
      setMessage("Contraseña de Admin actualizada.");
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminBusy(false);
    }
  }
  return (
    <section>
      <EncabezadoPagina title="Seguridad y permisos" />
      <Mensaje>{message}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      <div className="columns security-columns">
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
            onChange={(e) => {
              setAction(e.target.value);
              setPassword("");
              setConfirmation("");
            }}
          >
            <option value="">Selecciona una acción…</option>
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
          {action && (
            <button className="primary" disabled={pending || !employeeId}>
              Guardar acceso
            </button>
          )}
          {action && employeeId && (
            <p className="small">
              Estado:{" "}
              {cuentaAsignada(data.access.workers[employeeId])
                ? data.access.workers[employeeId].active !== false
                  ? "Habilitado"
                  : "Bloqueado"
                : "Contraseña pendiente de asignación"}
            </p>
          )}
        </form>
        <form className="panel" onSubmit={permissions}>
          <h2>Autorizaciones</h2>
          <Campo
            label="Empresa autorizada"
            as="select"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setPermissionId("");
              setAllowed([]);
              setMessage("");
              setError("");
            }}
          >
            {Object.entries(companyNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Campo>
          <Campo
            label="Usuario activo"
            as="select"
            value={permissionId}
            onChange={(e) => selectPermission(e.target.value)}
          >
            <OpcionesEmpleado employees={activeEmployees} />
          </Campo>
          <details
            className="authorization-picker"
            key={`${company}-${permissionId}`}
          >
            <summary>Bitácoras · {allowed.length} seleccionadas</summary>
            <fieldset
              disabled={!permissionId}
              aria-label="Bitácoras autorizadas"
            >
              {Object.entries(logTypes).map(([key, name]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={allowed.includes(key)}
                    onChange={(e) =>
                      setAllowed(
                        e.target.checked
                          ? [...new Set([...allowed, key])]
                          : allowed.filter((t) => t !== key),
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </fieldset>
          </details>
          <button
            className="primary"
            disabled={
              pending ||
              !activeEmployees.some((e) => e.id_empleado === permissionId)
            }
          >
            Guardar permisos
          </button>
        </form>
      </div>
      <section className="panel" aria-label="Admin">
        <h2>Admin</h2>
        <Mensaje error>{adminError}</Mensaje>
        {!adminOpen ? (
          <form onSubmit={unlockAdmin}>
            <Campo
              label="Contraseña de Admin"
              type="password"
              autoComplete="off"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              required
            />
            <button disabled={adminBusy}>Abrir Admin</button>
          </form>
        ) : (
          <form onSubmit={adminPassword}>
            <Campo
              label="Nueva contraseña de Admin"
              type="password"
              autoComplete="new-password"
              value={adminNew}
              onChange={(e) => setAdminNew(e.target.value)}
              required
              minLength={6}
            />
            <Campo
              label="Confirmar contraseña de Admin"
              type="password"
              autoComplete="new-password"
              value={adminConfirm}
              onChange={(e) => setAdminConfirm(e.target.value)}
              required
            />
            <button disabled={pending || adminBusy}>
              Actualizar contraseña de administración
            </button>
            <button type="button" disabled={adminBusy} onClick={closeAdmin}>
              Cerrar Admin
            </button>
          </form>
        )}
      </section>
    </section>
  );
}
