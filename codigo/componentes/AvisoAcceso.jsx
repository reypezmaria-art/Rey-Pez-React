import { useEffect, useRef, useState } from "react";
import { fondoAcceso, personajesAcceso } from "../datos/escenaAcceso.js";
import { crearEscenaAcceso } from "../utilidades/animarAcceso.js";

export default function AvisoAcceso({ tipo = "denegado", onInicio, detalle }) {
  const canvas = useRef(null);
  const volver = useRef(onInicio);
  const [segundos, setSegundos] = useState(10);
  useEffect(() => {
    volver.current = onInicio;
  }, [onInicio]);
  useEffect(() => {
    const inicio = performance.now();
    const reloj = setInterval(() => {
      const resto = Math.max(
        0,
        10 - Math.floor((performance.now() - inicio) / 1000),
      );
      setSegundos(resto);
      if (resto === 0) volver.current();
    }, 200);
    return () => clearInterval(reloj);
  }, []);
  useEffect(() => {
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return undefined;
    let cuadro = 0,
      activo = true,
      cargadas = 0;
    const fondo = new Image(),
      personajes = new Image();
    function listo() {
      if (++cargadas !== 2 || !activo) return;
      const dibujar = crearEscenaAcceso(ctx, fondo, personajes, tipo);
      function animar(ahora) {
        if (!activo) return;
        dibujar(ahora / 1000);
        cuadro = requestAnimationFrame(animar);
      }
      animar(performance.now());
    }
    fondo.onload = personajes.onload = listo;
    fondo.src = fondoAcceso;
    personajes.src = personajesAcceso;
    return () => {
      activo = false;
      cancelAnimationFrame(cuadro);
    };
  }, [tipo]);
  return (
    <section
      className="access-notice"
      role="alert"
      aria-labelledby="access-notice-title"
    >
      <div className="access-notice-scene">
        <canvas ref={canvas} width="1408" height="820" aria-hidden="true" />
        <div className="access-notice-message">
          <h1 id="access-notice-title">
            {tipo === "bloqueado"
              ? "¡DEMASIADOS INTENTOS!"
              : "¡ACCESO DENEGADO!"}
          </h1>
          <p>
            {tipo === "bloqueado"
              ? "Comunícate con el personal autorizado"
              : "No tienes acceso a este módulo"}
          </p>
        </div>
      </div>
      <div className="access-notice-bar">
        <span>Volverás al inicio en {segundos} s</span>
        <button type="button" onClick={onInicio}>
          Volver al inicio
        </button>
      </div>
      {detalle && <p className="access-notice-detail">{detalle}</p>}
    </section>
  );
}
