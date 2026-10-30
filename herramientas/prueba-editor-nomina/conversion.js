/* global DOMParser, XMLSerializer */
import ExcelJS from "exceljs";
import JSZip from "jszip";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const color = (c) => (c?.argb ? `#${c.argb.slice(-6)}` : undefined);
const clone = (v) => JSON.parse(JSON.stringify(v));
function estilo(c) {
  const f = c.font || {},
    a = c.alignment || {};
  const s = {
    ff: f.name || "Arial",
    fs: f.size || 11,
    bl: +!!f.bold,
    it: +!!f.italic,
  };
  if (color(f.color)) s.cl = { rgb: color(f.color) };
  if (color(c.fill?.fgColor)) s.bg = { rgb: color(c.fill.fgColor) };
  if (c.numFmt && c.numFmt !== "General") s.n = { pattern: c.numFmt };
  if (a.horizontal) s.ht = { left: 1, center: 2, right: 3 }[a.horizontal] || 0;
  if (a.vertical) s.vt = { top: 1, middle: 2, bottom: 3 }[a.vertical] || 0;
  if (a.wrapText) s.tb = 3;
  s.bd = {};
  for (const [side, key] of Object.entries({
    top: "t",
    bottom: "b",
    left: "l",
    right: "r",
  })) {
    const b = c.border?.[side];
    if (b?.style)
      s.bd[key] = {
        s:
          {
            thin: 1,
            hair: 2,
            dotted: 3,
            dashed: 4,
            double: 7,
            medium: 8,
            thick: 13,
          }[b.style] || 1,
        cl: { rgb: color(b.color) || "#000000" },
      };
  }
  return s;
}
const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
const elements = (r, name) => [...r.getElementsByTagNameNS(NS, name)];
const serializar = (d) => new XMLSerializer().serializeToString(d);

export async function importar(bytes, nombre) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const wb = xml(await zip.file("xl/workbook.xml").async("string"));
  const rel = xml(await zip.file("xl/_rels/workbook.xml.rels").async("string"));
  const targets = Object.fromEntries(
    [...rel.documentElement.children].map((r) => [
      r.getAttribute("Id"),
      r.getAttribute("Target"),
    ]),
  );
  const rutas = elements(wb, "sheet").map((s) => {
    const p = targets[s.getAttribute("r:id")];
    return p.startsWith("/") ? p.slice(1) : `xl/${p}`;
  });
  const data = {
    id: crypto.randomUUID(),
    name: nombre,
    appVersion: "1.3.1",
    locale: "esES",
    styles: {},
    sheetOrder: [],
    sheets: {},
  };
  let formulas = 0,
    externas = 0,
    celdas = 0;
  libro.worksheets.forEach((ws, i) => {
    const id = `hoja-${i + 1}`,
      cellData = {},
      rowData = {},
      columnData = {};
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      if (row.height) rowData[r - 1] = { h: (row.height * 4) / 3 };
      row.eachCell({ includeEmpty: true }, (c, col) => {
        if (c.isMerged && c.master.address !== c.address) return;
        const v = c.value;
        const d = { v: null, s: estilo(c) };
        if (c.formula) {
          formulas++;
          d.v = c.result ?? null;
          if (c.formula.includes("[")) {
            externas++;
            d.custom = { formulaExterna: c.formula };
          } else d.f = `=${c.formula}`;
        } else if (v instanceof Date) d.v = v.getTime() / 86400000 + 25569;
        else if (v && typeof v === "object")
          d.v = v.richText
            ? v.richText.map((t) => t.text).join("")
            : (v.text ?? v.error ?? null);
        else d.v = v;
        if (typeof d.v === "boolean") {
          d.v = +d.v;
          d.t = 3;
        } else if (typeof d.v === "number") d.t = 2;
        else if (typeof d.v === "string") d.t = 1;
        (cellData[r - 1] ||= {})[col - 1] = d;
        celdas++;
      });
    });
    ws.columns.forEach((c, col) => {
      if (c.width)
        columnData[col] = { w: Math.round(c.width * 7 + 5), hd: +!!c.hidden };
    });
    const mergeData = ws.model.merges.map((range) => {
      const m = ws.getCell(range.split(":")[0]),
        end = ws.getCell(range.split(":")[1] || range);
      return {
        startRow: m.row - 1,
        endRow: end.row - 1,
        startColumn: m.col - 1,
        endColumn: end.col - 1,
      };
    });
    data.sheetOrder.push(id);
    data.sheets[id] = {
      id,
      name: ws.name,
      rowCount: Math.max(150, ws.rowCount + 20),
      columnCount: Math.max(30, ws.columnCount + 3),
      cellData,
      rowData,
      columnData,
      mergeData,
      defaultRowHeight: 22,
      defaultColumnWidth: 90,
      rowHeader: { width: 44 },
      columnHeader: { height: 24 },
      showGridlines: 1,
    };
  });
  return {
    bytes,
    nombre,
    rutas,
    snapshot: data,
    baseline: clone(data),
    resumen: { hojas: libro.worksheets.length, formulas, externas, celdas },
  };
}

