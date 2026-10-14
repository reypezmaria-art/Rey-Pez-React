import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { Campo, Mensaje } from "./ElementosInterfaz.jsx";
import LogoMarca from "./LogoMarca.jsx";
export default function Acceso({ operational = false }) {
  const { data, login, setup, pending } = useAplicacion();
  const first = !data.access.admin && !operational;
  const [id, setId] = useState(operational ? "" : "MARIA"),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (first) {
        if (password !== confirmation)
          throw Error("Las contraseñas no coinciden.");
        await setup(password);
      } else await login(id, password);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <main className="access-screen">
      <form className="panel" onSubmit={submit}>
        <LogoMarca variant="kiosk" official />
        <h1>
          {first
            ? "Configurar acceso de María"
            : operational
              ? "Captura operativa"
              : "Acceso de María"}
        </h1>
        <p>
          {first
            ? "Crea tu contraseña para esta copia local. ID de administración: MARIA."
            : "Identifícate para abrir las secciones autorizadas."}
        </p>
        {!first && (
          <Campo
            label="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            autoComplete="username"
          />
        )}
        <Campo
          label={first ? "Crear contraseña" : "Contraseña"}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={first ? "new-password" : "current-password"}
          required
          minLength={first ? 6 : undefined}
        />
        {first && (
          <Campo
            label="Confirmar contraseña"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        )}
        <Mensaje error>{error}</Mensaje>
        <button className="primary" disabled={pending}>
          {first ? "Crear acceso y abrir panel" : "Ingresar"}
        </button>
        <p className="small">
          Copia local de revisión. El acceso y los datos pertenecen a este
          navegador; la protección centralizada entre equipos queda pendiente.
        </p>
      </form>
    </main>
  );
}
