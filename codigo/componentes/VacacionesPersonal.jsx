import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  Mensaje,
  Tabla,
  OpcionesEmpresa,
} from "./ElementosInterfaz.jsx";
import { nombresEmpresas } from "../dominio/empresas.js";
import { calendarDate } from "../utilidades/fechas.js";
import {
  cancelarVacaciones,
  derechoVacaciones,
  esPersonalVacaciones,
  festivosMexico,
  guardarVacacionesPorFechas,
  resumenVacacionesPorFechas,
  saldoVacaciones,
  vacacionesDelMes,
} from "../dominio/vacaciones.js";

const mostrar = (fecha) =>
  fecha ? fecha.split("-").reverse().join("/") : "Pendiente";
const vacio = () => ({ empleadoId: "", busqueda: "", inicio: "", regreso: "" });
const normalizar = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function VacacionesPersonal() {
  const { data, commit, pending, session, clock } = useAplicacion();
  const hoy = calendarDate(clock),
    nombres = nombresEmpresas(data);
  const [mes, setMes] = useState(hoy.slice(0, 7)),
    [empresa, setEmpresa] = useState("");
  const [form, setForm] = useState(null),
    [mensaje, setMensaje] = useState(""),
    [error, setError] = useState("");
  const [cancelar, setCancelar] = useState(null),
    [motivoCancelacion, setMotivoCancelacion] = useState("");
  const personas = data.employees.filter(
    (e) =>
      esPersonalVacaciones(e) && (!empresa || e.empresa_codigo === empresa),
  );
  const registros = vacacionesDelMes(data.employees, mes, empresa);
  const finMes = new Date(
    Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const revision = personas
    .map((e) => ({ e, d: derechoVacaciones(e, finMes) }))
    .filter(
      ({ d }) =>
        d?.anios > 0 && d.aniversario <= finMes && d.limite >= `${mes}-01`,
    );
  const empleado = data.employees.find(
    (e) => e.id_empleado === form?.empleadoId,
  );
  const coincidencias =
    form && !form.empleadoId && form.busqueda.trim()
      ? personas.filter((e) =>
          normalizar(form.busqueda)
            .trim()
            .split(/\s+/)
            .every((p) =>
              normalizar(`${e.id_empleado} ${e.nombre_completo}`).includes(p),
            ),
        )
      : [];
  let resumen = null,
    errorVista = "";
  if (empleado && form.inicio && form.regreso) {
    try {
      resumen = resumenVacacionesPorFechas(data, form);
    } catch (err) {
      errorVista = err.message;
    }
  }
  const vista = resumen?.salida;
  const festivos = Object.entries(
    festivosMexico(Number(mes.slice(0, 4))),
  ).filter(([fecha]) => fecha.startsWith(mes));
  function editar(e, v) {
    setForm({
      ...vacio(),
      id: v?.id,
      empleadoId: e.id_empleado,
      busqueda: `${e.id_empleado} — ${e.nombre_completo}`,
      inicio: v?.inicio || "",
      regreso: v?.regreso || "",
    });
    setCancelar(null);
    setError("");
    setMensaje("");
  }
  function field(nombre) {
    return {
      value: form[nombre],
      onChange: (e) =>
        setForm({
          ...form,
          [nombre]: e.target.value,
          incluidasEnPrevios: false,
        }),
    };
  }
  async function guardar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      await commit((s) => guardarVacacionesPorFechas(s, form, session.id));
      setForm(null);
      setMensaje("Vacaciones guardadas.");
    } catch (err) {
      setError(err.message);
    }
  }
  async function confirmarCancelacion(event) {
    event.preventDefault();
    setError("");
    try {
      await commit((s) =>
        cancelarVacaciones(
          s,
          cancelar.empleado.id_empleado,
          cancelar.id,
          motivoCancelacion,
          session.id,
        ),
      );
      setCancelar(null);
      setMensaje("Período cancelado. Se conserva en el historial.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section aria-label="Vacaciones del personal">
      <div className="panel">
        <h2>Vacaciones</h2>
        <p>
          Consulta salidas y regresos por mes, incluidos los períodos que
          comenzaron en el mes anterior.
        </p>
        <div className="formgrid">
          <Campo
            label="Mes de vacaciones"
            type="month"
            required
            value={mes}
            onChange={(e) => {
              if (e.target.value) setMes(e.target.value);
            }}
          />
          <Campo
            label="Empresa de vacaciones"
            as="select"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          >
            <option value="">Todas las empresas</option>
            <OpcionesEmpresa />
          </Campo>
        </div>
        {festivos.length > 0 && (
          <div className="note">
            <strong>Descanso obligatorio en México</strong>
            {festivos.map(([fecha, nombre]) => (
              <p key={fecha}>
                {mostrar(fecha)} · {nombre}. No consume días de vacaciones.
              </p>
            ))}
          </div>
        )}
        <p className="small">
          Jornada de lunes a sábado. Se excluyen domingos, descansos
          obligatorios y fechas adicionales de Configuración, incluidas jornadas
          electorales aplicables.
        </p>
        <button
          className="primary"
          onClick={() => {
            setForm(vacio());
            setCancelar(null);
            setMensaje("");
            setError("");
          }}
        >
          Programar vacaciones
        </button>
      </div>
      <Mensaje>{mensaje}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      {form && (
        <form className="panel" onSubmit={guardar}>
          <h2>{form.id ? "Modificar vacaciones" : "Programar vacaciones"}</h2>
          <div className="formgrid">
            <Campo
              label="Buscar trabajador por nombre o ID"
              placeholder="Escribe el nombre o ID…"
              autoComplete="off"
              required
              disabled={Boolean(form.id)}
              value={form.busqueda}
              onChange={(e) =>
                setForm({
                  ...form,
                  busqueda: e.target.value,
                  empleadoId: "",
                  incluidasEnPrevios: false,
                })
              }
            />
            <div>
              {coincidencias.length > 0 && (
                <div
                  role="group"
                  aria-label="Trabajadores encontrados"
                  className="actions"
                >
                  {coincidencias.map((e) => (
                    <button
                      type="button"
                      key={e.id_empleado}
                      onClick={() =>
                        setForm({
                          ...form,
                          empleadoId: e.id_empleado,
                          busqueda: `${e.id_empleado} — ${e.nombre_completo}`,
                        })
                      }
                    >
                      {e.id_empleado} — {e.nombre_completo}
                    </button>
                  ))}
                </div>
              )}
              {form.busqueda.trim() &&
                !form.empleadoId &&
                coincidencias.length === 0 && (
                  <p role="status">No se encontraron trabajadores.</p>
                )}
              {empleado && (
                <p>
                  <strong>{nombres[empleado.empresa_codigo]}</strong> · Ingreso:{" "}
                  {mostrar(empleado.fecha_ingreso)}
                </p>
              )}
            </div>
            <Campo
              label="Fecha de salida de vacaciones"
              type="date"
              required
              {...field("inicio")}
            />
            <Campo
              label="Fecha de regreso a trabajar"
              type="date"
              required
              {...field("regreso")}
            />
          </div>
          <p className="small">
            El regreso es el primer día que vuelve a trabajar; ese día no se
            cuenta como vacaciones.
          </p>
          {resumen?.previosOriginal > 0 &&
            resumen.previosOriginal >= vista?.dias &&
            !form.id && (
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(form.incluidasEnPrevios)}
                  onChange={(e) =>
                    setForm({ ...form, incluidasEnPrevios: e.target.checked })
                  }
                />{" "}
                Estas vacaciones ya estaban incluidas en los{" "}
                {resumen.previosOriginal} días guardados sin fechas.
              </label>
            )}
          {resumen && (
            <div
              className={resumen.restantes < 0 ? "note" : "toast"}
              role="status"
              aria-label="Saldo de vacaciones"
            >
              <strong>
                {resumen.restantes < 0
                  ? `El período excede el saldo por ${-resumen.restantes} días.`
                  : `Después de este período le quedan ${resumen.restantes} ${resumen.restantes === 1 ? "día disponible" : "días disponibles"}.`}
              </strong>
              <p>
                Antigüedad: {resumen.saldo.anios}{" "}
                {resumen.saldo.anios === 1 ? "año" : "años"} · Le corresponden:{" "}
                {resumen.saldo.dias} días · Este período: {vista.dias} días
                laborables.
              </p>
              <p className="small">
                Aniversario: {resumen.anio} · Otros períodos registrados:{" "}
                {resumen.saldo.registrados} días
                {resumen.previos === null
                  ? " · Saldo según los períodos registrados."
                  : ` · Días anteriores sin fechas: ${resumen.previos}.`}
              </p>
            </div>
          )}
          {vista && (
            <div className="note" role="status">
              Salida: <strong>{mostrar(vista.inicio)}</strong> · Último día de
              vacaciones: <strong>{mostrar(vista.fin)}</strong> · Regreso:{" "}
              <strong>{mostrar(vista.regreso)}</strong>
              <p>
                {vista.dias} días laborables. Descansos sin descontar:{" "}
                {vista.descansos.length
                  ? vista.descansos
                      .map((d) => `${mostrar(d.fecha)} (${d.motivo})`)
                      .join("; ")
                  : "Ninguno"}
                .
              </p>
            </div>
          )}
          <Mensaje error>{errorVista}</Mensaje>
          <div className="actions">
            <button
              className="primary"
              disabled={pending || !vista || resumen.restantes < 0}
            >
              Guardar vacaciones
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {cancelar && (
        <form className="panel" onSubmit={confirmarCancelacion}>
          <h2>Cancelar período de {cancelar.empleado.nombre_completo}</h2>
          <Campo
            label="Motivo de cancelación"
            required
            maxLength={500}
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
          />
          <div className="actions">
            <button disabled={pending}>Confirmar cancelación</button>
            <button type="button" onClick={() => setCancelar(null)}>
              Conservar período
            </button>
          </div>
        </form>
      )}
      <div className="panel">
        <h2>Vacaciones y regresos del mes</h2>
        <Tabla
          headings={[
            "Trabajador / empresa",
            "Salida",
            "Último día",
            "Regreso",
            "Días laborables",
            "Estado",
            "Acciones",
          ]}
          count={registros.length}
          empty="No hay vacaciones programadas para este mes."
        >
          {registros.map((v) => (
            <tr key={`${v.empleado.id_empleado}-${v.id}`}>
              <td>
                <strong>{v.empleado.nombre_completo}</strong>
                <br />
                {nombres[v.empresa || v.empleado.empresa_codigo]}
              </td>
              <td>{mostrar(v.inicio)}</td>
              <td>{mostrar(v.fin)}</td>
              <td>{mostrar(v.regreso)}</td>
              <td>{v.dias}</td>
              <td>
                {hoy < v.inicio
                  ? "Próximas"
                  : hoy < v.regreso
                    ? "En vacaciones"
                    : "Finalizadas"}
              </td>
              <td>
                <div className="table-actions">
                  <button
                    disabled={pending}
                    onClick={() => editar(v.empleado, v)}
                  >
                    Modificar
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      setCancelar(v);
                      setMotivoCancelacion("");
                      setForm(null);
                      setError("");
                    }}
                  >
                    Cancelar período
                  </button>
                </div>
                <details>
                  <summary>Ver descansos y detalle</summary>
                  <p>{v.motivo}</p>
                  {(v.descansos || []).map((d) => (
                    <p key={d.fecha}>
                      {mostrar(d.fecha)} · {d.motivo}
                    </p>
                  ))}
                </details>
              </td>
            </tr>
          ))}
        </Tabla>
      </div>
      <details className="panel">
        <summary>
          <strong>Días de vacaciones por revisar</strong>
        </summary>
        <p>
          Los días se calculan con la fecha de ingreso y las vacaciones
          registradas. Agrega cada salida y regreso para mantener el saldo
          actualizado.
        </p>
        <Tabla
          headings={[
            "Trabajador / empresa",
            "Aniversario",
            "Le corresponden",
            "Días anteriores sin fechas",
            "Registrados / programados",
            "Días disponibles",
            "Plazo para conceder",
            "Acción",
          ]}
          count={revision.length}
          empty="No hay aniversarios con plazo vigente en este mes."
        >
          {revision.map(({ e, d }) => (
            <tr key={e.id_empleado}>
              <td>
                <strong>{e.nombre_completo}</strong>
                <br />
                {nombres[e.empresa_codigo]}
              </td>
              <td>{mostrar(d.aniversario)}</td>
              <td>{d.dias}</td>
              <td>{e.vacaciones?.usadosPrevios?.[d.anio] ?? "Sin datos"}</td>
              <td>{saldoVacaciones(e, d.anio)?.registrados ?? 0}</td>
              <td>
                {saldoVacaciones(e, d.anio, {
                  previos: e.vacaciones?.usadosPrevios?.[d.anio] ?? 0,
                })?.disponibles ?? "Pendiente"}
              </td>
              <td>{mostrar(d.limite)}</td>
              <td>
                <button
                  disabled={d.aniversario > hoy}
                  onClick={() => editar(e)}
                >
                  Revisar y programar
                </button>
              </td>
            </tr>
          ))}
        </Tabla>
      </details>
      <details className="panel">
        <summary>
          <strong>Antigüedad y referencia anual por trabajador</strong>
        </summary>
        <p>
          Referencia de la LFT para relaciones continuas. No es un saldo
          acumulado: los días disfrutados anteriormente deben revisarse antes de
          programar. Un reingreso no confirma por sí solo la antigüedad
          reconocida.
        </p>
        <Tabla
          headings={[
            "Trabajador",
            "Empresa",
            "Ingreso",
            "Años cumplidos",
            "Días anuales de referencia",
            "Aniversario / plazo para conceder",
            "Acción",
          ]}
          count={personas.length}
        >
          {personas.map((e) => {
            const d = derechoVacaciones(e, hoy);
            return (
              <tr key={e.id_empleado}>
                <td>{e.nombre_completo}</td>
                <td>{nombres[e.empresa_codigo]}</td>
                <td>{mostrar(e.fecha_ingreso)}</td>
                <td>{d?.anios ?? "Pendiente"}</td>
                <td>{d?.dias ?? "Pendiente"}</td>
                <td>
                  {!d
                    ? "Revisar fecha de ingreso"
                    : d.anios === 0
                      ? `Primer aniversario: ${mostrar(d.siguiente)}`
                      : `${mostrar(d.aniversario)} · Hasta ${mostrar(d.limite)}${d.limite < hoy ? " · Revisar programación e historial" : ""}`}
                </td>
                <td>
                  <button disabled={!d?.dias} onClick={() => editar(e)}>
                    Programar
                  </button>
                </td>
              </tr>
            );
          })}
        </Tabla>
        <p className="small">
          LFT, artículos 74 y 76–81 · Prima vacacional mínima del 25 %.{" "}
          <a
            href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Consultar ley
          </a>
        </p>
      </details>
      <details className="panel">
        <summary>
          <strong>Historial de vacaciones</strong>
        </summary>
        {personas.flatMap((e) =>
          (e.vacaciones?.registros || []).map((v) => (
            <p key={`${e.id_empleado}-${v.id}`}>
              {e.nombre_completo} · {mostrar(v.inicio)} al {mostrar(v.fin)} ·{" "}
              {v.estado} · {v.motivoCancelacion || v.motivo}
            </p>
          )),
        )}
        <p className="small">
          Las modificaciones y cancelaciones conservan la versión anterior, el
          motivo y el responsable en el registro administrativo.
        </p>
      </details>
    </section>
  );
}
