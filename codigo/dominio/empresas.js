import { companyNames } from "../datos/constantes.js";
import { calendarDate } from "../utilidades/fechas.js";

export function fichaEmpresa(state, codigo) {
  const guardada = (state.companies || []).find((e) => e.codigo === codigo);
  return {
    codigo,
    razonSocial: companyNames[codigo] || codigo,
    rfc: "",
    regimenFiscal: "",
    giro: "",
    estatus: "Activa",
    activaDesde: "",
    ...guardada,
  };
}

export function nombresEmpresas(state) {
  return Object.fromEntries(
    Object.entries(companyNames).map(([codigo, nombre]) => [
      codigo,
      state.companyDirectory?.[codigo]?.nombre ||
        (state.companies || []).find((e) => e.codigo === codigo)?.razonSocial ||
        nombre,
    ]),
  );
}
export function guardarEmpresa(state, form, now = new Date()) {
  if (!Object.hasOwn(companyNames, form.codigo))
    throw Error("Selecciona una empresa registrada.");
  const anterior = fichaEmpresa(state, form.codigo);
  const ficha = {
    ...anterior,
    codigo: form.codigo,
    razonSocial: String(form.razonSocial || "").trim(),
    rfc: String(form.rfc || "")
      .trim()
      .toUpperCase(),
    regimenFiscal: String(form.regimenFiscal || "").trim(),
    giro: String(form.giro || "").trim(),
    estatus: form.estatus,
    activaDesde: String(form.activaDesde || ""),
    actualizadoPor: "MARIA",
    actualizadoEn: now.toISOString(),
  };
  if (!ficha.razonSocial || ficha.razonSocial.length > 200)
    throw Error("Indica una razón social de hasta 200 caracteres.");
  if (ficha.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(ficha.rfc))
    throw Error(
      "El RFC debe tener 12 o 13 caracteres y el formato correspondiente.",
    );
  if (!["Activa", "Baja"].includes(ficha.estatus))
    throw Error("Selecciona el estado de la empresa.");
  if (
    ficha.activaDesde &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(ficha.activaDesde) ||
      calendarDate(new Date(ficha.activaDesde + "T12:00:00Z")) !==
        ficha.activaDesde)
  )
    throw Error("Indica una fecha válida en Activa desde.");
  if (ficha.activaDesde > calendarDate(now))
    throw Error("La fecha Activa desde no puede ser futura.");
  if (ficha.regimenFiscal.length > 200 || ficha.giro.length > 200)
    throw Error("Régimen y giro admiten hasta 200 caracteres.");
  return {
    ...state,
    companies: [
      ...(state.companies || []).filter((e) => e.codigo !== ficha.codigo),
      ficha,
    ],
    companyDirectory: {
      ...state.companyDirectory,
      [ficha.codigo]: { nombre: ficha.razonSocial, estatus: ficha.estatus },
    },
    audit: [
      {
        id: crypto.randomUUID(),
        action: "Datos de empresa actualizados",
        company: ficha.codigo,
        by: "MARIA",
        when: now.toISOString(),
        motivo: "Actualización de datos de empresa",
        anterior,
        siguiente: ficha,
      },
      ...(state.audit || []),
    ],
  };
}
