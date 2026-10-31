import {
  MESES_NOMINA,
  recibosNomina,
  normalizarNomina,
} from "../../codigo/dominio/nomina.js";

export const encabezadosPdf = [
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
  "SUB. AL EMP. A",
  "SUB. AL EMP.",
  "ISPT ANTES DE SUB.",
  "ISR A COMPESAR",
  "ISR",
  "ISPT",
  "IMSS",
  "DESC.INFONAVIT.",
  "PENCION ALIEMNT",
  "AJUSTE AL NETO",
  "SEG.VIVIENDA INFO",
  "NETO",
];
const normal = (v) => normalizarNomina(v).replace(/[^A-Z0-9]/g, "");
export async function firmasPdf(periodos) {
  return Object.fromEntries(
    await Promise.all(
      periodos.map(async (p) => {
        const bytes = new TextEncoder().encode(p.registrosJson);
        const hash = [
          ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        return [p.id, hash];
      }),
    ),
  );
}
export function pdfPendientes(periodos, aplicados, firmas) {
  return periodos
    .filter((p) => aplicados?.[p.id] !== firmas[p.id])
    .sort((a, b) => a.desde.localeCompare(b.desde));
}
export function filaDesdePdf(p, r) {
  const fila = Array(24).fill(null),
    extras = {};
  fila[0] = r.nombre;
  fila[1] = `${MESES_NOMINA[p.mes - 1].slice(0, 3).toUpperCase()} ${p.desde.slice(-2)}-${p.hasta.slice(-2)}`;
  fila[2] = r.nss || "";
  fila[3] = r.clave.startsWith("RFC:") ? r.clave.slice(4) : "";
  fila[11] = r.totalPercepciones / 100;
  fila[23] = r.neto / 100;
  const percepciones = {
    SUELDO: 4,
    AGUINALDO: 5,
    PTU: 6,
    PRIMAANTIG: 7,
    PRIMAANTIGUEDAD: 7,
    VACACIONES: 8,
    PRIMAVACACIONAL: 9,
    PRIMAVAC: 9,
    INDEMNIZACION: 10,
  };
  const deducciones = { 32: 12, 41: 14, 45: 16, 52: 18, 99: 21 };
  for (const [tipo, conceptos] of [
    ["Percepción", r.percepciones],
    ["Deducción", r.deducciones],
  ]) {
    for (const c of conceptos) {
      const concepto = normal(c.concepto);
      let col =
        tipo === "Percepción" ? percepciones[concepto] : deducciones[c.codigo];
      if (tipo === "Deducción" && col === undefined && !c.informativo) {
        if (["ISRACOMPENSAR", "ISRACOMPESAR"].includes(concepto)) col = 15;
        else if (concepto.includes("INFONAVIT")) col = 19;
        else if (concepto.includes("PENSION")) col = 20;
        else if (concepto.includes("SEGUROVIVIENDA")) col = 22;
      }
      if (col !== undefined)
        fila[col] = (Math.round((fila[col] || 0) * 100) + c.importe) / 100;
      else
        extras[
          `${tipo} ${c.codigo} · ${c.concepto}${c.informativo ? " (informativo)" : ""}`
        ] = c.importe / 100;
    }
  }
  extras["SALARIO DIARIO"] = r.salarioDiario / 100;
  extras["DÍAS PAGADOS"] = r.diasPagados;
  extras["TOTAL DEDUCCIONES"] = r.totalDeducciones / 100;
  return { fila, extras };
}
const texto = (d) => d?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? d?.v ?? "";
function perfil(s, r) {
  return Object.values(s.cellData || {}).some((row) => {
    const rfc = normal(texto(row[3]));
    if (r.clave.startsWith("RFC:") && rfc)
      return rfc === normal(r.clave.slice(4));
    return normal(texto(row[0])) === normal(r.nombre);
  });
}
function periodoIgual(a, b) {
  const x = String(a).match(/(\d{1,2})\s*-\s*(\d{1,2})/),
    y = String(b).match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  return (
    x &&
    y &&
    normal(a).slice(0, 3) === normal(b).slice(0, 3) &&
    +x[1] === +y[1] &&
    +x[2] === +y[2]
  );
}
function formatoAdmitido(s) {
  return (
    texto(s.cellData?.[2]?.[0]) === "NOMBRE" &&
    texto(s.cellData?.[2]?.[1]) === "PERIODO" &&
    texto(s.cellData?.[2]?.[4]) === "SUELDO"
  );
}
function nombreDisponible(libro, nombre) {
  const base = nombre.replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
  let n = base,
    i = 1;
  while (libro.getSheetByName(n)) n = `${base.slice(0, 25)} (${++i})`;
  return n;
}
const dinero = { n: { pattern: '"$"#,##0.00;[Red]-"$"#,##0.00' }, ht: 3 };
function crearHoja(libro, p, r, tipo) {
  const nombre = tipo === "mensual" ? MESES_NOMINA[p.mes - 1] : r.nombre;
  const s = libro.insertSheet(nombreDisponible(libro, nombre), {
    sheet: {
      rowCount: 200,
      columnCount: 40,
      defaultRowHeight: 28,
      defaultColumnWidth: 130,
      cellData: {
        0: {
          0: {
            v: `${p.empresa_nombre} · ${p.anio}`,
            s: {
              bg: { rgb: "#173957" },
              cl: { rgb: "#ffffff" },
              bl: 1,
              fs: 15,
            },
          },
        },
        1: { 0: { v: nombre, s: { bg: { rgb: "#F4E6BD" }, bl: 1 } } },
        2: Object.fromEntries(
          encabezadosPdf.map((v, c) => [
            c,
            {
              v,
              s: {
                bg: { rgb: "#173957" },
                cl: { rgb: "#ffffff" },
                bl: 1,
                tb: 3,
              },
            },
          ]),
        ),
        3: { 0: { v: "Total", s: { bl: 1 } } },
      },
      rowData: { 0: { h: 40 }, 1: { h: 32 }, 2: { h: 60 } },
      columnData: {
        0: { w: 300 },
        1: { w: 150 },
        2: { w: 180 },
        3: { w: 180 },
      },
      mergeData: [
        { startRow: 0, endRow: 0, startColumn: 0, endColumn: 23 },
        { startRow: 1, endRow: 1, startColumn: 0, endColumn: 23 },
      ],
      freeze: { ySplit: 3, startRow: 3, xSplit: 0, startColumn: 0 },
    },
  });
  if (tipo === "mensual") {
    const indice = libro
      .getSheets()
      .findIndex(
        (h) => MESES_NOMINA.indexOf(h.getSheetName().toLowerCase()) > p.mes - 1,
      );
    if (indice >= 0) libro.moveSheet(s, indice);
  }
  return s;
}

// Trabaja sobre el libro abierto: las inserciones actualizan las referencias.
// Nunca regenera las hojas existentes a partir del archivo original.
export function incorporarPdf(libro, periodos, tipo) {
  let cambios = false;
  const antes = libro.save();
  const activa = libro.getActiveSheet().getSheetId();
  // Validar antes de comenzar para no interpretar una hoja personalizada como tabla.
  for (const p of periodos)
    for (const r of recibosNomina(p)) {
      const snap = libro.save();
      const s = Object.values(snap.sheets).find((s) =>
        tipo === "mensual"
          ? s.name.toLowerCase() === MESES_NOMINA[p.mes - 1]
          : !/^Acumulado\s/i.test(s.name) && perfil(s, r),
      );
      if (s && !formatoAdmitido(s))
        throw Error(
          "La hoja existente tiene una estructura personalizada. No se incorporaron los PDF para evitar cambiar sus datos. Conserva el libro y revisa esa hoja antes de integrar los periodos.",
        );
    }
  for (const p of periodos) {
    const registros = recibosNomina(p),
      claves = new Set(registros.map((r) => r.clave));
    // Una corrección puede retirar trabajadores de ese periodo sin afectar otros.
    for (const s of libro.getSheets()) {
      const filas = libro.save().sheets[s.getSheetId()].cellData || {};
      for (const row of Object.keys(filas)
        .map(Number)
        .sort((a, b) => b - a)) {
        const marca = filas[row]?.[0]?.custom?.pdfNomina;
        if (marca?.periodo === p.id && !claves.has(marca.clave)) {
          libro.setActiveSheet(s);
          const previo = libro.save().sheets[s.getSheetId()];
          s.deleteRows(row, 1);
          actualizarTotal(libro, s, previo);
          cambios = true;
        }
      }
    }
    for (const r of registros) {
      let snap = libro.save();
      const guardada = Object.values(snap.sheets).find((s) =>
        tipo === "mensual"
          ? s.name.toLowerCase() === MESES_NOMINA[p.mes - 1]
          : !/^Acumulado\s/i.test(s.name) && perfil(s, r),
      );
      const hoja = guardada
        ? libro.getSheetBySheetId(guardada.id)
        : crearHoja(libro, p, r, tipo);
      libro.setActiveSheet(hoja);
      snap = libro.save();
      const s = snap.sheets[hoja.getSheetId()],
        rows = s.cellData || {};
      const marcaFila = Object.keys(rows).find(
        (row) =>
          rows[row]?.[0]?.custom?.pdfNomina?.periodo === p.id &&
          rows[row][0].custom.pdfNomina.clave === r.clave,
      );
      const { fila, extras } = filaDesdePdf(p, r);
      const existente = Object.keys(rows).find(
        (row) =>
          periodoIgual(texto(rows[row]?.[1]), fila[1]) &&
          perfil({ cellData: { [row]: rows[row] } }, r),
      );
      const identificada = marcaFila ?? existente;
      if (
        identificada !== undefined &&
        r.nss &&
        (r.nssCompletado || !texto(rows[identificada]?.[2]))
      ) {
        const anteriorNss = texto(rows[identificada]?.[2]);
        if (anteriorNss !== r.nss) {
          const anterior = rows[identificada]?.[2] || {};
          const formato =
            typeof anterior.s === "string"
              ? snap.styles?.[anterior.s] || {}
              : anterior.s || {};
          hoja.getRange(+identificada, 2).setValues([
            [
              {
                ...anterior,
                v: r.nss,
                t: 1,
                f: null,
                p: null,
                s: { ...formato, n: { pattern: "@" } },
              },
            ],
          ]);
          cambios = true;
        }
        if (r.nssCompletado) continue;
      }
      // El Excel puede contener ya ese recibo, con correcciones manuales: conservarlo.
      if (marcaFila === undefined && existente !== undefined) continue;
      const total = Object.keys(rows)
        .map(Number)
        .find((row) => row >= 3 && normal(texto(rows[row]?.[0])) === "TOTAL");
      if (total === undefined)
        throw Error(
          "Falta la fila Total de la hoja. Se conserva el libro anterior; revisa la estructura antes de incorporar los PDF.",
        );
      let row;
      if (marcaFila !== undefined) row = Number(marcaFila);
      else {
        row = total;
        hoja.insertRowsBefore(total, 1);
      }
      if (marcaFila !== undefined) {
        const nombres = rows[marcaFila]?.[0]?.custom?.pdfNomina?.extras || [];
        for (const nombre of nombres)
          for (const [c, d] of Object.entries(rows[2] || {}))
            if (+c >= 24 && texto(d) === nombre)
              hoja.getRange(row, +c).clearContent();
      }
      // Recuperar NSS del mismo trabajador únicamente si el PDF guardado no lo incluye.
      if (!fila[2])
        for (const h of Object.values(snap.sheets)) {
          const dato = Object.values(h.cellData || {}).find(
            (d) => perfil({ cellData: { 0: d } }, r) && texto(d[2]),
          );
          if (dato) {
            fila[2] = texto(dato[2]);
            break;
          }
        }
      hoja.getRange(row, 0, 1, 24).setValues([
        fila.map((v, c) => ({
          v: c === 2 ? String(v ?? "") : v,
          f: null,
          p: null,
          s:
            marcaFila !== undefined
              ? rows[marcaFila]?.[c]?.s || (c >= 4 ? dinero : {})
              : c >= 4
                ? dinero
                : {},
          ...(c === 2 ? { t: 1, s: { n: { pattern: "@" } } } : {}),
          ...(c === 0
            ? {
                custom: {
                  ...rows[marcaFila]?.[c]?.custom,
                  pdfNomina: {
                    periodo: p.id,
                    clave: r.clave,
                    extras: Object.keys(extras),
                  },
                },
              }
            : {}),
        })),
      ]);
      let headers = libro.save().sheets[hoja.getSheetId()].cellData?.[2] || {};
      for (const [nombre, valor] of Object.entries(extras)) {
        let col = Object.keys(headers).find(
          (c) => texto(headers[c]) === nombre,
        );
        if (col === undefined) {
          const usado = Object.values(
            libro.save().sheets[hoja.getSheetId()].cellData || {},
          ).flatMap((d) => Object.keys(d).map(Number));
          col = Math.max(23, ...usado) + 1;
          if (col >= hoja.getMaxColumns())
            hoja.insertColumnsAfter(
              hoja.getMaxColumns() - 1,
              col - hoja.getMaxColumns() + 1,
            );
          hoja
            .getRange(2, +col)
            .setValue(nombre)
            .setBackgroundColor("#173957")
            .setFontColor("#ffffff")
            .setFontWeight("bold")
            .setWrap(true);
          hoja.setColumnWidth(+col, 180);
          headers = libro.save().sheets[hoja.getSheetId()].cellData[2];
        }
        hoja
          .getRange(row, +col)
          .setValues([
            [{ v: valor, s: nombre === "DÍAS PAGADOS" ? {} : dinero }],
          ]);
      }
      actualizarTotal(libro, hoja, s);
      cambios = true;
    }
  }
  if (cambios)
    actualizarResumen(libro, antes, [...new Set(periodos.map((p) => p.mes))]);
  libro.setActiveSheet(activa);
  return cambios;
}

const letraColumna = (n) => {
  let texto = "";
  for (n++; n; n = Math.floor((n - 1) / 26))
    texto = String.fromCharCode(65 + ((n - 1) % 26)) + texto;
  return texto;
};
export function detalleResumen(snapshot, mes, concepto) {
  const personas = new Set();
  let suma = 0;
  const refs = [];
  for (const s of Object.values(snapshot.sheets)) {
    if (!formatoAdmitido(s)) continue;
    const extra = Object.keys(s.cellData?.[2] || {}).find(
      (c) => normal(texto(s.cellData[2][c])) === "TOTALDEDUCCIONES",
    );
    const col = concepto === "deducciones" ? extra : concepto;
    if (col === undefined) continue;
    for (const [r, d] of Object.entries(s.cellData || {})) {
      if (+r < 3 || normal(texto(d[0])) === "TOTAL") continue;
      if (
        normal(texto(d[1])).slice(0, 3) !==
        normal(MESES_NOMINA[mes - 1]).slice(0, 3)
      )
        continue;
      if (concepto === "personas") {
        personas.add(normal(texto(d[3])) || normal(texto(d[0])));
        continue;
      }
      for (const indice of concepto === "isrRetenido" ? [15, 16] : [+col]) {
        const v = d[indice]?.v;
        suma +=
          typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : 0;
        refs.push(
          `'${s.name.replace(/'/g, "''")}'!${letraColumna(indice)}${+r + 1}`,
        );
      }
    }
  }
  return concepto === "personas"
    ? { suma: personas.size * 100, formula: null }
    : { suma, formula: refs.length ? `=SUM(${refs.join(",")})` : "=0" };
}
export function actualizarResumen(libro, antes, meses) {
  let cambios = false;
  const conceptos = {
    SUELDO: 4,
    AGUINALDO: 5,
    PTU: 6,
    PRIMAANTIG: 7,
    VACACIONES: 8,
    PRIMAVAC: 9,
    INDEMNIZACION: 10,
    TOTAL: 11,
    TOTALPERCEPCIONES: 11,
    TOTALDEDUCCIONES: "deducciones",
    NETOAPAGAR: 23,
    ISRRETENIDO: "isrRetenido",
    NUMEROTRABAJADORES: "personas",
  };
  for (const s of libro.getSheets()) {
    if (!/^Acumulado\s+\d{4}$/i.test(s.getSheetName())) continue;
    const original = antes.sheets[s.getSheetId()];
    if (!original) continue;
    for (const [h, d] of Object.entries(original.cellData || {})) {
      const mesCol = Object.keys(d).find((c) => normal(texto(d[c])) === "MES");
      if (mesCol === undefined) continue;
      // No convertir las tablas fiscales de subsidios/exentos en cálculos de nómina.
      if (
        !Object.values(d).some((v) =>
          [
            "SUELDO",
            "TOTALPERCEPCIONES",
            "ISRRETENIDO",
            "NUMEROTRABAJADORES",
          ].includes(normal(texto(v))),
        )
      )
        continue;
      for (const mes of meses) {
        let actual = libro.save().sheets[s.getSheetId()];
        const total = Object.keys(actual.cellData)
          .map(Number)
          .find(
            (r) =>
              r > +h && normal(texto(actual.cellData[r][mesCol])) === "TOTAL",
          );
        if (total === undefined) continue;
        let fila = Object.keys(actual.cellData)
          .map(Number)
          .find(
            (r) =>
              r > +h &&
              r < total &&
              normal(texto(actual.cellData[r][mesCol])) ===
                normal(MESES_NOMINA[mes - 1]),
          );
        if (fila === undefined) {
          libro.setActiveSheet(s);
          s.insertRowsBefore(total, 1);
          fila = total;
          s.getRange(fila, +mesCol).setValue(MESES_NOMINA[mes - 1]);
          actual = libro.save().sheets[s.getSheetId()];
          cambios = true;
        }
        for (const [c, header] of Object.entries(d)) {
          const concepto = conceptos[normal(texto(header))];
          if (concepto === undefined) continue;
          const celda = actual.cellData[fila]?.[c] || {};
          const anterior = detalleResumen(antes, mes, concepto);
          const controlada = celda.custom?.pdfResumenFormula
            ? celda.f === celda.custom.pdfResumenFormula
            : celda.custom?.pdfResumenValor !== undefined &&
              celda.v === celda.custom.pdfResumenValor;
          const vacia =
            !celda.f &&
            (celda.v === null ||
              celda.v === undefined ||
              celda.v === "" ||
              celda.v === 0);
          if (
            !controlada &&
            !vacia &&
            (celda.f !== anterior.formula || !celda.f) &&
            (celda.f || Math.round(Number(celda.v) * 100) !== anterior.suma)
          )
            continue;
          const nuevo = detalleResumen(libro.save(), mes, concepto);
          if (
            (celda.f || null) === nuevo.formula &&
            Number(celda.v) === nuevo.suma / 100
          )
            continue;
          cambios = true;
          s.getRange(fila, +c).setValues([
            [
              {
                f: nuevo.formula,
                v: nuevo.suma / 100,
                s:
                  concepto === "personas"
                    ? {
                        ...(typeof celda.s === "string"
                          ? libro.save().styles?.[celda.s] || {}
                          : celda.s || {}),
                        n: { pattern: "0" },
                      }
                    : celda.s || dinero,
                custom: {
                  ...celda.custom,
                  pdfResumenFormula: nuevo.formula,
                  pdfResumenValor: nuevo.suma / 100,
                },
              },
            ],
          ]);
        }
      }
      // Los totales importados eran valores fijos: enlazar solo los que aún coinciden
      // con sus meses previos, sin sustituir un ajuste manual distinto.
      const actual = libro.save().sheets[s.getSheetId()];
      const total = Object.keys(actual.cellData)
        .map(Number)
        .find(
          (r) =>
            r > +h && normal(texto(actual.cellData[r][mesCol])) === "TOTAL",
        );
      const totalAntes = Object.keys(original.cellData)
        .map(Number)
        .find(
          (r) =>
            r > +h && normal(texto(original.cellData[r][mesCol])) === "TOTAL",
        );
      if (total === undefined || totalAntes === undefined) continue;
      for (const [c, header] of Object.entries(d)) {
        const concepto = conceptos[normal(texto(header))];
        if (concepto === undefined || concepto === "personas") continue;
        const celda = actual.cellData[total]?.[c] || {};
        const antigua = original.cellData[totalAntes]?.[c] || {};
        const sumaAnterior = Object.entries(original.cellData)
          .filter(
            ([r, row]) =>
              +r > +h &&
              +r < totalAntes &&
              MESES_NOMINA.some(
                (m) => normal(texto(row[mesCol])) === normal(m),
              ),
          )
          .reduce(
            (n, [, row]) => n + Math.round(Number(row[c]?.v || 0) * 100),
            0,
          );
        const controlada =
          celda.custom?.pdfResumenFormula &&
          celda.f === celda.custom.pdfResumenFormula;
        if (
          !controlada &&
          (antigua.f ||
            Math.round(Number(antigua.v || 0) * 100) !== sumaAnterior)
        )
          continue;
        const letra = letraColumna(+c),
          formula = `=SUM(${letra}${+h + 2}:${letra}${total})`;
        if (celda.f === formula) continue;
        const suma = Object.entries(actual.cellData)
          .filter(
            ([r, row]) =>
              +r > +h &&
              +r < total &&
              MESES_NOMINA.some(
                (m) => normal(texto(row[mesCol])) === normal(m),
              ),
          )
          .reduce(
            (n, [, row]) => n + Math.round(Number(row[c]?.v || 0) * 100),
            0,
          );
        s.getRange(total, +c).setValues([
          [
            {
              ...celda,
              f: formula,
              v: suma / 100,
              custom: { ...celda.custom, pdfResumenFormula: formula },
            },
          ],
        ]);
        cambios = true;
      }
    }
  }
  return cambios;
}

function actualizarTotal(libro, hoja, previo) {
  const filas = libro.save().sheets[hoja.getSheetId()].cellData || {};
  const total = Object.keys(filas)
    .map(Number)
    .find((r) => r >= 3 && normal(texto(filas[r][0])) === "TOTAL");
  if (total === undefined) return;
  const anterior =
    Object.values(previo.cellData || {}).find(
      (row) => normal(texto(row[0])) === "TOTAL",
    ) || {};
  for (let col = 4; col < 24; col++) {
    const letra = letraColumna(col),
      celda = anterior[col] || {};
    const suma = new RegExp(
      `^=?SUM\\(\\$?${letra}\\$?4:\\$?${letra}\\$?\\d+\\)$`,
      "i",
    );
    if (
      celda.f
        ? !suma.test(celda.f)
        : celda.v !== undefined && celda.v !== null && celda.v !== 0
    )
      continue;
    hoja
      .getRange(total, col)
      .setValue(total > 3 ? `=SUM(${letra}4:${letra}${total})` : 0);
  }
}
