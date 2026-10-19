import { useEffect, useState } from "react";
import { ContextoAplicacion } from "./ContextoAplicacion.js";
import { repository, usandoFirebase } from "../repositorios/repositorio.js";
import { makeCredential, verifyCredential } from "../dominio/seguridad.js";
import { recordAttendance } from "../dominio/operaciones.js";
import { saveLog } from "../dominio/bitacoras.js";
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
    if (usandoFirebase) {
      const sesion = await repository.autenticar(id, password);
      setSession(sesion);
      return;
    }
    const key = id.trim().toUpperCase();
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
    if (usandoFirebase) {
      setData(await repository.configurarAdministrador(password));
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
    const credential = data.access.workers[key];
    if (usandoFirebase) {
      if (data.access?.admin && !credential?.hash)
        throw Error(
          "Solicita a María que asigne tu contraseña antes de registrar.",
        );
      if (credential?.active === false)
        throw Error("La cuenta no está activa. Consulta a administración.");
      await repository.verificarTrabajador(key, password);
    }
    const authenticated = usandoFirebase
      ? true
      : credential?.hash
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
        logout: async () => {
          setSession(null);
          if (usandoFirebase) setData(await repository.cerrarSesion());
        },
      }}
    >
      {children}
    </ContextoAplicacion.Provider>
  );
}