function contenido(c) {
  // El resultado calculado puede cambiar sin que se haya editado la fórmula.
  return c?.f
    ? { f: c.f }
    : {
        v: c?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? c?.v ?? null,
        t: c?.t ?? null,
      };
}
function resolverEstilo(c, snapshot) {
  const style = typeof c?.s === "string" ? snapshot.styles[c.s] : c?.s;
  // Deshacer/rehacer puede quitar objetos vacíos como bd: {} sin cambiar
  // el formato. Comparar su significado evita bloquear una descarga válida.
  const normalizar = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const entries = Object.keys(value)
      .sort()
      .map((key) => [key, normalizar(value[key])])
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  };
  return normalizar(style);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function exportarCopia(prueba, snapshot) {
  const original = prueba.baseline;
  if (!igual(snapshot.sheetOrder, original.sheetOrder))
    throw Error(
      "La prueba aún no exporta hojas agregadas, eliminadas o reordenadas. El guardado local sí las conserva.",
    );
  const cambios = [];
  for (const id of original.sheetOrder) {
    const a = original.sheets[id],
      b = snapshot.sheets[id];
    for (const k of [
      "name",
      "rowCount",
      "columnCount",
      "mergeData",
      "rowData",
      "columnData",
    ]) {
      if (!igual(a[k], b[k]))
        throw Error(
          `La prueba aún no exporta cambios de estructura o formato (${a.name}). Puedes conservarlos con Guardar prueba.`,
        );
    }
    const filas = new Set([
      ...Object.keys(a.cellData),
      ...Object.keys(b.cellData),
    ]);
    const lista = [];
    for (const r of filas) {
      const columnas = new Set([
        ...Object.keys(a.cellData[r] || {}),
        ...Object.keys(b.cellData[r] || {}),
      ]);
      for (const c of columnas) {
        const prev = a.cellData[r]?.[c],
          next = b.cellData[r]?.[c];
        if (
          !igual(resolverEstilo(prev, original), resolverEstilo(next, snapshot))
        )
          throw Error(
            "La descarga de prueba conserva los formatos originales. Guarda los cambios de formato en el navegador.",
          );
        if (!igual(contenido(prev), contenido(next)))
          lista.push({ r: +r + 1, c: +c + 1, next });
      }
    }
    cambios.push(lista);
  }
  const zip = await JSZip.loadAsync(prueba.bytes);
  for (let i = 0; i < cambios.length; i++) {
    if (!cambios[i].length) continue;
    const path = prueba.rutas[i],
      doc = xml(await zip.file(path).async("string"));
    const sheetData = elements(doc, "sheetData")[0];
    const add = (tag, parent) => {
      const e = doc.createElementNS(NS, tag);
      parent.appendChild(e);
      return e;
    };
    for (const { r, c, next } of cambios[i]) {
      let col = "",
        x = c;
      while (x) {
        x--;
        col = String.fromCharCode(65 + (x % 26)) + col;
        x = Math.floor(x / 26);
      }
      const address = `${col}${r}`;
      let row = elements(doc, "row").find((e) => +e.getAttribute("r") === r);
      if (!row) {
        row = add("row", sheetData);
        row.setAttribute("r", r);
      }
      let cell = [...row.children].find((e) => e.getAttribute("r") === address);
      if (!cell) {
        cell = add("c", row);
        cell.setAttribute("r", address);
      }
      for (const child of [...cell.children])
        if (["v", "f", "is"].includes(child.localName)) child.remove();
      cell.removeAttribute("t");
      if (next?.f) add("f", cell).textContent = next.f.replace(/^=/, "");
      else {
        const v = contenido(next).v;
        if (typeof v === "string") {
          cell.setAttribute("t", "inlineStr");
          const t = add("t", add("is", cell));
          t.setAttribute("xml:space", "preserve");
          t.textContent = v;
        } else if (v !== null) {
          if (next?.t === 3) cell.setAttribute("t", "b");
          add("v", cell).textContent = v;
        }
      }
      // Mantener el orden de las celdas y las filas requerido por XLSX.
      [...row.children]
        .sort((a, b) => {
          const index = (e) =>
            [...e.getAttribute("r").replace(/\d/g, "")].reduce(
              (v, l) => v * 26 + l.charCodeAt(0) - 64,
              0,
            );
          return index(a) - index(b);
        })
        .forEach((e) => row.appendChild(e));
    }
    [...sheetData.children]
      .sort((a, b) => +a.getAttribute("r") - +b.getAttribute("r"))
      .forEach((e) => sheetData.appendChild(e));
    zip.file(path, serializar(doc));
  }
  const doc = xml(await zip.file("xl/workbook.xml").async("string"));
  let calc = elements(doc, "calcPr")[0];
  if (!calc) {
    calc = doc.createElementNS(NS, "calcPr");
    doc.documentElement.appendChild(calc);
  }
  calc.setAttribute("fullCalcOnLoad", "1");
  calc.setAttribute("forceFullCalc", "1");
  calc.setAttribute("calcMode", "auto");
  zip.file("xl/workbook.xml", serializar(doc));
  // La cadena anterior deja de ser válida al editar una fórmula.
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    for (const path of ["xl/_rels/workbook.xml.rels", "[Content_Types].xml"]) {
      const d = xml(await zip.file(path).async("string"));
      [...d.documentElement.children]
        .filter((e) =>
          [...e.attributes].some((a) => a.value.includes("calcChain")),
        )
        .forEach((e) => e.remove());
      zip.file(path, serializar(d));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
