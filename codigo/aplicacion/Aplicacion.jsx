import Administracion from "../paginas/Administracion.jsx";
import { useRegistroUso } from "../actividad/useRegistroUso.js";
import ConsultaSeccion from "../componentes/ConsultaSeccion.jsx";
import AutorizarNominaInicial from "../componentes/AutorizarNominaInicial.jsx";
import {
  puedeConsultarNomina,
  puedeConsultarSeccion,
} from "../dominio/accesoNomina.js";
import { useEffect, useRef, useState } from "react";
import { useAplicacion } from "./ContextoAplicacion.js";
import DetallePanel from "../paginas/DetallePanel.jsx";
import PanelPrincipal from "../paginas/PanelPrincipal.jsx";
import Nomina from "../paginas/Nomina.jsx";
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
import AvisoAcceso from "../componentes/AvisoAcceso.jsx";
import { destinoRestringido } from "../dominio/controlAcceso.js";
import { puedeVerNomina, canCapture } from "../dominio/seguridad.js";
import { deviceId } from "../utilidades/dispositivo.js";
import { fraseDelDia } from "../datos/frasesDiarias.js";
const pages = {
  dashboard: PanelPrincipal,
  administration: Administracion,
  dashboardDetail: DetallePanel,
  employees: Personal,
  payroll: Nomina,
  attendance: Asistencia,
  logs: CarpetasBitacoras,
  reports: Reportes,
  settings: Configuracion,
  security: Seguridad,
  maintenance: Mantenimiento,
};
const navigation = [
  ["dashboard", "▦", "Inicio"],
  ["administration", "◴", "Administración"],
  ["employees", "♙", "Personal"],
  ["payroll", "▤", "Nómina"],
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
  const { data, session, logout, clock, avisoAcceso, volverInicio } =
    useAplicacion();
  const frase = fraseDelDia(clock);
  const [menuAbierto, setMenuAbierto] = useState(() => {
    try {
      return localStorage.getItem("reypez_barra_lateral") !== "oculta";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "reypez_barra_lateral",
        menuAbierto ? "visible" : "oculta",
      );
    } catch {
      /* La preferencia visual no impide trabajar si el almacenamiento está lleno. */
    }
  }, [menuAbierto]);
  const alternarMenu = () => setMenuAbierto((abierto) => !abierto);
  const [detallePagina, setDetallePagina] = useState(null);
  function navigate(destino, detalle = null) {
    setPage(destino);
    setDetallePagina(detalle);
  }
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
  const restringido = destinoRestringido(data, session, route);
  const consultaUso = route.startsWith("#seccion?")
    ? new URLSearchParams(route.split("?")[1]).get("tipo")
    : null;
  const moduloUso =
    session?.role === "worker" || mode === "captura"
      ? route.startsWith("#nomina")
        ? "payroll"
        : consultaUso || "capture"
      : kiosk
        ? "kiosk"
        : page === "dashboardDetail"
          ? "dashboard"
          : page;
  const registroUso = useRegistroUso(
    session && !avisoAcceso && !restringido && mode !== "asistencia"
      ? `${session.role}:${session.id}`
      : null,
    moduloUso,
  );
  async function cerrarSesion() {
    await Promise.race([
      registroUso.terminar(),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    setKiosk(false);
    logout();
  }
  if (avisoAcceso)
    return (
      <main className="access-screen">
        <AvisoAcceso {...avisoAcceso} onInicio={volverInicio} />
      </main>
    );
  if (restringido)
    return <RutaDenegada key={`${session.id}-${route}`} modulo={restringido} />;
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
  if (mode === "captura" || session.role === "worker") {
    const verNomina =
      session.role === "worker" && puedeConsultarNomina(data, session);
    const enNomina = verNomina && route.startsWith("#nomina");
    const consulta = route.startsWith("#seccion?")
      ? new URLSearchParams(route.split("?")[1]).get("tipo")
      : "";
    const permiso = data.access.permissions[session.id];
    const tipos = (permiso?.logs || []).filter((tipo) =>
      canCapture(data, session, permiso.company, tipo),
    );
    const verBitacoras = session.role === "admin" || tipos.length > 0;
    const opciones = [
      [
        "employees",
        "♙",
        "Personal",
        "#seccion?tipo=employees",
        puedeConsultarSeccion(data, session, "employees"),
      ],
      ["payroll", "▤", "Nómina", "#nomina", verNomina],
      ["capture", "☷", "Bitácoras", "#captura", verBitacoras],
      [
        "maintenance",
        "⚒",
        "Mantenimiento y compras",
        "#seccion?tipo=maintenance",
        puedeConsultarSeccion(data, session, "maintenance"),
      ],
      [
        "reports",
        "▤",
        "Reportes y CSV",
        "#seccion?tipo=reports",
        puedeConsultarSeccion(data, session, "reports"),
      ],
      [
        "admin",
        "▦",
        "Administración",
        "#administracion",
        session.role === "admin",
      ],
    ].filter(([, , , , permitido]) => permitido);
    return (
      <>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        <Encabezado
          detalle="Sistema de Control Administrativo"
          identidad={session.name}
          onLogout={cerrarSesion}
          menuAbierto={menuAbierto}
          onToggleMenu={alternarMenu}
        />
        <div className={`layout${menuAbierto ? "" : " sidebar-hidden"}`}>
          <NavegacionLateral
            opciones={opciones}
            actual={consulta || (enNomina ? "payroll" : "capture")}
            abierta={menuAbierto}
            etiqueta="APARTADOS AUTORIZADOS"
            onNavigate={(key) => {
              location.hash = opciones.find(([id]) => id === key)[3];
            }}
          />
          <main id="main">
            {consulta ? (
              <ConsultaSeccion key={consulta} tipo={consulta} />
            ) : enNomina ? (
              <Nomina soloConsulta={!puedeVerNomina(data, session)} />
            ) : (
              <CarpetasBitacoras
                key={route}
                operational
                folder={
                  tipos.length && tipos.every((tipo) => tipo === "epp")
                    ? "epp"
                    : "health"
                }
              />
            )}
          </main>
        </div>
        <PiePagina frase={frase} uso={registroUso.estado} />
      </>
    );
  }
  const Page = pages[page];
  return (
    <>
      <AutorizarNominaInicial />
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Encabezado
        detalle="Sistema de Control Administrativo"
        identidad={`${session.name} · Administración`}
        menuAbierto={menuAbierto}
        onToggleMenu={alternarMenu}
        onLogout={cerrarSesion}
      />
      <div className={`layout${menuAbierto ? "" : " sidebar-hidden"}`}>
        <NavegacionLateral
          opciones={navigation}
          actual={page}
          abierta={menuAbierto}
          etiqueta="ADMINISTRACIÓN"
          onNavigate={(key) =>
            key === "kiosk" ? setKiosk(true) : navigate(key)
          }
        />
        <main id="main">
          {["logs", "epp", "labor"].includes(page) ? (
            <CarpetasBitacoras
              key={page}
              folder={page === "logs" ? "health" : page}
            />
          ) : (
            <Page
              key={page}
              navigate={navigate}
              detalleInicial={detallePagina || undefined}
              openKiosk={() => setKiosk(true)}
            />
          )}
        </main>
      </div>
      {kiosk && <RegistroTrabajador onClose={() => setKiosk(false)} />}
      <PiePagina frase={frase} uso={registroUso.estado} />
    </>
  );
}

function RutaDenegada({ modulo }) {
  const { denegarAcceso } = useAplicacion();
  const enviado = useRef(false);
  useEffect(() => {
    if (!enviado.current) {
      enviado.current = true;
      denegarAcceso(modulo);
    }
  }, [modulo, denegarAcceso]);
  return <main role="status">Comprobando permisos…</main>;
}
function NavegacionLateral({
  opciones,
  actual,
  abierta,
  etiqueta,
  onNavigate,
}) {
  return (
    <nav
      id="navegacion-principal"
      className="app-sidebar"
      aria-label="Navegación principal"
      hidden={!abierta}
    >
      <div className="navlabel">{etiqueta}</div>
      {opciones.map(([key, icono, titulo]) => (
        <button
          key={key}
          className={actual === key ? "active" : ""}
          aria-current={actual === key ? "page" : undefined}
          onClick={() => onNavigate(key)}
        >
          <span aria-hidden="true">{icono} &nbsp;</span>
          {titulo}
        </button>
      ))}
    </nav>
  );
}

function PiePagina({ frase, uso }) {
  return (
    <footer>
      <strong>Rey Pez</strong>
      {uso && <p className="small">{uso}</p>}
      <blockquote className="daily-quote" aria-label="Frase del día">
        <p>«{frase.texto}»</p>
        <cite>
          —{" "}
          <a href={frase.fuente} target="_blank" rel="noreferrer">
            {frase.autor}
          </a>
        </cite>
      </blockquote>
    </footer>
  );
}
