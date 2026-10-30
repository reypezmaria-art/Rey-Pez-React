import { useEffect, useRef, useState } from "react";
import { repositorioLibrosNomina } from "../repositorios/librosNomina.js";
import {
  empaquetarLibro,
  desempaquetarLibro,
} from "../utilidades/paqueteLibroNomina.js";

export default function EditorNomina({
  ambito,
  inicial,
  soloConsulta,
  onClose,
}) {
  const frame = useRef(null);
  const [canal] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [estado, setEstado] = useState("Cargando editor de nómina…");
  const dirty = useRef(false);
  useEffect(() => {
    const repo = repositorioLibrosNomina(ambito);
    let revision = 0,
      activo = true,
      fuente;
    const responder = (id, resultado, error) =>
      frame.current?.contentWindow?.postMessage(
        { canal, id, resultado, error },
        location.origin,
      );
    async function recibir(event) {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.canal !== canal
      )
        return;
      const { id, accion, datos } = event.data;
      if (accion === "estado") {
        setEstado(String(datos || "").slice(0, 200));
        return;
      }
      if (accion === "fallo") {
        setEstado("");
        setError(String(datos || "No se pudo abrir el editor."));
        return;
      }
      if (accion === "cambios") {
        dirty.current = Boolean(datos);
        return;
      }
      try {
        let resultado;
        if (accion === "abrir") {
          setEstado("Leyendo el libro guardado…");
          const guardado = await repo.abrir(datos?.revision);
          revision = guardado?.actual || 0;
          if (guardado) {
            const libro = await desempaquetarLibro(guardado.carga);
            fuente = libro.fuente;
            resultado = { ...libro, soloConsulta, nube: repo.nube };
          } else if (inicial && !soloConsulta)
            resultado = { ...inicial, soloConsulta, nube: repo.nube };
          else
            throw Error(
              "Todavía no hay un libro guardado para esta empresa y año.",
            );
        } else if (accion === "guardar") {
          if (soloConsulta)
            throw Error("Tu acceso es de consulta y exportación.");
          const carga = await empaquetarLibro({ ...datos, fuente });
          resultado = await repo.guardar(carga, revision);
          revision = resultado.revision;
          dirty.current = false;
        } else if (accion === "versiones")
          resultado = (await repo.listar()).map((v) => ({
            id: v.revision,
            nombre: `Versión ${v.revision} · ${new Date(v.fecha).toLocaleString("es-MX")}`,
          }));
        else throw Error("Acción de libro no válida.");
        if (activo) responder(id, resultado);
      } catch (err) {
        if (activo) {
          setEstado("");
          setError(err.message);
          responder(id, null, err.message);
        }
      }
    }
    const prevenir = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("message", recibir);
    window.addEventListener("beforeunload", prevenir);
    return () => {
      activo = false;
      window.removeEventListener("message", recibir);
      window.removeEventListener("beforeunload", prevenir);
    };
  }, [ambito, inicial, soloConsulta, canal]);
  return (
    <section
      className="nomina-editor-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Editor de nómina"
    >
      <header>
        <strong>
          Nómina · {ambito.empresa} · {ambito.anio} · {ambito.tipo}
        </strong>
        <button
          onClick={() => {
            if (
              !dirty.current ||
              window.confirm("Hay cambios sin guardar. ¿Cerrar el editor?")
            )
              onClose();
          }}
        >
          Cerrar editor
        </button>
      </header>
      {estado && <p role="status">{estado}</p>}
      {error && <p role="alert">{error}</p>}
      <iframe
        ref={frame}
        title="Hoja de cálculo de nómina"
        src={`/editor-nomina/index.html?integrado=1&canal=${canal}`}
        sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
      />
    </section>
  );
}
