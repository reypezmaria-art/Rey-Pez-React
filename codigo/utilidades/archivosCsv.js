import { companyNames } from "../datos/constantes.js";

export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i],
      next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw Error("El CSV contiene comillas sin cerrar.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((h) => h.trim());
  if (new Set(headers).size !== headers.length)
    throw Error("El CSV contiene columnas duplicadas.");
  return rows.map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, (values[i] || "").trim()])),
  );
}
export function mergeEmployees(state, incoming) {
  if (!incoming.length) throw Error("El archivo no contiene filas.");
  const employees = [...state.employees];
  for (const [index, row] of incoming.entries()) {
    const employee = {
      ...row,
      empresa_codigo: (row.empresa_codigo || "").toUpperCase(),
      nombre_completo: (row.nombre_completo || "").trim(),
      id_empleado: (row.id_empleado || "").toUpperCase(),
    };
    if (!employee.nombre_completo || !companyNames[employee.empresa_codigo])
      throw Error(
        `Fila ${index + 2}: se requieren nombre_completo y empresa_codigo válido (ALLAN, EDGAR o ESTUARDO).`,
      );
    const match = employees.findIndex(
      (e) =>
        e.empresa_codigo === employee.empresa_codigo &&
        e.nombre_completo.toLowerCase() ===
          employee.nombre_completo.toLowerCase(),
    );
    // Un ID vacío no borra la identidad existente durante una importación.
    if (match >= 0 && !employee.id_empleado)
      employee.id_empleado = employees[match].id_empleado;
    if (
      employee.id_empleado &&
      employees.some(
        (e, i) => i !== match && e.id_empleado === employee.id_empleado,
      )
    )
      throw Error(`Fila ${index + 2}: ID duplicado ${employee.id_empleado}.`);
    if (
      match >= 0 &&
      employees[match].id_empleado &&
      employee.id_empleado !== employees[match].id_empleado
    )
      throw Error(
        `Fila ${index + 2}: cambia el ID desde Modificar para conservar el historial.`,
      );
    employee.empresa_nombre = companyNames[employee.empresa_codigo];
    if (match >= 0) employees[match] = { ...employees[match], ...employee };
    else employees.push({ estatus: "Activo", puesto: "", ...employee });
  }
  return { ...state, employees };
}
export function toCSV(data) {
  if (!data.length) throw Error("No hay datos para exportar.");
  const columns = [...new Set(data.flatMap(Object.keys))];
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(cell).join(","),
    ...data.map((row) => columns.map((column) => cell(row[column])).join(",")),
  ].join("\r\n");
}
