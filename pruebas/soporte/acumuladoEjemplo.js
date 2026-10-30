import ExcelJS from "exceljs";
export async function excelSintetico(nombreEmpresa = "Empresa sintética") {
  const libro = new ExcelJS.Workbook(),
    h = libro.addWorksheet("ACUM X MES");
  h.getCell("A1").value = nombreEmpresa;
  h.getCell("A2").value = "ACUMULADO 2027";
  const cabecera = [
    "NOMBRE",
    "PERIODO",
    "IMSS",
    "R.F.C.",
    "SUELDO",
    "AGUINALDO",
    "PTU",
    "PRIMA ANTIG",
    "VACACIONES",
    "PRIMA VAC",
    "INDEMNIZACION",
    "TOTAL",
    "SUB A",
    "SUB",
    "ANTES",
    "COMPENSAR",
    "ISR",
    "ISPT",
    "IMSS",
    "INFO",
    "PENSION",
    "AJUSTE",
    "SEGURO",
    "NETO",
  ];
  h.getRow(4).values = cabecera;
  for (const [n, nombre, periodo, sueldo] of [
    [5, "Persona uno", "ENE 1-15", 1000],
    [6, "Persona dos", "ENE 16-31", 2000],
    [7, "Persona uno", "FEB 1-15", 1100],
    [8, "Persona uno", "ABRIL 16-31", 1200],
    [9, "Persona uno", "DIC 1-15", 0],
  ]) {
    h.getRow(n).values = [nombre, periodo, "NSS-DEMO", "RFC-DEMO", sueldo];
    h.getCell(`L${n}`).value = { formula: `SUM(E${n}:K${n})`, result: sueldo };
    h.getCell(`S${n}`).value = sueldo ? 10 : 0;
    h.getCell(`X${n}`).value = {
      formula: `L${n}-S${n}`,
      result: sueldo ? sueldo - 10 : 0,
    };
  }
  const resumen = libro.addWorksheet("ACUMULADO 2027");
  resumen.getCell("A1").value = "ACUMULADO";
  resumen.getCell("B2").value = 17;
  return libro.xlsx.writeBuffer();
}
