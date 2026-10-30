import { companyNames } from "../datos/constantes.js";

export const MESES_NOMINA = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export const normalizarNomina = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
export const sumarConceptos = (lista) =>
  lista.filter((c) => !c.informativo).reduce((s, c) => s + c.importe, 0);
export function centavos(texto) {
  const s = String(texto).trim().replace(/,/g, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(s))
    throw Error("Importe de nómina ilegible.");
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e11)
    throw Error("Importe de nómina fuera de rango.");
  return n;
}
export function validarRecibo(r) {
  if (
    !r ||
    typeof r.clave !== "string" ||
    !r.clave ||
    r.clave.length > 80 ||
    typeof r.nombre !== "string" ||
    !r.nombre.trim() ||
    r.nombre.length > 200 ||
    typeof r.codigo !== "string" ||
    r.codigo.length > 20
  )
    throw Error("El trabajador de la nómina no es válido.");
  if (
    !Number.isSafeInteger(r.salarioDiario) ||
    r.salarioDiario < 0 ||
    r.salarioDiario > 1e11 ||
    !Number.isFinite(r.diasPagados) ||
    r.diasPagados < 0 ||
    r.diasPagados > 31
  )
    throw Error("Salario o días pagados inválidos.");
  for (const campo of ["percepciones", "deducciones"]) {
    if (!Array.isArray(r[campo]) || r[campo].length > 80)
      throw Error("Desglose de nómina inválido.");
    const claves = new Set();
    for (const c of r[campo]) {
      if (
        typeof c.codigo !== "string" ||
        !/^\d{1,5}$/.test(c.codigo) ||
        typeof c.concepto !== "string" ||
        !c.concepto.trim() ||
        c.concepto.length > 200 ||
        !Number.isSafeInteger(c.importe) ||
        Math.abs(c.importe) > 1e11 ||
        typeof c.informativo !== "boolean" ||
        !(c.valor === null || Number.isFinite(c.valor))
      )
        throw Error("Concepto de nómina inválido.");
      if (claves.has(c.codigo))
        throw Error("Hay conceptos repetidos en la nómina.");
      claves.add(c.codigo);
    }
  }
  for (const campo of ["totalPercepciones", "totalDeducciones", "neto"])
    if (!Number.isSafeInteger(r[campo]) || Math.abs(r[campo]) > 1e11)
      throw Error("Total de nómina inválido.");
  if (
    sumarConceptos(r.percepciones) !== r.totalPercepciones ||
    sumarConceptos(r.deducciones) !== r.totalDeducciones ||
    r.totalPercepciones - r.totalDeducciones !== r.neto
  )
    throw Error(
      `Los conceptos y totales no coinciden para ${r.nombre}. No se guardó el archivo.`,
    );
  return r;
}
export function recibosNomina(periodo) {
  let registros;
  try {
    registros = JSON.parse(periodo.registrosJson);
  } catch {
    throw Error("La nómina guardada no tiene un desglose válido.");
  }
  if (!Array.isArray(registros) || !registros.length || registros.length > 200)
    throw Error("Cantidad de trabajadores de nómina inválida.");
  registros.forEach(validarRecibo);
  if (new Set(registros.map((r) => r.clave)).size !== registros.length)
    throw Error("Trabajadores duplicados en la nómina.");
  return registros;
}
export function validarPeriodoNomina(p) {
  if (
    !Object.hasOwn(companyNames, p.empresa_codigo) ||
    typeof p.empresa_nombre !== "string" ||
    !p.empresa_nombre ||
    p.empresa_nombre.length > 200
  )
    throw Error("No se pudo identificar una de las tres empresas.");
  for (const fecha of [p.desde, p.hasta]) {
    if (
      typeof fecha !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !Number.isFinite(Date.parse(fecha)) ||
      new Date(fecha + "T12:00:00Z").toISOString().slice(0, 10) !== fecha
    )
      throw Error("Período de nómina inválido.");
  }
  if (
    p.desde > p.hasta ||
    p.desde.slice(0, 7) !== p.hasta.slice(0, 7) ||
    p.anio !== Number(p.desde.slice(0, 4)) ||
    p.mes !== Number(p.desde.slice(5, 7)) ||
    p.anio < 2000 ||
    p.anio > 2100
  )
    throw Error("El PDF debe contener un solo período dentro del mismo mes.");
  if (
    p.id !== `${p.empresa_codigo}_${p.desde}_${p.hasta}` ||
    typeof p.archivo !== "string" ||
    !p.archivo ||
    p.archivo.length > 200 ||
    typeof p.huella !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.huella) ||
    typeof p.registrosJson !== "string" ||
    new TextEncoder().encode(p.registrosJson).length > 240000
  )
    throw Error("Archivo o contenido de nómina inválido.");
  if (
    !Number.isInteger(p.numeroPeriodo) ||
    p.numeroPeriodo < 0 ||
    p.numeroPeriodo > 366
  )
    throw Error("Número de período inválido.");
  recibosNomina(p);
  return p;
}
export function responsableDeNomina(responsable = "MARIA") {
  if (
    typeof responsable !== "string" ||
    !responsable ||
    responsable.length > 40 ||
    responsable.includes("/")
  )
    throw Error("No se identificó quién modifica la nómina.");
  return responsable;
}
export function afirmarSoloNomina(antes, despues) {
  const claves = new Set([
    ...Object.keys(antes || {}),
    ...Object.keys(despues || {}),
  ]);
  for (const clave of claves) {
    if (clave === "payroll" || clave === "audit") continue;
    if (
      JSON.stringify(antes?.[clave] ?? null) !==
      JSON.stringify(despues?.[clave] ?? null)
    )
      throw Error("La nómina no puede modificar otras secciones.");
  }
  return despues;
}
export function guardarNomina(
  state,
  entrada,
  { reemplazar = false, now = new Date(), responsable = "MARIA" } = {},
) {
  const autor = responsableDeNomina(responsable);
  validarPeriodoNomina(entrada);
  const lista = state.payroll || [];
  const previo = lista.find((p) => p.id === entrada.id);
  if (
    previo &&
    !reemplazar &&
    (previo.huella === entrada.huella ||
      previo.registrosJson === entrada.registrosJson)
  )
    return state;
  if (previo && !reemplazar)
    throw Error(
      "Ese período ya está cargado. Usa Modificar un mes → Volver a subir archivo para corregirlo.",
    );
  if (
    lista.some(
      (p) =>
        p.id !== entrada.id &&
        p.empresa_codigo === entrada.empresa_codigo &&
        p.desde <= entrada.hasta &&
        p.hasta >= entrada.desde,
    )
  )
    throw Error(
      "El período se cruza con otra nómina cargada. Se conservan los datos anteriores.",
    );
  if (reemplazar && !previo)
    throw Error(
      "El PDF no corresponde a un período cargado. Usa Subir archivo de nómina para agregarlo.",
    );
  if (
    previo &&
    previo.registrosJson === entrada.registrosJson &&
    previo.huella === entrada.huella
  )
    return state;
  const siguiente = {
    ...entrada,
    revision: (previo?.revision || 0) + 1,
    creadoEn: previo?.creadoEn || now.toISOString(),
    creadoMs: previo?.creadoMs || now.getTime(),
    actualizadoMs: now.getTime(),
    actualizadoEn: now.toISOString(),
    actualizadoPor: autor,
  };
  return {
    ...state,
    payroll: [...lista.filter((p) => p.id !== siguiente.id), siguiente],
    audit: [
      {
        id: crypto.randomUUID(),
        action: previo ? "Nómina corregida" : "Nómina importada",
        company: siguiente.empresa_codigo,
        by: autor,
        when: now.toISOString(),
        periodo: siguiente.id,
        anterior: previo || null,
        revision: siguiente.revision,
      },
      ...(state.audit || []),
    ],
  };
}
export function modificarReciboNomina(
  state,
  periodoId,
  clave,
  cambios,
  motivo,
  now = new Date(),
  responsable = "MARIA",
) {
  const previo = (state.payroll || []).find((p) => p.id === periodoId);
  if (!previo) throw Error("Selecciona una nómina cargada.");
  if (
    typeof motivo !== "string" ||
    motivo.trim().length < 3 ||
    motivo.length > 500
  )
    throw Error("Indica el motivo de la corrección.");
  let encontrado = false;
  const registros = recibosNomina(previo).map((r) => {
    if (r.clave !== clave) return r;
    encontrado = true;
    const nuevo = {
      ...r,
      salarioDiario: cambios.salarioDiario,
      diasPagados: cambios.diasPagados,
      percepciones: cambios.percepciones,
      deducciones: cambios.deducciones,
    };
    for (const campo of ["percepciones", "deducciones"])
      if (
        nuevo[campo].length !== r[campo].length ||
        nuevo[campo].some(
          (c, i) =>
            c.codigo !== r[campo][i].codigo ||
            c.concepto !== r[campo][i].concepto ||
            c.informativo !== r[campo][i].informativo,
        )
      )
        throw Error("La corrección conserva los conceptos originales del PDF.");
    nuevo.totalPercepciones = sumarConceptos(nuevo.percepciones);
    nuevo.totalDeducciones = sumarConceptos(nuevo.deducciones);
    nuevo.neto = nuevo.totalPercepciones - nuevo.totalDeducciones;
    return validarRecibo(nuevo);
  });
  if (!encontrado) throw Error("El trabajador no pertenece al período.");
  const next = guardarNomina(
    state,
    { ...previo, registrosJson: JSON.stringify(registros) },
    { reemplazar: true, now, responsable },
  );
  if (next !== state) next.audit[0].motivo = motivo.trim();
  return next;
}
export function seleccionarNominas(state, empresa, anio) {
  return (state.payroll || [])
    .filter((p) => p.empresa_codigo === empresa && p.anio === Number(anio))
    .sort((a, b) => a.desde.localeCompare(b.desde));
}
