import { jsPDF } from "jspdf";
import { companyNames } from "../../codigo/datos/constantes.js";
export function pdfNominaEjemplo({
  empresa = "ALLAN",
  desde = "01/Ene/2026",
  hasta = "15/Ene/2026",
  importe = 525000,
  nombre = "PERSONA DEMO UNO",
  codigo = "001",
  nss,
  rfc,
  infonavitCf = 0,
  continuar = false,
  sinIsrRetenido = false,
  calculoInformativo = false,
} = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFontSize(9);
  const text = (s, x, y) => doc.text(String(s), x, y);
  text(
    companyNames[empresa]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase(),
    160,
    25,
  );
  text(`Lista de Raya del ${desde} al ${hasta}`, 160, 40);
  text("Periodo Quincenal No. 1", 180, 55);
  text(`${codigo} ${nombre}`, 25, 90);
  if (rfc) text(`RFC: ${rfc}`, 350, 120);
  text("Sal. diario: 350.00", 150, 105);
  text("Dias pagados: 15.00", 25, 120);
  if (nss) text(`Afiliacion IMSS: ${nss}`, 350, 105);
  const money = (n) => (n / 100).toFixed(2);
  text("1 Sueldo", 25, 140);
  text("15.00", 210, 140);
  text(money(importe), 270, 140);
  [
    ["32 Subs al Empleo acreditado", -20000],
    ["41 I.S.R. antes de Subs al Empleo", 30000],
    ...(!sinIsrRetenido && !calculoInformativo
      ? [["45 I.S.R. (mes)", 10000]]
      : []),
    ["52 I.M.S.S.", 12000],
    ["99 Ajuste al neto", -10],
    ...(infonavitCf
      ? [
          ["16 Prestamo infonavit (CF)", infonavitCf],
          ["180 Infonavit CF correspondiente", infonavitCf],
        ]
      : []),
  ].forEach(([label, value], i) => {
    text(label, 345, 140 + i * 14);
    text(money(value), 555, 140 + i * 14);
  });
  if (continuar) {
    doc.addPage();
    text("RFC: PATR-010101-AAA", 25, 25);
  }
  const y = infonavitCf ? 250 : 230;
  text("Total Percepciones", 25, y);
  text(money(importe), 270, y);
  text("Total Deducciones", 345, y);
  const totalDeducciones =
    21990 + infonavitCf - (calculoInformativo ? 10000 : 0);
  text(money(totalDeducciones), 555, y);
  text("Neto a pagar", 25, y + 14);
  text(money(importe - totalDeducciones), 270, y + 14);
  text("Total de empleados : 1", 25, y + 40);
  return new Uint8Array(doc.output("arraybuffer"));
}
export function entradaNominaEjemplo({
  empresa = "ALLAN",
  mes = 1,
  segunda = false,
  clave = "COD:001",
  nombre = "PERSONA DEMO UNO",
} = {}) {
  const desde = `2026-${String(mes).padStart(2, "0")}-${segunda ? "16" : "01"}`;
  const ultimo = new Date(Date.UTC(2026, mes, 0)).getUTCDate();
  const hasta = `2026-${String(mes).padStart(2, "0")}-${segunda ? ultimo : "15"}`;
  const r = {
    clave,
    codigo: "001",
    nombre,
    salarioDiario: 35000,
    diasPagados: 15,
    percepciones: [
      {
        codigo: "1",
        concepto: "Sueldo",
        valor: 15,
        importe: 525000,
        informativo: false,
      },
    ],
    deducciones: [
      {
        codigo: "52",
        concepto: "IMSS",
        valor: null,
        importe: 12000,
        informativo: false,
      },
    ],
    totalPercepciones: 525000,
    totalDeducciones: 12000,
    neto: 513000,
  };
  return {
    id: `${empresa}_${desde}_${hasta}`,
    empresa_codigo: empresa,
    empresa_nombre: companyNames[empresa],
    desde,
    hasta,
    anio: 2026,
    mes,
    numeroPeriodo: 1,
    archivo: "ejemplo.pdf",
    huella: "a".repeat(64),
    registrosJson: JSON.stringify([r]),
  };
}
