import { useEffect, useRef, useState } from "react";
import { usaFirebase } from "../repositorios/repositorio.js";
import { usoServidor } from "../firebase/sesion.js";
import { crearContadorUso } from "./contadorUso.js";
export function useRegistroUso(cuenta, modulo) {
  const moduloRef = useRef(modulo),
    terminar = useRef(async () => {});
  const [estado, setEstado] = useState("");
  useEffect(() => {
    moduloRef.current = modulo;
  }, [modulo]);
  useEffect(() => {
    if (!cuenta || !usaFirebase) return;
    let listo = false,
      ocupado = false,
      cerrado = false,
      secuencia = 0,
      finalizar = false;
    const sesion = crypto.randomUUID();
    const alFrente = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const contador = crearContadorUso(performance.now(), alFrente());
    let envioActual;
    async function enviar(cierre = false) {
      finalizar ||= cierre;
      if (ocupado) {
        await envioActual.catch(() => {});
        if (finalizar && !cerrado) return enviar(true);
        return;
      }
      if (cerrado) return;
      ocupado = true;
      const tiempos = contador.actualizar(performance.now(), alFrente());
      const datos = {
        sesion,
        secuencia: listo ? ++secuencia : 0,
        ...(listo
          ? tiempos
          : {
              visibleMs: 0,
              activoMs: 0,
              visible: tiempos.visible,
              activo: tiempos.activo,
            }),
        modulo: moduloRef.current,
        cierre: finalizar,
      };
      envioActual = usoServidor("registrarUso", datos);
      try {
        await envioActual;
        listo = true;
        cerrado = datos.cierre;
        setEstado(
          "Tiempo de uso registrado. Visible y actividad reciente; no se registra lo que escribes.",
        );
      } catch {
        setEstado(
          "El registro de uso está sin conexión. Puedes seguir trabajando.",
        );
      } finally {
        ocupado = false;
      }
    }
    terminar.current = () => enviar(true);
    const cambio = () => {
      contador.actualizar(performance.now(), alFrente());
      void enviar();
    };
    const actividad = () =>
      contador.actualizar(performance.now(), alFrente(), true);
    const salida = () => {
      void enviar();
    };
    const eventos = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "reypez:actividad",
    ];
    eventos.forEach((e) =>
      window.addEventListener(e, actividad, { passive: true }),
    );
    document.addEventListener("visibilitychange", cambio);
    window.addEventListener("focus", cambio);
    window.addEventListener("blur", cambio);
    window.addEventListener("pagehide", salida);
    const tick = setInterval(
      () => contador.actualizar(performance.now(), alFrente()),
      15000,
    );
    const pulso = setInterval(() => {
      void enviar();
    }, 60000);
    void enviar();
    return () => {
      void enviar(true);
      clearInterval(tick);
      clearInterval(pulso);
      eventos.forEach((e) => window.removeEventListener(e, actividad));
      document.removeEventListener("visibilitychange", cambio);
      window.removeEventListener("focus", cambio);
      window.removeEventListener("blur", cambio);
      window.removeEventListener("pagehide", salida);
      terminar.current = async () => {};
    };
  }, [cuenta]);
  return {
    estado: cuenta && usaFirebase ? estado : "",
    terminar: () => terminar.current(),
  };
}
