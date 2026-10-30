import ExcelJS from "exceljs";
import { companyNames } from "../datos/constantes.js";
import { MESES_NOMINA } from "../dominio/nomina.js";
const normal = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
const valor = (c) => (c.formula ? (c.result ?? null) : c.value);
const texto = (c) => String(valor(c) ?? "").trim();
const meses = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
};
const pesos = '"$"#,##0.00;[Red]-"$"#,##0.00';
export async function extraerAcumuladoNomina(bytes, nombres = companyNames) {
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw Error("El Excel supera 10 MB.");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  const hoja = libro.worksheets.find((s) => normal(s.name) === "ACUMXMES");
  if (!hoja)
    throw Error(
      "No se encontró la hoja ACUM X MES. Selecciona el acumulado original.",
    );
  const cabecera = Array.from({ length: Math.min(10, hoja.rowCount) }, (_, i) =>
    texto(hoja.getCell(i + 1, 1)),
  ).join(" ");
  const candidatas = Object.entries(nombres).filter(([, n]) =>
    normal(cabecera).includes(normal(n)),
  );
  if (candidatas.length !== 1)
    throw Error(
      "No se pudo identificar una sola empresa en el encabezado del archivo.",
    );
  const anios = [...new Set(cabecera.match(/20\d{2}/g) || [])];
  if (anios.length !== 1)
    throw Error("No se identificó un solo año en el encabezado de ACUM X MES.");
  const anio = Number(anios[0]);
  let h = 0;
  for (let r = 1; r <= Math.min(15, hoja.rowCount); r++)
    if (
      normal(texto(hoja.getCell(r, 1))) === "NOMBRE" &&
      normal(texto(hoja.getCell(r, 2))) === "PERIODO"
    )
      h = r;
  if (
    !h ||
    normal(texto(hoja.getCell(h, 5))) !== "SUELDO" ||
    normal(texto(hoja.getCell(h, 24))) !== "NETO"
  )
    throw Error(
      "Las columnas del acumulado no coinciden con el formato admitido. No se importó información.",
    );
  const columnas = Array.from({ length: 24 }, (_, c) =>
    texto(hoja.getCell(h, c + 1)),
  );
  const registros = [],
    advertencias = [];
  for (let r = h + 1; r <= hoja.rowCount; r++) {
    const nombre = texto(hoja.getCell(r, 1)),
      periodo = texto(hoja.getCell(r, 2));
    const mes = meses[normal(periodo).slice(0, 3)];
    if (!nombre || !mes || /TOTAL/i.test(nombre)) continue;
    const importes = Array.from({ length: 20 }, (_, c) => {
      const v = valor(hoja.getCell(r, c + 5));
      if (v === null || v === undefined || v === "" || String(v).trim() === "")
        return null;
      if (typeof v !== "number" || !Number.isFinite(v))
        throw Error(
          `Importe no numérico en ${hoja.name}, fila ${r}. Revisa el archivo antes de importarlo.`,
        );
      return Math.round(v * 100);
    });
    // Las filas de plantilla vacías o con todos los importes en cero no son nóminas cargadas.
    if (!importes.some((v) => v !== null && v !== 0)) continue;
    const dias = periodo.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
    if (
      !dias ||
      Number(dias[1]) < 1 ||
      Number(dias[2]) < Number(dias[1]) ||
      Number(dias[2]) > new Date(anio, mes, 0).getDate()
    )
      advertencias.push(
        `Periodo por revisar: ${periodo} · fila ${r}. Se conservó el texto original.`,
      );
    registros.push({
      nombre,
      periodo,
      mes,
      nss: texto(hoja.getCell(r, 3)),
      rfc: texto(hoja.getCell(r, 4)),
      importes,
      formulas: Array.from(
        { length: 20 },
        (_, c) => hoja.getCell(r, c + 5).formula || null,
      ),
      filaOrigen: r,
    });
  }
  if (!registros.length)
    throw Error("No hay registros con importes en ACUM X MES.");
  const resumen = libro.worksheets.find(
    (s) => normal(s.name) === `ACUMULADO${anio}`,
  );
  const acumulado = [];
  if (resumen)
    resumen.eachRow({ includeEmpty: true }, (row, r) => {
      const celdas = [];
      row.eachCell((cell, c) => {
        const v = valor(cell);
        if (v !== null && v !== undefined)
          celdas.push({
            columna: c,
            valor: typeof v === "object" ? cell.text : v,
            formulaOriginal: cell.formula || null,
          });
      });
      acumulado.push({ fila: r, celdas });
    });
  if (
    libro.worksheets.some(
      (s) =>
        s !== hoja &&
        /20\d{2}/.test(
          Array.from({ length: Math.min(8, s.rowCount) }, (_, i) =>
            texto(s.getCell(i + 1, 1)),
          )
            .join(" ")
            .replace(String(anio), ""),
        ),
    )
  )
    advertencias.push(
      "El archivo contiene hojas de otros ejercicios. Se tomó únicamente ACUM X MES del año identificado.",
    );
  advertencias.push(
    "El sueldo es del periodo; no se ha supuesto un salario diario. El acumulado original conserva sus valores, incluidos datos fiscales manuales y valores de vínculos externos.",
  );
  return {
    empresa: candidatas[0][0],
    anio,
    columnas,
    registros,
    acumulado,
    advertencias,
  };
}

