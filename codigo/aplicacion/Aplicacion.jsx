import { useEffect, useState } from "react";
import { useAplicacion } from "./ContextoAplicacion.js";
import PanelPrincipal from "../paginas/PanelPrincipal.jsx";
import Personal from "../paginas/Personal.jsx";
import Asistencia from "../paginas/Asistencia.jsx";
import Configuracion from "../paginas/Configuracion.jsx";
import Reportes from "../paginas/Reportes.jsx";
import Seguridad from "../paginas/Seguridad.jsx";
import CarpetasBitacoras from "../paginas/CarpetasBitacoras.jsx";
import Mantenimiento from "../paginas/Mantenimiento.jsx";
import LogoMarca from "../componentes/LogoMarca.jsx";
import Encabezado from "../componentes/Encabezado.jsx";
import RegistroTrabajador from "../componentes/RegistroTrabajador.jsx";
import Acceso from "../componentes/Acceso.jsx";
import { deviceId } from "../utilidades/dispositivo.js";
import { usaFirebase } from "../repositorios/repositorio.js";
const pages = {
  dashboard: PanelPrincipal,
  employees: Personal,
  attendance: Asistencia,
  logs: CarpetasBitacoras,
  reports: Reportes,
  settings: Configuracion,
  security: Seguridad,
  maintenance: Mantenimiento,
};
const navigation = [
  ["dashboard", "▦", "Inicio"],
  ["employees", "♙", "Personal"],
  ["kiosk", "◉", "Asistencia 1 · Trabajador"],
  ["attendance", "◷", "Asistencia 2 · Administración"],
  ["logs", "☷", "Bitácoras de salud"],
  ["epp", "♙", "Bitácora de EPP"],
  ["labor", "▤", "Normas de la Secretaría del Trabajo"],
  ["maintenance", "⚒", "Mantenimiento y compras"],
  ["reports", "▤", "Reportes y CSV"],
  ["settings", "⚙", "Configuración"],
  ["security", "🔐", "Seguridad"],
];
export default function Aplicacion() {
  const { data, session, logout } = useAplicacion();
  const [page, setPage] = useState("dashboard"),
    [kiosk, setKiosk] = useState(false),
    [route, setRoute] = useState(() => location.hash);
  const mode = route.startsWith("#asistencia")
    ? "asistencia"
    : route.startsWith("#captura")
      ? "captura"
      : "admin";
  useEffect(() => {
    const onHash = () => setRoute(location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (mode === "asistencia") {
    const linked = data.terminals.some(
      (t) => t.id === deviceId() && t.kind === "asistencia" && t.active,
    );
    if (!linked)
      return (
        <main className="access-screen">
          <div className="panel">
            <LogoMarca official />
            <h1>Terminal sin vincular</h1>
            <p>
              María debe vincular este navegador en Configuración antes de abrir
              el registro de asistencia.
            </p>
            <a href="#administracion">Abrir administración</a>
          </div>
        </main>
      );
    return (
      <>
        <Encabezado titulo="Bienvenido a Rey Pez" />
        <RegistroTrabajador terminal />
      </>
    );
  }
  if (!session) return <Acceso operational={mode === "captura"} />;
  if (mode === "captura" || session.role === "worker")
    return (
      <>
        <Encabezado detalle={session.name} onLogout={logout} />
        <main className="capture-main">
          <CarpetasBitacoras key={route} operational />
        </main>
      </>
    );
  const Page = pages[page];
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Encabezado
        detalle="Sistema de Control Administrativo"
        identidad={`${session.name} · Administración`}
        onLogout={() => {
          setKiosk(false);
          logout();
        }}
      />
      <div className="layout">
        <nav aria-label="Navegación principal">
          <div className="navlabel">ADMINISTRACIÓN</div>
          {navigation.map(([key, icon, label]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              aria-current={page === key ? "page" : undefined}
              onClick={() => (key === "kiosk" ? setKiosk(true) : setPage(key))}
            >
              <span aria-hidden="true">{icon} &nbsp;</span>
              {label}
            </button>
          ))}
        </nav>
        <main id="main">
          {["logs", "epp", "labor"].includes(page) ? (
            <CarpetasBitacoras
              key={page}
              folder={page === "logs" ? "health" : page}
            />
          ) : (
            <Page navigate={setPage} openKiosk={() => setKiosk(true)} />
          )}
        </main>
      </div>
      {kiosk && <RegistroTrabajador onClose={() => setKiosk(false)} />}
      <footer>
        {usaFirebase
          ? "Rey Pez · Datos compartidos en línea"
          : "Rey Pez · Revisión local · Datos en este navegador"}
      </footer>
    </>
  );
}
