import { useEffect, useState } from "react";
import { ContextoAplicacion } from "./ContextoAplicacion.js";
import { repository, usaFirebase } from "../repositorios/repositorio.js";
import {
  cuentaAsignada,
  makeCredential,
  verifyCredential,
} from "../dominio/seguridad.js";
import { recordAttendance } from "../dominio/operaciones.js";
import { saveLog } from "../dominio/bitacoras.js";
import {
  adoptarTerminal,
  iniciarSesion,
  verificarTrabajador,
} from "../firebase/sesion.js";
export default function ProveedorAplicacion({ children }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [session, setSession] = useState(null),
    [clock, setClock] = useState(() => new Date());
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
      throw Error(`No se guardó el cambio: ${err.message}`, { cause: err });
    } finally {
      setPending(false);
    }
  }
  async function commit(update) {
    if (session?.role !== "admin") throw Error("Se requiere acceso de María.");
    return mutate(update);
  }
  async function login(id, password) {
    const key = id.trim().toUpperCase();
    if (usaFirebase) {
      await iniciarSesion(key, password);
      const state = await repository.load();
      setData(state);
      if (key === "MARIA") {
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
      setSession({ id: key, name: employee.nombre_completo, role: "worker" });
      return;
    }
    if (key === "MARIA") {
      if (!(await verifyCredential(data.access.admin, password)))
        throw Error("ID o contraseña incorrectos.");
      setSession({ id: "MARIA", name: "María", role: "admin" });
      return;
    }
    const employee = data.employees.find(
      (e) => e.id_empleado === key && e.estatus !== "Baja",
    );
    if (
      !employee ||
      !(await verifyCredential(data.access.workers[key], password))
    )
      throw Error("ID o contraseña incorrectos.");
    setSession({ id: key, name: employee.nombre_completo, role: "worker" });
  }
  async function setup(password) {
    if (usaFirebase) {
      if (data.access.admin)
        throw Error("La administración ya está configurada.");
      setData(await repository.crearAdministracion(password));
      setSession({ id: "MARIA", name: "María", role: "admin" });
      return;
    }
    const credential = await makeCredential(password);
    await mutate((state) => {
      if (state.access.admin)
        throw Error("La administración ya está configurada.");
      return { ...state, access: { ...state.access, admin: credential } };
    });
    setSession({ id: "MARIA", name: "María", role: "admin" });
  }
  async function register(id, password) {
    const key = id.trim().toUpperCase();
    if (usaFirebase) {
      if (data.access?.admin && !cuentaAsignada(data.access.workers[key]))
        throw Error(
          "Solicita a María que asigne tu contraseña antes de registrar.",
        );
      await verificarTrabajador(key, password);
      let result;
      await mutate((state) => {
        result = recordAttendance(state, id, password, new Date(), true);
        return result.state;
      });
      return result;
    }
    const credential = data.access.workers[key];
    const authenticated = credential?.hash
      ? await verifyCredential(credential, password)
      : false;
    if (credential?.hash && !authenticated)
      throw Error("ID o contraseña incorrectos.");
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
        pending,
        session,
        clock,
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
      {children}
    </ContextoAplicacion.Provider>
  );
}
