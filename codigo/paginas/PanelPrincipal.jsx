import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import { EncabezadoPagina } from "../componentes/ElementosInterfaz.jsx";
import { formatDateTime, isSameDay } from "../utilidades/fechas.js";
export default function PanelPrincipal({ navigate }) {
  const { data } = useAplicacion();
  const cards = [
    ["Empresas", 3, "Allan · Edgar · Estuardo"],
    ["Empleados cargados", data.employees.length, "Lista de preparación"],
    [
      "Registros de hoy",
      data.attendance.filter((a) => isSameDay(a.fecha_hora)).length,
      "Guardados en este navegador",
    ],
    [
      "Pendientes de sincronizar",
      data.attendance.length,
      "Este prototipo no tiene servidor",
    ],
  ];
  return (
    <section>
      <EncabezadoPagina
        title="Panel principal"
        subtitle="Resumen administrativo de Rey Pez"
      >
        <button className="primary" onClick={() => navigate("attendance")}>
          Registrar asistencia
        </button>
      </EncabezadoPagina>
      <div className="note">
        <b>Importante:</b> esta es una primera versión de prueba que guarda
        datos en este navegador. No es todavía un sistema multiusuario seguro ni
        un servicio en la nube. No la uses aún como registro laboral oficial.
      </div>
      <div className="cards">
        {cards.map(([label, value, foot]) => (
          <div className="card" key={label}>
            <div className="klabel">{label}</div>
            <div className="kvalue">{value}</div>
            <div className="kfoot">{foot}</div>
          </div>
        ))}
      </div>
      <div className="columns">
        <div className="panel">
          <h2>Accesos rápidos</h2>
          <div className="actions">
            <button onClick={() => navigate("employees")}>
              Revisar personal
            </button>
            <button onClick={() => navigate("attendance")}>Asistencia</button>
            <button onClick={() => navigate("reports")}>Exportar CSV</button>
          </div>
          <p className="small">
            Las secciones de bitácoras y configuración se muestran como
            estructura inicial; se desarrollarán después de validar asistencia.
          </p>
        </div>
        <div className="panel">
          <h2>Actividad reciente</h2>
          <div className="small">
            {data.attendance.length
              ? data.attendance.slice(0, 5).map((a, i) => (
                  <p key={a.id_registro || i}>
                    <b>{a.movimiento}</b> · {a.nombre_completo}
                    <br />
                    <span className="small">
                      {formatDateTime(a.fecha_hora)}
                    </span>
                  </p>
                ))
              : "Todavía no hay registros de asistencia."}
          </div>
        </div>
      </div>
    </section>
  );
}
