import { calendarDate } from "../utilidades/fechas.js";

// Citas de obras de dominio público; cada autor enlaza a su fuente.
export const frasesDiarias = [
  {
    texto: "Hoy es siempre todavía.",
    autor: "Antonio Machado",
    fuente:
      "https://cervantesvirtual.com/portales/antonio_machado/obra-visor/poesias-completas-1158024/html/613eab1d-2c06-4d6f-bb4f-453605cb6d5c_2.html",
  },
  {
    texto: "El que lee mucho y anda mucho ve mucho y sabe mucho.",
    autor: "Miguel de Cervantes",
    fuente:
      "https://cvc.cervantes.es/lengua/refranero/ficha.aspx?Lng=0&Par=58663",
  },
  {
    texto: "Ser culto es el único modo de ser libre.",
    autor: "José Martí",
    fuente:
      "https://new.revistacienciasunam.com/index.php/component/content/article/jose-marti-y-la-ciencia-diez-notas-apenas-perceptibles?catid=82",
  },
  {
    texto: "Caminante, no hay camino, se hace camino al andar.",
    autor: "Antonio Machado",
    fuente:
      "https://cervantesvirtual.com/portales/antonio_machado/obra-visor/poesias-completas-1158024/html/613eab1d-2c06-4d6f-bb4f-453605cb6d5c_2.html",
  },
  {
    texto: "No hay libro tan malo que no tenga algo bueno.",
    autor: "Miguel de Cervantes",
    fuente:
      "https://cvc.cervantes.es/literatura/clasicos/quijote/edicion/parte2/cap03/cap03_03.htm",
  },
  {
    texto: "Ser bueno es el único modo de ser dichoso.",
    autor: "José Martí",
    fuente:
      "https://new.revistacienciasunam.com/index.php/component/content/article/jose-marti-y-la-ciencia-diez-notas-apenas-perceptibles?catid=82",
  },
  {
    texto:
      "Demos tiempo al tiempo: para que el vaso rebose hay que llenarlo primero.",
    autor: "Antonio Machado",
    fuente:
      "https://cervantesvirtual.com/portales/antonio_machado/obra-visor/poesias-completas-1158024/html/613eab1d-2c06-4d6f-bb4f-453605cb6d5c_2.html",
  },
];
export function fraseDelDia(fecha = new Date()) {
  const dia = Date.parse(`${calendarDate(fecha)}T00:00:00Z`) / 86400000;
  return frasesDiarias[
    ((dia % frasesDiarias.length) + frasesDiarias.length) % frasesDiarias.length
  ];
}
