import ExcelJS from "exceljs";

const argb = (c) =>
  c?.rgb ? `FF${c.rgb.replace("#", "").slice(-6)}` : undefined;
export async function exportarCompleto(snapshot) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Rey Pez";
  libro.calcProperties.fullCalcOnLoad = true;
  for (const id of snapshot.sheetOrder) {
    const s = snapshot.sheets[id];
    const hoja = libro.addWorksheet(s.name, {
      views: [
        {
          showGridLines: s.showGridlines !== 0,
          ...(s.freeze?.xSplit || s.freeze?.ySplit
            ? {
                state: "frozen",
                xSplit: s.freeze.xSplit || 0,
                ySplit: s.freeze.ySplit || 0,
              }
            : {}),
        },
      ],
    });
    for (const [r, row] of Object.entries(s.cellData || {}))
      for (const [c, d] of Object.entries(row)) {
        const cell = hoja.getCell(+r + 1, +c + 1);
        if (d.custom?.notaOriginal) cell.note = d.custom.notaOriginal;
        const v = d.p?.body?.dataStream?.replace(/\r\n$/, "") ?? d.v ?? null;
        // Los vínculos a otros archivos no se recalculan ni se convierten en fórmulas rotas.
        if (d.custom?.formulaExterna && !d.f)
          cell.note = `Referencia original: ${d.custom.formulaExterna}. Se conserva el último valor disponible.`;
        cell.value = d.f
          ? {
              formula: d.f.replace(/^=/, ""),
              ...(v === null ? {} : { result: v }),
            }
          : d.t === 3
            ? Boolean(v)
            : v;
        const e =
          typeof d.s === "string" ? snapshot.styles?.[d.s] || {} : d.s || {};
        cell.font = {
          name: e.ff || "Arial",
          size: e.fs || 11,
          bold: !!e.bl,
          italic: !!e.it,
          underline: !!e.ul?.s,
          strike: !!e.st?.s,
          ...(argb(e.cl) ? { color: { argb: argb(e.cl) } } : {}),
        };
        if (argb(e.bg))
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: argb(e.bg) },
          };
        cell.alignment = {
          horizontal: { 1: "left", 2: "center", 3: "right" }[e.ht],
          vertical: { 1: "top", 2: "middle", 3: "bottom" }[e.vt],
          wrapText: e.tb === 3,
        };
        if (e.n?.pattern) cell.numFmt = e.n.pattern;
        const border = {};
        for (const [key, side] of Object.entries({
          t: "top",
          b: "bottom",
          l: "left",
          r: "right",
        }))
          if (e.bd?.[key])
            border[side] = {
              style:
                {
                  1: "thin",
                  2: "hair",
                  3: "dotted",
                  4: "dashed",
                  7: "double",
                  8: "medium",
                  13: "thick",
                }[e.bd[key].s] || "thin",
              color: { argb: argb(e.bd[key].cl) || "FF000000" },
            };
        cell.border = border;
      }
    for (const [r, d] of Object.entries(s.rowData || {})) {
      const row = hoja.getRow(+r + 1);
      if (d.h) row.height = (d.h * 3) / 4;
      row.hidden = !!d.hd;
    }
    for (const [c, d] of Object.entries(s.columnData || {})) {
      const col = hoja.getColumn(+c + 1);
      if (d.w) col.width = Math.max(1, (d.w - 5) / 7);
      col.hidden = !!d.hd;
    }
    for (const m of s.mergeData || [])
      hoja.mergeCells(
        m.startRow + 1,
        m.startColumn + 1,
        m.endRow + 1,
        m.endColumn + 1,
      );
    hoja.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  // Recursos del filtro de Univer contienen rangos y selecciones. Se preservan en el
  // guardado del editor; la descarga exporta el rango completo, sin ocultar datos.
  return libro.xlsx.writeBuffer();
}
