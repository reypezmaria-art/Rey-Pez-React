import SeccionesPagina, {
  PanelSeccion,
} from "../componentes/SeccionesPagina.jsx";
import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  EncabezadoPagina,
  Mensaje,
  Tabla,
} from "../componentes/ElementosInterfaz.jsx";
import { usaFirebase } from "../repositorios/repositorio.js";
import { usoServidor } from "../firebase/sesion.js";
import { duracionUso, modulosUso } from "../actividad/contadorUso.js";
import { formatDateTime } from "../utilidades/fechas.js";
const fecha = (ms) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
const hora = (ms) => (ms ? formatDateTime(new Date(ms).toISOString()) : "—");
export default function Administracion() {
  const { session, clock } = useAplicacion();
  const [seccion, setSeccion] = useState(null);
  const [desde, setDesde] = useState(() => fecha(Date.now() - 6 * 86400000));
  const [hasta, setHasta] = useState(() => fecha(Date.now()));
  const [vista, setVista] = useState("diaria"),
    [empresa, setEmpresa] = useState(""),
    [usuario, setUsuario] = useState("");
  const [registros, setRegistros] = useState([]),
    [cursor, setCursor] = useState(null),
    [pendiente, setPendiente] = useState(false),
    [error, setError] = useState(""),
    [consulta, setConsulta] = useState(null);
  if (session?.role !== "admin")
    return <Mensaje error>Solo María puede consultar Administración.</Mensaje>;
  async function cargar(mas = false) {
    setPendiente(true);
    setError("");
    try {
      const respuesta = await usoServidor("consultarUso", {
        vista,
        desde,
        hasta,
        ...(mas && cursor ? { cursor } : {}),
      });
      setRegistros((previos) =>
        mas
          ? [
              ...previos,
              ...respuesta.registros.filter(
                (r) => !previos.some((p) => p.id === r.id),
              ),
            ]
          : respuesta.registros,
      );
      setCursor(respuesta.cursor);
      setConsulta({ vista, desde, hasta, hora: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setPendiente(false);
    }
  }
  const cambia = (setter) => (e) => {
    setter(e.target.value);
    setRegistros([]);
    setCursor(null);
    setConsulta(null);
    setEmpresa("");
    setUsuario("");
  };
  const filtrados = registros.filter(
    (r) =>
      (!empresa || r.empresa === empresa) && (!usuario || r.uid === usuario),
  );
  const agrupados = new Map();
  for (const r of filtrados) {
    const previo = agrupados.get(r.uid);
    agrupados.set(r.uid, {
      ...(previo && previo.ultimoMs > r.ultimoMs ? previo : r),
      visibleMs: (previo?.visibleMs || 0) + r.visibleMs,
      activoMs: (previo?.activoMs || 0) + r.activoMs,
      sesiones: (previo?.sesiones || 0) + r.sesiones,
    });
  }
  const resumen = [...agrupados.values()].sort(
    (a, b) => b.activoMs - a.activoMs,
  );
  const estado = (r) =>
    r.finMs
      ? "Cerrada"
      : +clock - r.ultimoMs > 120000
        ? "Sin señal reciente"
        : !r.visible
          ? "En segundo plano"
          : r.activo
            ? "Con actividad reciente"
            : "Visible, sin actividad reciente";
  const usuarios = [...new Map(registros.map((r) => [r.uid, r])).values()];
  return (
    <section>
      <EncabezadoPagina
        title="Administración"
        subtitle="Uso de la aplicación por usuarios autorizados"
      />
      <SeccionesPagina
        titulo="Administración"
        seleccion={seccion}
        onSeleccion={(valor) => {
          setSeccion(valor);
          setVista(valor || "diaria");
          setRegistros([]);
          setCursor(null);
          setConsulta(null);
          setError("");
        }}
        disabled={pendiente}
        opciones={[
          {
            id: "diaria",
            titulo: "Resumen por usuario",
            icono: "♙",
            descripcion:
              "Tiempo visible y actividad reciente de los usuarios dependientes.",
          },
          {
            id: "sesiones",
            titulo: "Sesiones de usuarios",
            icono: "◷",
            descripcion:
              "Inicio, último contacto y duración de cada sesión registrada.",
          },
        ]}
      />
      <PanelSeccion activa={Boolean(seccion)}>
        <div className="panel">
          <p>
            Solo se registra a los usuarios dependientes con acceso autorizado;
            María queda excluida. Visible cuenta el tiempo con la app al frente;
            actividad reciente cuenta los intervalos con interacción en los
            últimos cinco minutos.
          </p>
          <p className="small">
            Son tiempos aproximados confirmados por el servidor, sin sumar dos
            veces pestañas simultáneas. Una ventana cerrada sin conexión puede
            aparecer sin señal. No equivalen a horas de asistencia.
          </p>
          {!usaFirebase ? (
            <Mensaje>
              La copia local no registra sesiones compartidas. Esta consulta
              estará disponible en la página conectada a Firebase.
            </Mensaje>
          ) : (
            <>
              <div className="formgrid">
                <Campo
                  label="Desde"
                  type="date"
                  value={desde}
                  onChange={cambia(setDesde)}
                  disabled={pendiente}
                />
                <Campo
                  label="Hasta"
                  type="date"
                  value={hasta}
                  onChange={cambia(setHasta)}
                  disabled={pendiente}
                />
              </div>
              <button
                className="primary"
                disabled={pendiente}
                onClick={() => cargar()}
              >
                {pendiente ? "Consultando…" : "Consultar / actualizar"}
              </button>
            </>
          )}
          <Mensaje error>{error}</Mensaje>
        </div>
        {consulta && (
          <div className="panel">
            <div className="formgrid">
              <Campo
                label="Empresa de la cuenta"
                as="select"
                value={empresa}
                onChange={(e) => {
                  setEmpresa(e.target.value);
                  setUsuario("");
                }}
              >
                <option value="">Todas</option>
                {[...new Set(registros.map((r) => r.empresa))]
                  .sort()
                  .map((e) => (
                    <option key={e}>{e}</option>
                  ))}
              </Campo>
              <Campo
                label="Usuario"
                as="select"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              >
                <option value="">Todos</option>
                {usuarios
                  .filter((r) => !empresa || r.empresa === empresa)
                  .map((r) => (
                    <option key={r.uid} value={r.uid}>
                      {r.cuenta} — {r.nombre}
                    </option>
                  ))}
              </Campo>
            </div>
            <p className="small">
              Del {consulta.desde} al {consulta.hasta} · Consulta:{" "}
              {hora(consulta.hora)}.{" "}
              {cursor
                ? "Resultados parciales: carga los siguientes registros para completar los totales y filtros."
                : "Consulta completa."}{" "}
              Los tiempos corresponden a los registros cargados.
            </p>
            {consulta.vista === "sesiones" && (
              <p className="small">
                Cada sesión muestra su propia duración. El resumen por usuario
                evita sumar los intervalos de sesiones simultáneas.
              </p>
            )}
            <Tabla
              headings={
                consulta.vista === "diaria"
                  ? [
                      "Usuario",
                      "Empresa de la cuenta",
                      "Sesiones iniciadas",
                      "Visible",
                      "Actividad reciente",
                      "Último contacto / apartado",
                      "Estado",
                    ]
                  : [
                      "Usuario",
                      "Empresa de la cuenta",
                      "Inicio",
                      "Último contacto / cierre",
                      "Visible",
                      "Actividad reciente",
                      "Apartado / estado",
                    ]
              }
              count={filtrados.length}
              empty="Sin sesiones registradas en estas fechas."
            >
              {(consulta.vista === "diaria" ? resumen : filtrados).map((r) => (
                <tr key={consulta.vista === "diaria" ? r.uid : r.id}>
                  <td>
                    <strong>{r.nombre}</strong>
                    <br />
                    {r.cuenta}
                  </td>
                  <td>{r.empresa}</td>
                  {consulta.vista === "diaria" ? (
                    <>
                      <td>{r.sesiones}</td>
                      <td>{duracionUso(r.visibleMs)}</td>
                      <td>{duracionUso(r.activoMs)}</td>
                      <td>
                        {hora(r.ultimoMs)}
                        <br />
                        {modulosUso[r.modulo] || r.modulo}
                      </td>
                      <td>{estado(r)}</td>
                    </>
                  ) : (
                    <>
                      <td>{hora(r.inicioMs)}</td>
                      <td>{hora(r.finMs || r.ultimoMs)}</td>
                      <td>{duracionUso(r.visibleMs)}</td>
                      <td>{duracionUso(r.activoMs)}</td>
                      <td>
                        {modulosUso[r.modulo] || r.modulo}
                        <br />
                        {estado(r)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </Tabla>
            {cursor && (
              <button disabled={pendiente} onClick={() => cargar(true)}>
                Cargar más registros
              </button>
            )}
          </div>
        )}
      </PanelSeccion>
    </section>
  );
}
