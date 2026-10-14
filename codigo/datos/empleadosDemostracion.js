import { companyNames } from "./constantes.js";
// Catálogo ficticio para clones de GitHub; el archivo local conserva los 30 originales.
export const demoEmployees = Object.entries(companyNames).flatMap(
  ([company, name], group) =>
    Array.from({ length: [9, 14, 7][group] }, (_, index) => ({
      id_empleado: `${["AL", "ED", "ES"][group]}-${String(index + 1).padStart(2, "0")}`,
      nombre_completo: `EMPLEADO DEMO ${company} ${index + 1}`,
      empresa_codigo: company,
      empresa_nombre: name,
      puesto: "EMPLEADO GENERAL",
      tipo_puesto: "General",
      codigo_horario: "",
      estatus: "Activo",
      fecha_ingreso: "",
      observaciones: "",
    })),
);