export async function crearExcelAcumulado(entrada, tipo) {
  if (!["mensual", "anual"].includes(tipo))
    throw Error("Selecciona mensual o anual.");
  const libro = new ExcelJS.Workbook();
  libro.creator = "Rey Pez";
  const resumen = libro.addWorksheet(`Acumulado ${entrada.anio}`);
  if (entrada.acumulado.length)
    for (const row of entrada.acumulado)
      for (const c of row.celdas) {
        const cell = resumen.getCell(row.fila, c.columna);
        cell.value = c.valor;
        if (c.formulaOriginal)
          cell.note = `Fórmula original: ${c.formulaOriginal}. Valor importado del archivo; revise sus vínculos antes de modificarlo.`;
      }
  else resumen.addRow(["Sin hoja de acumulado en el archivo original"]);
  resumen.addRow([]);
  for (const texto of entrada.advertencias) resumen.addRow([texto]);
  resumen.getColumn(1).width = 32;
  for (let c = 2; c <= 24; c++) resumen.getColumn(c).width = 20;
  const grupos = new Map(),
    usados = new Set([resumen.name.toLowerCase()]);
  for (const r of entrada.registros) {
    const k = tipo === "mensual" ? r.mes : `${r.nombre}|${r.rfc || r.nss}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  for (const [key, filas] of [...grupos].sort((a, b) =>
    tipo === "mensual"
      ? a[0] - b[0]
      : a[1][0].nombre.localeCompare(b[1][0].nombre, "es"),
  )) {
    const titulo = tipo === "mensual" ? MESES_NOMINA[key - 1] : filas[0].nombre;
    const base =
      titulo
        .replace(/[\\/*?:[\]]/g, " ")
        .replace(/^'+|'+$/g, "")
        .trim() || "Trabajador";
    let nombre = base.slice(0, 31),
      n = 1;
    while (usados.has(nombre.toLowerCase())) {
      const suf = ` (${++n})`;
      nombre = base.slice(0, 31 - suf.length) + suf;
    }
    usados.add(nombre.toLowerCase());
    const hoja = libro.addWorksheet(nombre, {
      views: [{ state: "frozen", ySplit: 3 }],
    });
    hoja.addRow([`${companyNames[entrada.empresa]} · ${entrada.anio}`]);
    hoja.mergeCells("A1:K1");
    hoja.getRow(1).height = 34;
    hoja.getRow(1).font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
    hoja.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF173957" },
    };
    hoja.addRow([`${titulo} · Importes en MXN · Sueldo del periodo`]);
    hoja.mergeCells("A2:K2");
    hoja.getRow(2).height = 30;
    hoja.getRow(2).font = { bold: true, color: { argb: "FF173957" } };
    hoja.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF4E6BD" },
    };
    // Primero la información de consulta habitual; los demás conceptos y las
    // identificaciones permanecen a la derecha, sin eliminar columnas.
    const orden = [
      1, 2, 5, 12, 17, 19, 20, 21, 22, 23, 24, 6, 7, 8, 9, 10, 11, 13, 14, 15,
      16, 18, 3, 4,
    ];
    const destino = (original) => orden.indexOf(original) + 1;
    const letra = (original) => hoja.getColumn(destino(original)).letter;
    const encabezados = orden.map((c) => entrada.columnas[c - 1]);
    encabezados[2] = "SUELDO DEL PERIODO";
    encabezados[3] = "TOTAL PERCEPCIONES";
    encabezados[5] = "IMSS (DEDUCCIÓN)";
    const h = hoja.addRow(encabezados);
    h.height = 48;
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF173957" },
      };
      c.alignment = { wrapText: true, vertical: "middle" };
    });
    for (const r of filas.sort((a, b) =>
      tipo === "mensual"
        ? a.nombre.localeCompare(b.nombre, "es") || a.filaOrigen - b.filaOrigen
        : a.mes - b.mes || a.filaOrigen - b.filaOrigen,
    )) {
      const originales = [
        r.nombre,
        r.periodo,
        r.nss,
        r.rfc,
        ...r.importes.map((v) => (v === null ? null : v / 100)),
      ];
      const row = hoja.addRow(orden.map((c) => originales[c - 1]));
      row.height = 28;
      row.getCell(1).note = `Fuente: ACUM X MES, fila ${r.filaOrigen}.`;
      for (let original = 5; original <= 24; original++) {
        const cell = row.getCell(destino(original)),
          f = r.formulas?.[original - 5];
        cell.numFmt = pesos;
        if (!f) continue;
        const refs = [...f.matchAll(/\$?([A-Z]{1,3})\$?(\d+)/g)];
        const locales =
          !/[![\]]/.test(f) &&
          refs.length &&
          refs.every(
            (m) =>
              Number(m[2]) === r.filaOrigen &&
              m[1].length === 1 &&
              m[1] >= "E" &&
              m[1] <= "X",
          );
        if (locales) {
          // Al reordenar columnas, un rango de origen puede dejar de ser
          // contiguo. SUM recibe las celdas explícitas del rango original.
          const expandida = f.replace(
            /SUM\(\$?([E-X])\$?\d+:\$?([E-X])\$?\d+\)/gi,
            (_m, desde, hasta) =>
              `SUM(${Array.from({ length: hasta.charCodeAt(0) - desde.charCodeAt(0) + 1 }, (_, i) => `${String.fromCharCode(desde.charCodeAt(0) + i)}${r.filaOrigen}`).join(",")})`,
          );
          if (expandida.includes(":")) {
            cell.note = `Fórmula original: ${f}. Se conserva el último valor disponible.`;
            continue;
          }
          cell.value = {
            formula: expandida.replace(
              /\$?([E-X])\$?\d+/g,
              (_m, col) => `${letra(col.charCodeAt(0) - 64)}${row.number}`,
            ),
            ...(r.importes[original - 5] === null
              ? {}
              : { result: r.importes[original - 5] / 100 }),
          };
        } else
          cell.note = `Fórmula original: ${f}. Se conserva el último valor disponible.`;
      }
      if (
        (tipo === "mensual"
          ? [...new Set(filas.map((f) => f.nombre))].indexOf(r.nombre)
          : r.mes) %
          2 ===
        0
      )
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F5FB" },
          };
        });
    }
    const fin = hoja.rowCount,
      total = hoja.addRow(["Total"]);
    total.font = { bold: true };
    for (let original = 5; original <= 24; original++) {
      const c = destino(original),
        l = hoja.getColumn(c).letter;
      total.getCell(c).value = {
        formula: `SUM(${l}4:${l}${fin})`,
        result:
          filas.reduce((sum, r) => sum + (r.importes[original - 5] || 0), 0) /
          100,
      };
      total.getCell(c).numFmt = pesos;
      total.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6EDF6" },
      };
    }
    for (let c = 1; c <= 24; c++)
      hoja.getColumn(c).width = c === 1 ? 43 : c === 2 ? 20 : c >= 23 ? 23 : 18;
    hoja.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  return libro.xlsx.writeBuffer();
}
