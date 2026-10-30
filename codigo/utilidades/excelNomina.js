import ExcelJS from "exceljs";
import {
  MESES_NOMINA,
  recibosNomina,
  seleccionarNominas,
} from "../dominio/nomina.js";
import { companyNames } from "../datos/constantes.js";
const moneda = '"$"#,##0.00;[Red]-"$"#,##0.00';
function nombreHoja(nombre, usados) {
  const base =
    nombre
      .replace(/[\\/*?:[\]]/g, " ")
      .replace(/^'+|'+$/g, "")
      .trim() || "Trabajador";
  let texto = base.slice(0, 31),
    n = 2;
  while (usados.has(texto.toLowerCase())) {
    const sufijo = ` (${n++})`;
    texto = base.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados.add(texto.toLowerCase());
  return texto;
}
export function crearLibroNomina(state, empresa, anio, tipo) {
  if (!["mensual", "anual"].includes(tipo))
    throw Error("Selecciona una exportación de nómina.");
  const periodos = seleccionarNominas(state, empresa, anio);
  if (!periodos.length)
    throw Error(
      "No hay nóminas cargadas de esa empresa en el año seleccionado.",
    );
  const filas = periodos.flatMap((p) =>
    recibosNomina(p).map((r) => ({
      ...r,
      desde: p.desde,
      hasta: p.hasta,
      mes: p.mes,
    })),
  );
  const libro = new ExcelJS.Workbook();
  libro.creator = "Rey Pez";
  libro.calcProperties.fullCalcOnLoad = true;
  const usados = new Set();
  const grupos = new Map();
  for (const fila of filas) {
    const key = tipo === "mensual" ? fila.mes : fila.clave;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(fila);
  }
  const entradas = [...grupos.entries()].sort((a, b) =>
    tipo === "mensual"
      ? a[0] - b[0]
      : a[1][0].nombre.localeCompare(b[1][0].nombre, "es"),
  );
  for (const [grupo, registros] of entradas) {
    const titulo =
      tipo === "mensual" ? MESES_NOMINA[grupo - 1] : registros[0].nombre;
    const hoja = libro.addWorksheet(nombreHoja(titulo, usados), {
      views: [{ state: "frozen", ySplit: 3 }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 1,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    const encabezado = hoja.addRow([companyNames[empresa]]);
    encabezado.font = { bold: true, size: 14, color: { argb: "FF173957" } };
    hoja.addRow([
      `${anio} · ${tipo === "mensual" ? titulo : "Historial anual por trabajador"}`,
    ]);
    hoja.addRow([
      "Importes en MXN. Conceptos informativos conservados; no se suman al descuento.",
    ]);
    const porTrabajador = new Map();
    for (const r of registros) {
      if (!porTrabajador.has(r.clave)) porTrabajador.set(r.clave, []);
      porTrabajador.get(r.clave).push(r);
    }
    let maxCols = 6;
    for (const lista of [...porTrabajador.values()].sort((a, b) =>
      a[0].nombre.localeCompare(b[0].nombre, "es"),
    )) {
      hoja.addRow([]);
      const nombre = hoja.addRow([lista[0].nombre]);
      nombre.font = { bold: true, color: { argb: "FF173957" } };
      const conceptos = new Map();
      for (const r of lista)
        for (const campo of ["percepciones", "deducciones"])
          for (const c of r[campo]) {
            const key = `${campo}:${c.codigo}:${c.informativo}`;
            if (!conceptos.has(key)) conceptos.set(key, { ...c, campo, key });
          }
      const columnas = [...conceptos.values()];
      const labels = [
        "Desde",
        "Hasta",
        "Salario diario",
        "Días pagados",
        ...columnas.map(
          (c) =>
            `${c.campo === "percepciones" ? "P" : "D"} ${c.codigo} · ${c.concepto}${c.informativo ? " (informativo)" : ""}`,
        ),
        "Total percepciones",
        "Total deducciones",
        "Neto a pagar",
      ];
      const head = hoja.addRow(labels);
      head.height = 60;
      head.eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF173957" },
        };
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.alignment = { vertical: "middle", wrapText: true };
      });
      maxCols = Math.max(maxCols, labels.length);
      const principio = hoja.rowCount + 1;
      const sumas = Array(labels.length).fill(0);
      for (const r of lista.sort((a, b) => a.desde.localeCompare(b.desde))) {
        const amounts = columnas.map(
          (c) =>
            r[c.campo].find(
              (item) =>
                item.codigo === c.codigo && item.informativo === c.informativo,
            )?.importe || 0,
        );
        const valores = [
          r.desde,
          r.hasta,
          r.salarioDiario / 100,
          r.diasPagados,
          ...amounts.map((n) => n / 100),
          r.totalPercepciones / 100,
          r.totalDeducciones / 100,
          r.neto / 100,
        ];
        const row = hoja.addRow(valores);
        row.eachCell((c, i) => {
          if (i >= 3 && i !== 4) c.numFmt = moneda;
          if (i >= 3) c.alignment = { horizontal: "right" };
        });
        valores.forEach((v, i) => {
          if (typeof v === "number") sumas[i] += v;
        });
      }
      const fin = hoja.rowCount,
        total = hoja.addRow(["Total acumulado"]);
      total.font = { bold: true };
      for (let i = 4; i <= labels.length; i++) {
        const cell = total.getCell(i);
        const letter = hoja.getColumn(i).letter;
        cell.value = {
          formula: `SUM(${letter}${principio}:${letter}${fin})`,
          result: Math.round(sumas[i - 1] * 100) / 100,
        };
        if (i !== 4) cell.numFmt = moneda;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F1FB" },
        };
      }
    }
    for (let i = 1; i <= maxCols; i++)
      hoja.getColumn(i).width = i <= 2 ? 14 : i <= 4 ? 16 : 22;
    hoja.getColumn(1).width = 24;
    hoja.headerFooter.oddFooter = "Rey Pez · Página &P de &N";
  }
  return libro;
}
export async function descargarExcelNomina(state, empresa, anio, tipo) {
  const libro = crearLibroNomina(state, empresa, anio, tipo);
  const bytes = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `Nomina_${empresa}_${anio}_${tipo}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
