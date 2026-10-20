import { companyNames } from "../datos/constantes.js";
import { calendarDate } from "../utilidades/fechas.js";

export function fichaEmpresa(state, codigo) {
  return (
    (state.companies || []).find((e) => e.codigo === codigo) || {
      codigo,
      razonSocial: companyNames[codigo] || codigo,
      rfc: "",
      regimenFiscal: "",
      giro: "",
      estatus: "Activa",
      fechaVigencia: "",
    }
  );
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
    codigo: form.codigo,
    razonSocial: String(form.razonSocial || "").trim(),
    rfc: String(form.rfc || "")
      .trim()
      .toUpperCase(),
    regimenFiscal: String(form.regimenFiscal || "").trim(),
    giro: String(form.giro || "").trim(),
    estatus: form.estatus,
    fechaVigencia: String(form.fechaVigencia || ""),
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
    !/^\d{4}-\d{2}-\d{2}$/.test(ficha.fechaVigencia) ||
    calendarDate(new Date(ficha.fechaVigencia + "T12:00:00Z")) !==
      ficha.fechaVigencia
  )
    throw Error("Indica una fecha de vigencia válida.");
  if (ficha.fechaVigencia > calendarDate(now))
    throw Error(
      "Guarda el cambio a partir de su fecha de vigencia; todavía no se aplican cambios futuros.",
    );
  if (ficha.regimenFiscal.length > 200 || ficha.giro.length > 200)
    throw Error("Régimen y giro admiten hasta 200 caracteres.");
  const motivo = String(form.motivo || "").trim();
  if (!motivo || motivo.length > 500)
    throw Error("Indica el motivo del cambio (hasta 500 caracteres).");
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
        motivo,
        anterior,
        siguiente: ficha,
      },
      ...(state.audit || []),
    ],
  };
}
