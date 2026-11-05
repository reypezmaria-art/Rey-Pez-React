import { calendarDate, normalizeDate } from "../utilidades/fechas.js";

export function fechaValida(valor) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(valor || "") &&
    !Number.isNaN(Date.parse(`${valor}T12:00:00Z`)) &&
    new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor
  );
}
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function aniversario(ingreso, anio) {
  const fecha = `${anio}${ingreso.slice(4)}`;
  return fechaValida(fecha) ? fecha : `${anio}-02-28`;
}
export function diasPorAntiguedad(anios) {
  if (!Number.isInteger(anios) || anios < 1) return 0;
  return anios <= 5 ? 10 + anios * 2 : 22 + 2 * Math.floor((anios - 6) / 5);
}
export function derechoVacaciones(empleado, hoy = calendarDate(new Date())) {
  const ingreso = normalizeDate(empleado.fecha_ingreso || "");
  if (!fechaValida(ingreso) || ingreso > hoy) return null;
  let anio = Number(hoy.slice(0, 4));
  if (aniversario(ingreso, anio) > hoy) anio--;
  const anios = Math.max(0, anio - Number(ingreso.slice(0, 4)));
  const inicio = aniversario(ingreso, anio);
  const mesLimite = new Date(`${inicio}T12:00:00Z`);
  mesLimite.setUTCMonth(mesLimite.getUTCMonth() + 6, 1);
  const ultimo = new Date(
    Date.UTC(mesLimite.getUTCFullYear(), mesLimite.getUTCMonth() + 1, 0),
  ).getUTCDate();
  mesLimite.setUTCDate(Math.min(Number(inicio.slice(8)), ultimo));
  return {
    anios,
    dias: diasPorAntiguedad(anios),
    anio,
    aniversario: inicio,
    limite: mesLimite.toISOString().slice(0, 10),
    siguiente: aniversario(ingreso, anio + 1),
  };
}
export function festivosMexico(anio) {
  const lunes = (mes, numero) => {
    const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
    return `${anio}-${String(mes).padStart(2, "0")}-${String(1 + ((8 - primero) % 7) + 7 * (numero - 1)).padStart(2, "0")}`;
  };
  const lista = [
    [`${anio}-01-01`, "Año Nuevo"],
    [lunes(2, 1), "Conmemoración del 5 de febrero"],
    [lunes(3, 3), "Conmemoración del 21 de marzo"],
    [`${anio}-05-01`, "Día del Trabajo"],
    [`${anio}-09-16`, "Independencia de México"],
    [lunes(11, 3), "Conmemoración del 20 de noviembre"],
    [`${anio}-12-25`, "Navidad"],
  ];
  if ((anio - 2024) % 6 === 0)
    lista.push([`${anio}-10-01`, "Transmisión del Poder Ejecutivo Federal"]);
  return Object.fromEntries(lista);
}
export function motivoDescanso(fecha, adicionales = []) {
  if (new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0) return "Domingo";
  return (
    festivosMexico(Number(fecha.slice(0, 4)))[fecha] ||
    (adicionales.includes(fecha) ? "Descanso configurado" : "")
  );
}
export function calcularSalida(inicio, dias, adicionales = []) {
  if (!fechaValida(inicio) || !Number.isInteger(dias) || dias < 1 || dias > 366)
    throw Error("Indica una salida válida y entre 1 y 366 días laborables.");
  if (motivoDescanso(inicio, adicionales))
    throw Error(
      "Selecciona como salida el primer día laborable de vacaciones.",
    );
  let fecha = inicio,
    contados = 0;
  const descansos = [];
  while (contados < dias) {
    const motivo = motivoDescanso(fecha, adicionales);
    if (motivo) descansos.push({ fecha, motivo });
    else contados++;
    if (contados < dias) fecha = sumarDias(fecha, 1);
  }
  const fin = fecha;
  fecha = sumarDias(fecha, 1);
  while (motivoDescanso(fecha, adicionales)) {
    descansos.push({ fecha, motivo: motivoDescanso(fecha, adicionales) });
    fecha = sumarDias(fecha, 1);
  }
  return { inicio, fin, regreso: fecha, dias, descansos };
}
export function esPersonalVacaciones(e) {
  return (
    e.estatus !== "Baja" &&
    e.vacaciones_excluir !== true &&
    !/^prueba$/i.test(e.nombre_completo.trim())
  );
}
export function vacacionesDelMes(empleados, mes, empresa = "") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return [];
  const inicio = `${mes}-01`,
    fin = sumarDias(
      `${Number(mes.slice(0, 4)) + (mes.endsWith("-12") ? 1 : 0)}-${String((Number(mes.slice(5)) % 12) + 1).padStart(2, "0")}-01`,
      -1,
    );
  return empleados
    .flatMap((e) =>
      (!empresa || e.empresa_codigo === empresa) && esPersonalVacaciones(e)
        ? (e.vacaciones?.registros || [])
            .filter(
              (v) =>
                v.estado !== "Cancelada" &&
                v.inicio <= fin &&
                v.regreso >= inicio,
            )
            .map((v) => ({ ...v, empleado: e }))
        : [],
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
export function guardarVacaciones(state, form, responsable, now = new Date()) {
  const e = state.employees.find((e) => e.id_empleado === form.empleadoId);
  if (!e || !esPersonalVacaciones(e))
    throw Error("Selecciona un trabajador activo.");
  if (!responsable || !form.motivo?.trim())
    throw Error("Indica responsable y motivo.");
  if (!form.confirmado)
    throw Error(
      "Confirma la antigüedad, la relación continua y los días previamente usados.",
    );
  const ingreso = normalizeDate(e.fecha_ingreso || "");
  const anio = Number(form.anio);
  if (
    !fechaValida(ingreso) ||
    !Number.isInteger(anio) ||
    anio < 2023 ||
    anio > Number(calendarDate(now).slice(0, 4))
  )
    throw Error(
      "Revisa la fecha de ingreso y el año del aniversario (desde 2023).",
    );
  const desde = aniversario(ingreso, anio);
  if (desde > calendarDate(now) || desde > form.inicio)
    throw Error(
      "El aniversario debe haberse cumplido antes de la salida y de hoy.",
    );
  const derecho = diasPorAntiguedad(anio - Number(ingreso.slice(0, 4)));
  const previos = Number(form.previos);
  if (
    form.previos === "" ||
    !Number.isInteger(previos) ||
    previos < 0 ||
    previos > derecho
  )
    throw Error(
      "Indica los días ya utilizados fuera de este apartado para ese aniversario.",
    );
  const v = e.vacaciones || {},
    registros = v.registros || [];
  const anterior = form.id ? registros.find((r) => r.id === form.id) : null;
  if (form.id && (!anterior || anterior.estado === "Cancelada"))
    throw Error("El registro ya no se puede modificar.");
  const salida = calcularSalida(
    form.inicio,
    Number(form.dias),
    state.holidays || [],
  );
  const otros = registros.filter(
    (r) => r.id !== form.id && r.estado !== "Cancelada",
  );
  if (otros.some((r) => r.inicio < salida.regreso && r.regreso > salida.inicio))
    throw Error("Este período se cruza con vacaciones ya programadas.");
  const usados = otros
    .filter((r) => r.anio === anio)
    .reduce((s, r) => s + r.dias, 0);
  if (previos + usados + salida.dias > derecho)
    throw Error(
      `El período supera los ${derecho} días de ese aniversario: ${previos + usados} ya utilizados o programados.`,
    );
  const registro = {
    ...salida,
    id: anterior?.id || crypto.randomUUID(),
    anio,
    empresa: e.empresa_codigo,
    estado: "Programada",
    por: responsable,
    motivo: form.motivo.trim(),
    actualizado: now.toISOString(),
    ingresoReconocido: ingreso,
    derecho,
    previosConfirmados: previos,
  };
  return actualizar(
    state,
    e,
    {
      ...v,
      usadosPrevios: { ...v.usadosPrevios, [anio]: previos },
      registros: anterior
        ? registros.map((r) => (r.id === anterior.id ? registro : r))
        : [...registros, registro],
    },
    { anterior: anterior || null, siguiente: registro },
    responsable,
    form.motivo,
    now,
  );
}
function actualizar(state, e, vacaciones, detalle, responsable, motivo, now) {
  return {
    ...state,
    employees: state.employees.map((x) =>
      x.id_empleado === e.id_empleado ? { ...x, vacaciones } : x,
    ),
    audit: [
      {
        id: crypto.randomUUID(),
        action: "Vacaciones",
        company: e.empresa_codigo,
        employeeId: e.id_empleado,
        by: responsable,
        when: now.toISOString(),
        motivo: motivo.trim(),
        ...detalle,
      },
      ...(state.audit || []),
    ],
  };
}
export function cancelarVacaciones(
  state,
  empleadoId,
  id,
  motivo,
  responsable,
  now = new Date(),
) {
  const e = state.employees.find((e) => e.id_empleado === empleadoId);
  const anterior = e?.vacaciones?.registros?.find((r) => r.id === id);
  if (
    !anterior ||
    anterior.estado === "Cancelada" ||
    !motivo?.trim() ||
    !responsable
  )
    throw Error(
      "Selecciona un período vigente e indica el motivo y responsable de la cancelación.",
    );
  const siguiente = {
    ...anterior,
    estado: "Cancelada",
    canceladaEn: now.toISOString(),
    canceladaPor: responsable,
    motivoCancelacion: motivo.trim(),
  };
  return actualizar(
    state,
    e,
    {
      ...e.vacaciones,
      registros: e.vacaciones.registros.map((r) =>
        r.id === id ? siguiente : r,
      ),
    },
    { anterior, siguiente },
    responsable,
    motivo,
    now,
  );
}

export function estaDeVacaciones(empleado, fecha) {
  return (empleado.vacaciones?.registros || []).some(
    (v) => v.estado !== "Cancelada" && v.inicio <= fecha && v.regreso > fecha,
  );
}
