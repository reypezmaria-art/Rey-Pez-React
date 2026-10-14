import { useEffect, useState } from "react";
import { ContextoAplicacion } from "./ContextoAplicacion.js";
import { repository } from "../repositorios/repositorio.js";
export default function ProveedorAplicacion({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function commit(update) {
    setPending(true);
    try {
      await repository.transact(update);
    } catch (err) {
      throw Error(`No se guardó el cambio: ${err.message}`, { cause: err });
    } finally {
      setPending(false);
    }
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
    <ContextoAplicacion.Provider value={{ data, commit, pending }}>
      {children}
    </ContextoAplicacion.Provider>
  );
}
