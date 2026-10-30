import { destinoTrasIngresar } from "../dominio/accesoNomina.js";
import { useEffect, useState } from "react";
import { ContextoAplicacion } from "./ContextoAplicacion.js";
import { repository, usaFirebase } from "../repositorios/repositorio.js";
import { mensajeGuardado } from "../repositorios/repositorioLocal.js";
import {
  cuentaAsignada,
  makeCredential,
  puedeVerNomina,
  verifyCredential,
} from "../dominio/seguridad.js";
import { recordAttendance } from "../dominio/operaciones.js";
import { saveLog } from "../dominio/bitacoras.js";
import {
  alertaSeguridad,
  errorBloqueo,
  registrarIntentoLocal,
} from "../dominio/controlAcceso.js";
import { afirmarSoloNomina } from "../dominio/nomina.js";
import {
  adoptarTerminal,
  iniciarSesion,
  verificarTrabajador,
  registrarDenegacion,
} from "../firebase/sesion.js";
export default function ProveedorAplicacion({ children }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [session, setSession] = useState(null),
    [aviso, setAviso] = useState(""),
    [avisoNube, setAvisoNube] = useState(""),
    [avisoAcceso, setAvisoAcceso] = useState(null),
    [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    if (typeof repository.observarAviso !== "function") return undefined;
    return repository.observarAviso(setAvisoNube);
  }, []);
  useEffect(() => {
    let active = true;
    repository
      .load()
      .then((state) => {
        if (active) setData(state);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    const unsubscribe = repository.subscribe(setData);
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  async function mutate(update) {
    setPending(true);
    try {
      return await repository.transact(update);
    } catch (err) {
      throw Error(`No se guardó el cambio: ${mensajeGuardado(err)}`, {
        cause: err,
      });
    } finally {
      setPending(false);
    }
  }
  async function commit(update) {
    if (session?.role !== "admin") throw Error("Se requiere acceso de María.");
    return mutate(update);
  }
  async function persistirNomina(update) {
    if (session?.role === "admin") return mutate(update);
    if (!puedeVerNomina(data, session))
      throw Error("No tienes permiso para modificar la nómina.");
    return mutate((state) => afirmarSoloNomina(state, update(state)));
  }
  function abrirSesionTrabajador(state, key, employee) {
    const nueva = { id: key, name: employee.nombre_completo, role: "worker" };
    const ruta = destinoTrasIngresar(state, nueva, location.hash);
    if (ruta !== location.hash) {
      window.history.replaceState(null, "", ruta);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    setSession(nueva);
  }
  async function login(id, password) {
    const key = id.trim().toUpperCase();
    if (usaFirebase) {
      await autenticar(() => iniciarSesion(key, password));
      const state = await repository.load();
      setData(state);
      if (key === "MARIA") {
        setAviso("");
        setSession({ id: "MARIA", name: "María", role: "admin" });
        return;
      }
      const employee = state.employees.find(
        (e) => e.id_empleado === key && e.estatus !== "Baja",
      );
      const worker = state.access.workers[key];
      if (!employee || !cuentaAsignada(worker) || worker.active === false) {
        await repository.cerrarSesion?.();
        throw Error("ID o contraseña incorrectos.");
      }
      setAviso("");
      abrirSesionTrabajador(state, key, employee);
      return;
    }
    if (key === "MARIA") {
      await validarLocal(key, password);
      setAviso("");
      setSession({ id: "MARIA", name: "María", role: "admin" });
      return;
    }
    const employee = data.employees.find(
      (e) => e.id_empleado === key && e.estatus !== "Baja",
    );
    await validarLocal(key, password);
    if (!employee) throw Error("ID o contraseña incorrectos.");
    setAviso("");
    abrirSesionTrabajador(data, key, employee);
  }
  async function autenticar(accion) {
    try {
      return await accion();
    } catch (err) {
      if (err.code === "acceso/bloqueado")
        setAvisoAcceso({ tipo: "bloqueado" });
      throw err;
    }
  }
  async function validarLocal(key, password) {
    let valido = false,
      bloqueado = false;
    // La verificación ocurre antes de la transacción; dentro se valida que la cuenta no cambió.
    const actual = await repository.load();
    const cuenta =
      key === "MARIA" ? actual.access.admin : actual.access.workers[key];
    valido = await verifyCredential(cuenta, password);
    await mutate((state) => {
      const vigente =
        key === "MARIA" ? state.access.admin : state.access.workers[key];
      if (vigente?.hash !== cuenta?.hash)
        throw Error("El acceso cambió. Intenta de nuevo.");
      const resultado = registrarIntentoLocal(state, key, valido);
      bloqueado = resultado.bloqueado;
      return resultado.state;
    });
    if (bloqueado) {
      setAvisoAcceso({ tipo: "bloqueado" });
      throw errorBloqueo();
    }
    if (!valido) throw Error("ID o contraseña incorrectos.");
  }
  async function denegarAcceso(modulo) {
    if (!session) return;
    setAvisoAcceso({ tipo: "denegado" });
    try {
      if (usaFirebase) await registrarDenegacion({ modulo });
      else
        await mutate((state) => ({
          ...state,
          securityAlerts: [
            alertaSeguridad(
              state,
              session.id,
              "Acceso denegado",
              "Intento de abrir una sección sin autorización.",
              modulo,
            ),
            ...(state.securityAlerts || []),
          ],
        }));
    } catch {
      setAvisoAcceso(
        (actual) =>
          actual && {
            ...actual,
            detalle:
              "El acceso está bloqueado, pero no se pudo guardar la alerta. Revisa la conexión.",
          },
      );
    }
  }
  function volverInicio() {
    setAvisoAcceso(null);
    if (session?.role === "admin") return;
    setSession(null);
    repository.cerrarSesion?.();
    if (!location.hash.startsWith("#asistencia"))
      location.hash = "#administracion";
  }
  async function setup(password) {
    if (usaFirebase) {
      if (data.access.admin)
        throw Error("La administración ya está configurada.");
      setData(await repository.crearAdministracion(password));
      setAviso("");
      setSession({ id: "MARIA", name: "María", role: "admin" });
      return;
    }
    const credential = await makeCredential(password);
    await mutate((state) => {
      if (state.access.admin)
        throw Error("La administración ya está configurada.");
      return { ...state, access: { ...state.access, admin: credential } };
    });
    setAviso("");
    setSession({ id: "MARIA", name: "María", role: "admin" });
  }
  async function register(id, password) {
    const key = id.trim().toUpperCase();
    if (usaFirebase) {
      if (data.access?.admin && !cuentaAsignada(data.access.workers[key]))
        throw Error(
          "Solicita a María que asigne tu contraseña antes de registrar.",
        );
      await autenticar(() => verificarTrabajador(key, password));
      let result;
      await mutate((state) => {
        result = recordAttendance(state, id, password, new Date(), true);
        return result.state;
      });
      return result;
    }
    const credential = data.access.workers[key];
    if (credential?.hash) await validarLocal(key, password);
    const authenticated = Boolean(credential?.hash);
    let result;
    await mutate((state) => {
      if (state.access.workers[key]?.hash !== credential?.hash)
        throw Error("El acceso cambió. Intenta de nuevo.");
      result = recordAttendance(state, id, password, new Date(), authenticated);
      return result.state;
    });
    return result;
  }
  async function activarTerminal(token) {
    await adoptarTerminal(token);
    setSession(null);
  }
  async function capture(form) {
    return mutate((state) => saveLog(state, form, session));
  }
  if (error)
    return (
      <main>
        <div className="note" role="alert">
          No se pudieron cargar los datos: {error}
        </div>
        <button onClick={() => window.location.reload()}>
          Volver a intentar
        </button>
      </main>
    );
  if (!data) return <main role="status">Cargando Rey Pez…</main>;
  return (
    <ContextoAplicacion.Provider
      value={{
        data,
        commit,
        persistirNomina,
        pending,
        session,
        clock,
        aviso,
        avisoAcceso,
        volverInicio,
        denegarAcceso,
        avisar: setAviso,
        login,
        setup,
        register,
        capture,
        activarTerminal,
        logout: () => {
          setSession(null);
          repository.cerrarSesion?.();
        },
      }}
    >
      {avisoNube ? (
        <div className="note" role="status">
          {avisoNube}
        </div>
      ) : null}
      {children}
    </ContextoAplicacion.Provider>
  );
}
