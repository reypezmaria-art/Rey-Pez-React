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
import RegistroTrabajador from "../componentes/RegistroTrabajador.jsx";
import Acceso from "../componentes/Acceso.jsx";
import { deviceId } from "../utilidades/dispositivo.js";
import { repository, usandoFirebase } from "../repositorios/repositorio.js";
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
        <header>
          <LogoMarca official />
          <div className="brand">Bienvenido a Rey Pez</div>
        </header>
        <RegistroTrabajador terminal />
      </>
    );
  }
  if (!session) return <Acceso operational={mode === "captura"} />;
  if (mode === "captura" || session.role === "worker")
    return (
      <>
        <header>
          <LogoMarca official />
          <div className="brand">
            REY PEZ <small>{session.name}</small>
          </div>
          <button onClick={logout}>Cerrar sesión</button>
        </header>
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
      <header>
        <div className="brand-lockup">
          <LogoMarca />
          <div className="brand">
            REY PEZ <small>Sistema de Control Administrativo</small>
          </div>
        </div>
        <div className="header-access">
          <LogoMarca official />
          <span>María · Administración</span>
          <button
            onClick={() => {
              setKiosk(false);
              logout();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
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
          {repository.aviso && (
            <div className="note" role="status">
              {repository.aviso}
            </div>
          )}
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
        {usandoFirebase
          ? "Rey Pez · Datos sincronizados con Firebase · La sesión permanece en este navegador hasta cerrarla"
          : "Rey Pez · Revisión local · Datos en este navegador · Sincronización entre equipos pendiente"}
      </footer>
    </>
  );
}
