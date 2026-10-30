import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  OpcionesEmpleado,
  Campo,
  Mensaje,
  EncabezadoPagina,
} from "../componentes/ElementosInterfaz.jsx";
import { securityActions } from "../datos/constantes.js";
import { logTypes } from "../datos/operacionInicial.js";
import {
  cuentaAsignada,
  makeCredential,
  permisoGuardado,
  verifyCredential,
} from "../dominio/seguridad.js";
import { usaFirebase } from "../repositorios/repositorio.js";
import { gestionarPanelAdmin, gestionarAcceso } from "../firebase/sesion.js";
import { formatDateTime } from "../utilidades/fechas.js";
import EmpresasSeguridad from "../componentes/EmpresasSeguridad.jsx";
import { nombresEmpresas } from "../dominio/empresas.js";
export default function Seguridad({ detalleInicial }) {
  const { data, commit, pending } = useAplicacion();
  const companyNames = nombresEmpresas(data);
  const [accessCompany, setAccessCompany] = useState("");
  const companyEmployees = data.employees.filter(
    (e) => e.empresa_codigo === accessCompany,
  );
  const pendingAlerts = (data.securityAlerts || []).filter(
    (a) => a.estado !== "Revisada",
  );
  const reviewedAlerts = (data.securityAlerts || []).filter(
    (a) => a.estado === "Revisada",
  );
  const [employeeId, setEmployeeId] = useState(""),
    [action, setAction] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [company, setCompany] = useState("ESTUARDO"),
    [allowed, setAllowed] = useState([]),
    [nomina, setNomina] = useState(false);
  const [permissionId, setPermissionId] = useState("");
  const [consultaNomina, setConsultaNomina] = useState(false);
  const [secciones, setSecciones] = useState([]);
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
    setSecciones(data.access.permissions[id]?.secciones || []);
    const p = data.access.permissions[id];
    setConsultaNomina(p?.consultaNominaTodas === true);
    setAllowed(p?.company === company ? p.logs || [] : []);
    setNomina(Boolean(p?.company === company && p?.nomina));
    setMessage("");
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!companyEmployees.some((e) => e.id_empleado === employeeId))
        throw Error("Selecciona la empresa y uno de sus empleados.");
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
                  locked: action !== "enable",
                  failedAttempts:
                    action === "enable"
                      ? 0
                      : state.access.workers[employeeId]?.failedAttempts || 0,
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
      setMessage("");
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
      if (
        secciones.includes("maintenance") &&
        data.rooms.filter((r) => r.company === company).length > 10
      )
        throw Error(
          "Hay más de diez cuartos en esta empresa. Revisa el alcance de consulta antes de guardar.",
        );
      await commit((state) => ({
        ...state,
        access: {
          ...state.access,
          permissions: {
            ...state.access.permissions,
            [permissionId]: {
              ...state.access.permissions[permissionId],
              ...permisoGuardado(company, allowed, nomina),
              nomina,
              consultaNominaTodas: consultaNomina,
              secciones,
              cuartosConsulta: state.rooms
                .filter((r) => r.company === company)
                .map((r) => r.id),
            },
          },
        },
      }));
      setMessage(
        nomina
          ? "Permisos guardados. Verá las bitácoras seleccionadas de su empresa y podrá ver, cargar y corregir la nómina de Allan, Edgar y Estuardo."
          : "Permisos guardados. Solo verá las bitácoras seleccionadas de su empresa.",
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
  async function revisarAlerta(id) {
    setError("");
    try {
      await commit((state) => ({
        ...state,
        securityAlerts: (state.securityAlerts || []).map((item) =>
          item.id_alerta === id && item.estado !== "Revisada"
            ? {
                ...item,
                estado: "Revisada",
                revisadaPor: "MARIA",
                revisadaEn: new Date().toISOString(),
              }
            : item,
        ),
      }));
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section>
      <EncabezadoPagina title="Seguridad y permisos" />
      <Mensaje>{message}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      <section className="panel" aria-label="Alertas de seguridad">
        <h2>Alertas de seguridad</h2>
        <TablaIncidencias
          alertas={pendingAlerts}
          empleados={data.employees}
          pending={pending}
          revisar={revisarAlerta}
          vacio="Sin alertas pendientes."
        />
      </section>
      <div className="columns security-columns">
        <form className="panel" onSubmit={submit}>
          <h2>Acceso del trabajador</h2>
          <Campo
            label="Empresa del trabajador"
            as="select"
            value={accessCompany}
            onChange={(e) => {
              setAccessCompany(e.target.value);
              select("");
            }}
            required
          >
            <option value="">Selecciona una empresa…</option>
            {Object.entries(companyNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Campo>
          <Campo
            label="Empleado"
            as="select"
            value={employeeId}
            onChange={(e) => select(e.target.value)}
            disabled={!accessCompany}
          >
            <OpcionesEmpleado employees={companyEmployees} />
          </Campo>
          <Campo
            label="Acción"
            as="select"
            value={action}
            disabled={!employeeId}
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
              setNomina(false);
              setConsultaNomina(false);
              setSecciones([]);
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
          <details className="authorization-picker">
            <summary>
              Secciones ·{" "}
              {secciones.length + (nomina || consultaNomina ? 1 : 0)}{" "}
              seleccionadas
            </summary>
            <fieldset
              disabled={!permissionId}
              aria-label="Secciones autorizadas"
            >
              <label>
                <input
                  type="checkbox"
                  checked={secciones.includes("employees")}
                  onChange={(e) =>
                    setSecciones(
                      e.target.checked
                        ? [...secciones, "employees"]
                        : secciones.filter((v) => v !== "employees"),
                    )
                  }
                />
                Personal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={nomina || consultaNomina}
                  onChange={(e) => {
                    setNomina(e.target.checked);
                    setConsultaNomina(e.target.checked);
                  }}
                />
                Nómina de las tres empresas
              </label>
              {(nomina || consultaNomina) && (
                <Campo
                  label="Acceso a Nómina"
                  as="select"
                  value={nomina ? "edicion" : "consulta"}
                  onChange={(e) => {
                    setConsultaNomina(true);
                    setNomina(e.target.value === "edicion");
                  }}
                >
                  <option value="consulta">Consulta y exportación</option>
                  <option value="edicion">Captura y edición</option>
                </Campo>
              )}
              {[
                ["maintenance", "Mantenimiento y compras"],
                ["reports", "Reportes y CSV"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={secciones.includes(key)}
                    onChange={(e) =>
                      setSecciones(
                        e.target.checked
                          ? [...secciones, key]
                          : secciones.filter((v) => v !== key),
                      )
                    }
                  />
                  {label}
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
      <EmpresasSeguridad abierta={detalleInicial?.empresas} />
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
      <details
        className="panel security-history"
        aria-label="Registro de incidencias"
      >
        <summary>Registro de incidencias</summary>
        <TablaIncidencias
          alertas={reviewedAlerts}
          empleados={data.employees}
          vacio="Sin incidencias revisadas."
        />
      </details>
    </section>
  );
}

function TablaIncidencias({ alertas, empleados, pending, revisar, vacio }) {
  if (!alertas.length) return <p>{vacio}</p>;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Cuenta</th>
            <th>Aviso</th>
            <th>Sección</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((a) => (
            <tr key={a.id_alerta}>
              <td>{formatDateTime(a.fecha_hora)}</td>
              <td>
                {empleados.find((e) => e.id_empleado === a.id_empleado)
                  ?.nombre_completo || a.id_empleado}
              </td>
              <td>
                {a.tipo}
                <br />
                {a.detalle}
              </td>
              <td>{a.modulo}</td>
              <td>
                {revisar ? (
                  <button
                    disabled={pending}
                    onClick={() => revisar(a.id_alerta)}
                  >
                    Marcar revisada
                  </button>
                ) : (
                  <>
                    Revisada
                    {a.revisadaPor && <div>Por {a.revisadaPor}</div>}
                    {a.revisadaEn && <div>{formatDateTime(a.revisadaEn)}</div>}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
