import { useState } from "react";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  Mensaje,
  Tabla,
  OpcionesEmpresa,
  OpcionesEmpleado,
} from "./ElementosInterfaz.jsx";
import { nombresEmpresas } from "../dominio/empresas.js";
import { calendarDate } from "../utilidades/fechas.js";
import {
  calcularSalida,
  cancelarVacaciones,
  derechoVacaciones,
  esPersonalVacaciones,
  festivosMexico,
  guardarVacaciones,
  guardarDiasUsados,
  saldoVacaciones,
  vacacionesDelMes,
} from "../dominio/vacaciones.js";

const mostrar = (fecha) =>
  fecha ? fecha.split("-").reverse().join("/") : "Pendiente";
const vacio = () => ({
  empleadoId: "",
  inicio: "",
  dias: "",
  anio: "",
  previos: "",
  confirmado: false,
});
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
  const saldo =
    empleado && form
      ? saldoVacaciones(empleado, form.anio, {
          previos: form.previos,
          excluirId: form.id,
        })
      : null;
  const diasAutomaticos = saldo
    ? Math.max(0, saldo.disponibles ?? saldo.dias)
    : "";
  const diasDisfrutar = form?.dias === "" ? diasAutomaticos : form?.dias;
  let vista = null,
    errorVista = "";
  if (form?.inicio && Number(diasDisfrutar) > 0) {
    try {
      vista = calcularSalida(
        form.inicio,
        Number(diasDisfrutar),
        data.holidays || [],
      );
    } catch (err) {
      errorVista = err.message;
    }
  }
  const festivos = Object.entries(
    festivosMexico(Number(mes.slice(0, 4))),
  ).filter(([fecha]) => fecha.startsWith(mes));
  function editar(e, v) {
    const d = derechoVacaciones(e, hoy),
      anio = v?.anio || d?.anio || "";
    setForm({
      ...vacio(),
      ...v,
      empleadoId: e.id_empleado,
      anio,
      previos: e.vacaciones?.usadosPrevios?.[anio] ?? "",
      confirmado: false,
    });
    setCancelar(null);
    setError("");
    setMensaje("");
  }
  function field(nombre) {
    return {
      value: form[nombre],
      onChange: (e) => setForm({ ...form, [nombre]: e.target.value }),
    };
  }
  async function guardar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      await commit((s) =>
        guardarVacaciones(s, { ...form, dias: diasDisfrutar }, session.id),
      );
      setForm(null);
      setMensaje("Vacaciones guardadas.");
    } catch (err) {
      setError(err.message);
    }
  }
  async function guardarUsados() {
    setError("");
    setMensaje("");
    try {
      let guardado;
      await commit((s) => {
        const siguiente = guardarDiasUsados(s, form, session.id);
        guardado = saldoVacaciones(
          siguiente.employees.find((e) => e.id_empleado === form.empleadoId),
          form.anio,
        );
        return siguiente;
      });
      setForm(null);
      setMensaje(
        `Días ya usados guardados. Le quedan ${guardado.disponibles} días disponibles. No se agregó otro período de vacaciones.`,
      );
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
              label="Trabajador de vacaciones"
              as="select"
              required
              disabled={Boolean(form.id)}
              value={form.empleadoId}
              onChange={(e) => {
                const p = data.employees.find(
                  (x) => x.id_empleado === e.target.value,
                );
                if (p) editar(p);
                else setForm(vacio());
              }}
            >
              <OpcionesEmpleado employees={personas} />
            </Campo>
            <Campo
              label="Año del aniversario al que se aplican"
              type="number"
              min="2023"
              max={Number(hoy.slice(0, 4))}
              required
              {...field("anio")}
              onChange={(e) =>
                setForm({
                  ...form,
                  anio: e.target.value,
                  previos:
                    empleado?.vacaciones?.usadosPrevios?.[e.target.value] ?? "",
                  confirmado: false,
                  dias: form.id ? form.dias : "",
                })
              }
            />
            <Campo
              label="Primer día de vacaciones"
              type="date"
              required
              {...field("inicio")}
            />
            <Campo
              label="Antigüedad al cumplir ese aniversario"
              readOnly
              value={
                saldo
                  ? `${saldo.anios} ${saldo.anios === 1 ? "año" : "años"}`
                  : "Pendiente"
              }
            />
            <Campo
              label="Días que le corresponden (automático)"
              readOnly
              value={saldo?.dias ?? "Pendiente"}
            />
            <Campo
              label="Días ya usados fuera de este apartado para ese aniversario"
              type="number"
              min="0"
              required
              {...field("previos")}
              onChange={(e) =>
                setForm({
                  ...form,
                  previos: e.target.value,
                  dias: form.id ? form.dias : "",
                  confirmado: false,
                })
              }
            />
            <Campo
              label="Días laborables a disfrutar"
              type="number"
              min="1"
              max={Math.max(1, saldo?.disponibles ?? 366)}
              required
              value={diasDisfrutar ?? ""}
              onChange={(e) => setForm({ ...form, dias: e.target.value })}
            />
          </div>
          {empleado && (
            <p>
              Empresa: <strong>{nombres[empleado.empresa_codigo]}</strong> ·
              Ingreso registrado: {mostrar(empleado.fecha_ingreso)}. Los días
              anteriores deben incluir vacaciones que aún no estén registradas
              aquí.
            </p>
          )}
          {saldo && (
            <div
              className={saldo.disponibles < 0 ? "note" : "toast"}
              role="status"
              aria-label="Saldo de vacaciones"
            >
              <strong>
                {saldo.disponibles === null
                  ? "Captura los días ya usados para calcular cuántos le quedan."
                  : saldo.disponibles < 0
                    ? "Los días capturados superan los que le corresponden."
                    : `Le quedan ${saldo.disponibles} días disponibles.`}
              </strong>
              <p>
                Le corresponden {saldo.dias} días · Ya usados fuera de este
                apartado: {saldo.previos ?? "Por capturar"} · Otros días
                registrados o programados: {saldo.registrados}.
              </p>
              <p className="small">
                Los días a disfrutar se completan automáticamente con el saldo
                disponible. Puedes reducirlos si tomará solo una parte. Si solo
                estás capturando lo que ya tomó, usa «Guardar días ya usados» y
                no llenes una nueva salida.
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
          <label>
            <input
              type="checkbox"
              required
              checked={form.confirmado}
              onChange={(e) =>
                setForm({ ...form, confirmado: e.target.checked })
              }
            />{" "}
            Confirmo la antigüedad reconocida, que la relación es continua (no
            de temporada), el saldo previo y las fechas acordadas con el
            trabajador.
          </label>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={
                pending ||
                !saldo ||
                saldo.disponibles === null ||
                saldo.disponibles < 0
              }
              onClick={guardarUsados}
            >
              Guardar días ya usados
            </button>
            <button disabled={pending || !vista}>Guardar vacaciones</button>
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
      <div className="panel">
        <h2>Días de vacaciones por revisar</h2>
        <p>
          Calculamos los días por antigüedad. Captura los días que ya tomó cada
          trabajador para ver cuántos le quedan; los períodos registrados aquí
          se descuentan automáticamente.
        </p>
        <Tabla
          headings={[
            "Trabajador / empresa",
            "Aniversario",
            "Le corresponden",
            "Ya usados fuera de este apartado",
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
              <td>{e.vacaciones?.usadosPrevios?.[d.anio] ?? "Por capturar"}</td>
              <td>{saldoVacaciones(e, d.anio)?.registrados ?? 0}</td>
              <td>
                {saldoVacaciones(e, d.anio)?.disponibles ?? "Por capturar"}
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
      </div>
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
