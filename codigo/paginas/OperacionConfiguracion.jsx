import { deviceId } from "../utilidades/dispositivo.js";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAplicacion } from "../aplicacion/ContextoAplicacion.js";
import {
  Campo,
  Mensaje,
  OpcionesEmpresa,
  OpcionesEmpleado,
} from "../componentes/ElementosInterfaz.jsx";
import { logTypes } from "../datos/operacionInicial.js";
import { usandoFirebase } from "../repositorios/repositorio.js";
export default function OperacionConfiguracion() {
  const { data, commit, pending } = useAplicacion();
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [holiday, setHoliday] = useState(""),
    [name, setName] = useState(""),
    [company, setCompany] = useState("ALLAN"),
    [kind, setKind] = useState("room"),
    [terminalName, setTerminalName] = useState(""),
    [terminalKind, setTerminalKind] = useState("asistencia");
  const [employeeId, setEmployeeId] = useState(""),
    [date, setDate] = useState(""),
    [scheduleCode, setScheduleCode] = useState(""),
    [reason, setReason] = useState("");
  const [program, setProgram] = useState({
    company: "ALLAN",
    area: "",
    type: "temperature",
    times: "09:00,13:00,17:00",
    days: [1, 2, 3, 4, 5, 6],
  });
  const [qrArea, setQrArea] = useState(""),
    [qrImage, setQrImage] = useState("");
  const url = `${location.href.split("#")[0]}#captura?area=${encodeURIComponent(qrArea)}`;
  useEffect(() => {
    let active = true;
    if (qrArea)
      QRCode.toDataURL(url, { width: 220, margin: 2 })
        .then((image) => {
          if (active) setQrImage(image);
        })
        .catch(() => {
          if (active) setQrImage("");
        });
    return () => {
      active = false;
    };
  }, [url, qrArea]);
  async function run(update, text) {
    setError("");
    try {
      await commit(update);
      setMessage(text);
    } catch (err) {
      setError(err.message);
    }
  }
  function addCatalog(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre.");
    const key = kind === "room" ? "rooms" : "areas";
    run(
      (state) => ({
        ...state,
        [key]: [
          ...state[key],
          { id: crypto.randomUUID(), company, name: name.trim(), active: true },
        ],
      }),
      "Catálogo actualizado.",
    ).then(() => setName(""));
  }
  function addProgram(e) {
    e.preventDefault();
    const times = program.times.split(",").map((t) => t.trim());
    if (
      !program.area ||
      !program.days.length ||
      times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    )
      return setError("Revisa área, días y horas (HH:MM).");
    run(
      (state) => ({
        ...state,
        programs: [
          ...state.programs,
          {
            ...program,
            id: crypto.randomUUID(),
            times: [...new Set(times)],
            active: true,
          },
        ],
      }),
      "Programación guardada.",
    );
  }
  function exception(e) {
    e.preventDefault();
    if (!employeeId || !date || !scheduleCode || !reason.trim())
      return setError("Completa empleado, fecha, horario y motivo.");
    run(
      (state) => ({
        ...state,
        scheduleExceptions: [
          ...state.scheduleExceptions.filter(
            (x) => x.employeeId !== employeeId || x.date !== date,
          ),
          { employeeId, date, scheduleCode, reason, by: "MARIA" },
        ],
      }),
      "Excepción autorizada guardada.",
    );
  }
  return (
    <>
      <Mensaje>{message}</Mensaje>
      <Mensaje error>{error}</Mensaje>
      <div className="columns">
        <form className="panel" onSubmit={addCatalog}>
          <h2>Áreas y cuartos fríos</h2>
          <Campo
            label="Empresa del área"
            as="select"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <OpcionesEmpresa />
          </Campo>
          <Campo
            label="Tipo de catálogo"
            as="select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="room">Cuarto frío</option>
            <option value="area">Área operativa</option>
          </Campo>
          <Campo
            label="Nombre del área / cuarto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button disabled={pending}>Agregar</button>
          <p className="small">
            Allan: 4 cuartos confirmados. Edgar: 1. Estuardo: 2. Agrega solo
            cuartos que hayas confirmado.
          </p>
          {data.rooms
            .concat(data.areas)
            .filter((a) => a.company === company)
            .map((a) => (
              <p key={a.id}>
                {a.name} · {a.active === false ? "Inactivo" : "Activo"}{" "}
                <button
                  type="button"
                  onClick={() =>
                    run(
                      (state) => ({
                        ...state,
                        [data.rooms.some((r) => r.id === a.id)
                          ? "rooms"
                          : "areas"]: state[
                          data.rooms.some((r) => r.id === a.id)
                            ? "rooms"
                            : "areas"
                        ].map((x) =>
                          x.id === a.id
                            ? { ...x, active: x.active === false }
                            : x,
                        ),
                      }),
                      "Estado del área actualizado.",
                    )
                  }
                >
                  {a.active === false ? "Activar" : "Desactivar"}
                </button>
              </p>
            ))}
        </form>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (!holiday) return;
            run(
              (state) => ({
                ...state,
                holidays: [...new Set([...state.holidays, holiday])],
              }),
              "Día no laborable agregado.",
            );
          }}
        >
          <h2>Días no laborables</h2>
          <p>
            Domingos excluidos automáticamente. Agrega los festivos y cierres
            confirmados para evitar ausencias y avisos de bitácoras.
          </p>
          <Campo
            label="Fecha no laborable"
            type="date"
            value={holiday}
            onChange={(e) => setHoliday(e.target.value)}
            required
          />
          <button>Agregar fecha</button>
          {data.holidays.map((d) => (
            <p key={d}>
              {d}{" "}
              <button
                type="button"
                onClick={() =>
                  run(
                    (state) => ({
                      ...state,
                      holidays: state.holidays.filter((x) => x !== d),
                    }),
                    "Fecha retirada.",
                  )
                }
              >
                Quitar
              </button>
            </p>
          ))}
        </form>
        <form className="panel" onSubmit={exception}>
          <h2>Excepción de horario autorizada</h2>
          <Campo
            label="Empleado de la excepción"
            as="select"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <OpcionesEmpleado employees={data.employees} />
          </Campo>
          <Campo
            label="Fecha de la excepción"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Campo
            label="Horario excepcional"
            as="select"
            value={scheduleCode}
            onChange={(e) => setScheduleCode(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {data.schedules
              .filter(
                (s) =>
                  s.empresa_codigo ===
                  data.employees.find((e) => e.id_empleado === employeeId)
                    ?.empresa_codigo,
              )
              .map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nombre}
                </option>
              ))}
          </Campo>
          <Campo
            label="Motivo de la excepción"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <button>Guardar excepción</button>
          {data.scheduleExceptions.map((x) => (
            <p key={x.employeeId + x.date}>
              {x.date} · {x.employeeId} · {x.scheduleCode} · {x.reason}
              <button
                type="button"
                onClick={() =>
                  run(
                    (state) => ({
                      ...state,
                      scheduleExceptions: state.scheduleExceptions.filter(
                        (y) => y !== x,
                      ),
                    }),
                    "Excepción retirada.",
                  )
                }
              >
                Quitar
              </button>
            </p>
          ))}
        </form>
        <form className="panel" onSubmit={addProgram}>
          <h2>Programación de bitácoras</h2>
          <Campo
            label="Empresa de programación"
            as="select"
            value={program.company}
            onChange={(e) =>
              setProgram({ ...program, company: e.target.value, area: "" })
            }
          >
            <OpcionesEmpresa />
          </Campo>
          <Campo
            label="Bitácora programada"
            as="select"
            value={program.type}
            onChange={(e) =>
              setProgram({ ...program, type: e.target.value, area: "" })
            }
          >
            {Object.entries(logTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Campo>
          <Campo
            label="Área programada"
            as="select"
            value={program.area}
            onChange={(e) => setProgram({ ...program, area: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {(program.type === "temperature" ? data.rooms : data.areas)
              .filter(
                (a) => a.company === program.company && a.active !== false,
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Campo>
          <Campo
            label="Horas separadas por comas"
            value={program.times}
            onChange={(e) => setProgram({ ...program, times: e.target.value })}
          />
          <div className="permission-list">
            {[
              "Domingo",
              "Lunes",
              "Martes",
              "Miércoles",
              "Jueves",
              "Viernes",
              "Sábado",
            ].map((d, i) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={program.days.includes(i)}
                  onChange={(e) =>
                    setProgram({
                      ...program,
                      days: e.target.checked
                        ? [...program.days, i]
                        : program.days.filter((n) => n !== i),
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <button>Agregar programación</button>
          <p className="small">
            Cloro y limpieza: lunes mañana/tarde, con referencias editables
            09:00 y 17:00. Temperaturas: 09:00, 13:00 y 17:00.
          </p>
          {data.programs.map((p) => (
            <p key={p.id}>
              {p.company} · {logTypes[p.type]} ·{" "}
              {data.rooms.concat(data.areas).find((a) => a.id === p.area)?.name}{" "}
              · {p.times.join(", ")}{" "}
              <button
                type="button"
                onClick={() =>
                  run(
                    (state) => ({
                      ...state,
                      programs: state.programs.map((x) =>
                        x.id === p.id ? { ...x, active: !x.active } : x,
                      ),
                    }),
                    "Programación actualizada.",
                  )
                }
              >
                {p.active ? "Pausar" : "Activar"}
              </button>
            </p>
          ))}
        </form>
      </div>
      <div className="columns">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (!terminalName.trim()) return;
            const id = deviceId();
            run(
              (state) => ({
                ...state,
                terminals: [
                  ...state.terminals.filter((t) => t.id !== id),
                  {
                    id,
                    name: terminalName,
                    kind: terminalKind,
                    active: true,
                    by: "MARIA",
                  },
                ],
              }),
              "Este navegador quedó vinculado como terminal.",
            );
          }}
        >
          <h2>Vinculación de este equipo</h2>
          <Campo
            label="Nombre del equipo"
            value={terminalName}
            onChange={(e) => setTerminalName(e.target.value)}
            required
          />
          <Campo
            label="Uso del equipo"
            as="select"
            value={terminalKind}
            onChange={(e) => setTerminalKind(e.target.value)}
          >
            <option value="asistencia">Asistencia</option>
            <option value="captura">Captura operativa</option>
          </Campo>
          <button>Vincular este navegador</button>
          <p className="small">
            {usandoFirebase
              ? "La terminal de asistencia obtiene una cuenta limitada: puede leer el catálogo y crear marcajes, no bitácoras ni mantenimiento. Desvincularla corta ese acceso. La captura del teléfono usa la cuenta del trabajador."
              : "En esta revisión local la vinculación no se transmite a otros equipos. Abre la copia en el equipo y autorízalo ahí; la sincronización central está pendiente."}
          </p>
          {data.terminals.map((t) => (
            <p key={t.id}>
              {t.name} · {t.kind} · {t.active ? "Vinculado" : "Desvinculado"}{" "}
              {t.active && (
                <button
                  type="button"
                  onClick={() =>
                    run(
                      (state) => ({
                        ...state,
                        terminals: state.terminals.map((x) =>
                          x.id === t.id ? { ...x, active: false } : x,
                        ),
                      }),
                      "Equipo desvinculado.",
                    )
                  }
                >
                  Desvincular
                </button>
              )}
            </p>
          ))}
          <a
            className="btn"
            href="#asistencia"
            target="_blank"
            rel="noreferrer"
          >
            Abrir terminal de asistencia
          </a>
        </form>
        <div className="panel">
          <h2>QR por área</h2>
          <Campo
            label="Área para QR"
            as="select"
            value={qrArea}
            onChange={(e) => setQrArea(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {data.areas
              .concat(data.rooms)
              .filter((a) => a.active !== false)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.name}
                </option>
              ))}
          </Campo>
          {qrArea && (
            <>
              {qrImage && (
                <img
                  src={qrImage}
                  width="220"
                  height="220"
                  alt="QR de captura del área"
                />
              )}
              <p>
                <a href={url} target="_blank" rel="noreferrer">
                  Abrir captura del área
                </a>
              </p>
              <a href={qrImage} download="QR_Rey_Pez.png">
                Descargar QR
              </a>
              <p className="small">
                El QR identifica el área; el trabajador debe ingresar con ID,
                contraseña y permiso. Para escanear desde un teléfono se
                necesita una dirección accesible al equipo; un archivo local o
                localhost no sirve como enlace compartido.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
