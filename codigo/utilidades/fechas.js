export const ZONA_HORARIA = "America/Mexico_City";
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fechaEnMexico(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
// Un día YYYY-MM-DD o un datetime sin zona conservan la fecha escrita.
// Un instante con zona (el ISO que guarda la app) se traduce a Ciudad de México.
export function calendarDate(value = "") {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "" : fechaEnMexico(value);
  const text = String(value || "");
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(text);
  if (!hasZone) {
    const wall = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (wall) return wall[1];
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : fechaEnMexico(date);
}
export function normalizeDate(value = "") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : "";
}
export const formatDateTime = (value) =>
  new Date(value).toLocaleString("es-MX", { timeZone: ZONA_HORARIA });
export const isSameDay = (value, date = new Date()) =>
  calendarDate(value) === calendarDate(date);
