import { useEffect, useRef, useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import LogoMarca from "./LogoMarca.jsx";
function saludoDeMarcaje(resultado) {
  const nombre = resultado.employee.nombre_completo;
  if (resultado.event.movement === "SALIDA_FINAL")
    return `Hasta pronto, ${nombre}`;
  if (resultado.event.movement === "SALIDA_A_COMER")
    return `Buen provecho, ${nombre}`;
  if (resultado.event.movement === "REGRESO_DE_COMER")
    return `Bienvenido de regreso, ${nombre}`;
  return `¡Bienvenido a Rey Pez, ${nombre}!`;
}
export default function RegistroTrabajador({ onClose, terminal = false }) {
  const { register, pending } = useAplicacion();
  const [id, setId] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(null);
  const dialog = useRef(null),
    input = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess(null);
      setId("");
      setPassword("");
      setError("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [success]);
  useEffect(() => {
    if (!success) input.current?.focus();
  }, [success]);
  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await register(id, password);
      setPassword("");
      setSuccess(result);
    } catch (err) {
      setPassword("");
      setError(err.message);
    }
  }
  return (
    <dialog
      className="worker-kiosk"
      ref={dialog}
      aria-labelledby="kiosk-title"
      aria-modal="true"
      onCancel={(e) => {
        if (terminal) e.preventDefault();
        else onClose();
      }}
    >
      <div className="kiosk-content">
        <LogoMarca variant="kiosk" official />
        <div className="kiosk-brand">REY PEZ</div>
        <div className="kiosk-subtitle">Control de asistencia y acceso</div>
        {success ? (
          <div className="kiosk-success" role="status">
            <div className="kiosk-check">✓</div>
            <h1 id="kiosk-title">{saludoDeMarcaje(success)}</h1>
            <p className="kiosk-movement">
              {success.event.label} ·{" "}
              {success.now.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p>Que tengas un excelente turno.</p>
            <p className="kiosk-hint">
              La pantalla volverá al inicio automáticamente.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 id="kiosk-title">Bienvenido a Rey Pez</h1>
            <p>Identifícate para registrar tu asistencia</p>
            <input
              ref={input}
              className="biginput"
              aria-label="ID de empleado"
              placeholder="ID de empleado · Ej. RP-0001"
              autoComplete="off"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <input
              className="biginput"
              aria-label="Contraseña"
              type="password"
              placeholder="Contraseña"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="attbtn kiosk-submit" disabled={pending}>
              Registrar
            </button>
            <p className="kiosk-hint">
              La huella digital requiere un lector y una integración compatible.
            </p>
            <div className="kiosk-message" role="status">
              {error}
            </div>
          </form>
        )}
        {!terminal && (
          <button className="kiosk-exit" onClick={onClose}>
            Salir de pantalla de trabajador
          </button>
        )}
        <p className="kiosk-footer">
          Prototipo local de pruebas · No usar aún como control laboral oficial
        </p>
      </div>
    </dialog>
  );
}
