import { useState } from "react";
import PanelPrincipal from "../paginas/PanelPrincipal.jsx";
import Personal from "../paginas/Personal.jsx";
import Asistencia from "../paginas/Asistencia.jsx";
import Configuracion from "../paginas/Configuracion.jsx";
import Reportes from "../paginas/Reportes.jsx";
import Seguridad from "../paginas/Seguridad.jsx";
import Bitacoras from "../paginas/Bitacoras.jsx";
import LogoMarca from "../componentes/LogoMarca.jsx";
import RegistroTrabajador from "../componentes/RegistroTrabajador.jsx";
const pages = {
  dashboard: PanelPrincipal,
  employees: Personal,
  attendance: Asistencia,
  logs: Bitacoras,
  reports: Reportes,
  settings: Configuracion,
  security: Seguridad,
};
const navigation = [
  ["dashboard", "▦", "Inicio"],
  ["employees", "♙", "Personal"],
  ["kiosk", "◉", "Asistencia 1 · Trabajador"],
  ["attendance", "◷", "Asistencia 2 · Administración"],
  ["logs", "☷", "Bitácoras"],
  ["reports", "▤", "Reportes y CSV"],
  ["settings", "⚙", "Configuración"],
  ["security", "🔐", "Seguridad"],
];
export default function Aplicacion() {
  const [page, setPage] = useState("dashboard"),
    [kiosk, setKiosk] = useState(false);
  const Page = pages[page];
  function navigate(next) {
    setPage(next);
  }
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
        <div className="pill">Prototipo local · Sin conexión al servidor</div>
      </header>
      <div className="layout">
        <nav aria-label="Navegación principal">
          <div className="navlabel">PRINCIPAL</div>
          {navigation.map(([key, icon, label]) => (
            <ElementoNavegacion
              key={key}
              pageKey={key}
              icon={icon}
              label={label}
              active={page === key}
              onClick={() => (key === "kiosk" ? setKiosk(true) : navigate(key))}
            />
          ))}
        </nav>
        <main id="main">
          <Page navigate={navigate} openKiosk={() => setKiosk(true)} />
        </main>
      </div>
      {kiosk && <RegistroTrabajador onClose={() => setKiosk(false)} />}
      <footer>
        Sistema de Control Administrativo Rey Pez · Prototipo inicial para
        validación · Datos almacenados localmente · Prototipo de prueba
      </footer>
    </>
  );
}
function ElementoNavegacion({ pageKey, icon, label, active, onClick }) {
  return (
    <>
      {pageKey === "logs" && <div className="navlabel">OPERACIÓN</div>}
      <button
        className={active ? "active" : ""}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        <span aria-hidden="true">{icon} &nbsp; </span>
        {label}
      </button>
    </>
  );
}
