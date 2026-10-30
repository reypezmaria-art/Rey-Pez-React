const tinta = "FF173957",
  claro = "FFF0F5FB",
  dorado = "FFF4E6BD";
const texto = (cell) =>
  typeof cell.value === "string" ? cell.value.trim() : "";
const normal = (value) => value.replace(/\s+/g, " ").toUpperCase();

// Presentación del acumulado: no sustituye ni recalcula importes del archivo.
export function darFormatoAcumulado(hoja) {
  for (const rango of [...hoja.model.merges]) hoja.unMergeCells(rango);
  hoja.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  hoja.properties.defaultRowHeight = 25;
  hoja.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  const cabeceras = [];
  hoja.eachRow((row, r) => {
    row.eachCell((cell, c) => {
      if (normal(texto(cell)) === "MES") cabeceras.push({ r, c });
    });
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: tinta } };
      cell.alignment = { vertical: "middle" };
      if (typeof cell.value === "number" || cell.formula) {
        cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00;"—"';
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
  });
  if (!cabeceras.length) return;
  const primera = cabeceras[0],
    titulos = new Set();
  let ultimaColumna = primera.c;
  for (const { r } of cabeceras)
    hoja.getRow(r).eachCell((cell, c) => {
      if (texto(cell)) {
        ultimaColumna = Math.max(ultimaColumna, c);
        titulos.add(normal(texto(cell)));
      }
    });
  for (let c = 1; c <= ultimaColumna; c++)
    hoja.getColumn(c).width = c < primera.c ? 2.5 : c === primera.c ? 17 : 15;
  // Un hueco de origen entre TOTAL y EXENTO se conserva como separador estrecho.
  for (let c = primera.c; c <= ultimaColumna; c++)
    if (cabeceras.every(({ r }) => !texto(hoja.getCell(r, c))))
      hoja.getColumn(c).width = 2.5;
  const pintar = (r, inicio, fin, fill, font = {}) => {
    for (let c = inicio; c <= fin; c++) {
      const cell = hoja.getCell(r, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: tinta },
        ...font,
      };
    }
  };
  for (const { r, c: mesCol } of cabeceras) {
    let fin = r + 1;
    while (
      fin <= hoja.rowCount &&
      normal(texto(hoja.getCell(fin, mesCol))) !== "TOTAL"
    )
      fin++;
    if (fin > hoja.rowCount) continue;
    const sub = hoja.getRow(r + 1),
      doble =
        !texto(sub.getCell(mesCol)) &&
        sub.values.some((v) => typeof v === "string" && v.trim());
    let finCol = mesCol;
    hoja.getRow(r).eachCell((cell, c) => {
      if (texto(cell)) finCol = Math.max(finCol, c);
    });
    if (doble) {
      for (let c = mesCol; c <= finCol; c++) {
        const celda = hoja.getCell(r, c),
          detalle = texto(hoja.getCell(r + 1, c));
        celda.value = [texto(celda), detalle].filter(Boolean).join("\n");
        hoja.mergeCells(r, c, r + 1, c);
      }
    }
    const empresaFila = Math.max(1, r - 3),
      tituloFila = Math.max(empresaFila + 1, r - 2);
    for (const [fila, fill, size] of [
      [empresaFila, tinta, 16],
      [tituloFila, dorado, 13],
    ]) {
      if (fila < 1 || fila >= r) continue;
      const row = hoja.getRow(fila),
        valores = [];
      row.eachCell((cell, col) => {
        if (cell.value !== null && texto(cell)) valores.push(col);
      });
      if (valores.length !== 1 || valores[0] !== mesCol) continue;
      hoja.mergeCells(fila, mesCol, fila, ultimaColumna);
      pintar(fila, mesCol, ultimaColumna, fill, {
        bold: true,
        size,
        color: { argb: fill === tinta ? "FFFFFFFF" : tinta },
      });
      row.height = fila === empresaFila ? 36 : 30;
    }
    const fiscal = Array.from({ length: finCol - mesCol + 1 }, (_, i) =>
      texto(hoja.getCell(r, mesCol + i)),
    ).some((label) => label.includes("SUBSIDIO"));
    if (fiscal && tituloFila < r)
      hoja.getCell(tituloFila, mesCol).value =
        `SUBSIDIOS E ISR · ${hoja.name.match(/20\d{2}/)?.[0] || ""}`.trim();
    if (r > 1) hoja.getRow(r - 1).height = 10;
    pintar(r, mesCol, finCol, tinta, {
      bold: true,
      color: { argb: "FFFFFFFF" },
    });
    hoja.getRow(r).height = doble ? 28 : 46;
    if (doble) hoja.getRow(r + 1).height = 28;
    for (let c = mesCol; c <= finCol; c++)
      hoja.getCell(r, c).alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: c === mesCol ? "left" : "center",
      };
    for (let fila = r + (doble ? 2 : 1); fila < fin; fila++) {
      hoja.getRow(fila).height = 29;
      if ((fila - r) % 2) pintar(fila, mesCol, finCol, claro);
      hoja.getCell(fila, mesCol).font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: tinta },
      };
      for (let c = mesCol; c <= finCol; c++)
        hoja.getCell(fila, c).border = {
          bottom: { style: "hair", color: { argb: "FFDCE5EF" } },
        };
    }
    pintar(fin, mesCol, finCol, tinta, {
      bold: true,
      color: { argb: "FFFFFFFF" },
    });
    hoja.getRow(fin).height = 34;
    for (let c = mesCol; c <= finCol; c++)
      hoja.getCell(fin, c).border = {
        top: { style: "medium", color: { argb: "FFE3BE61" } },
      };
    for (let c = mesCol + 1; c <= finCol; c++) {
      const label = texto(hoja.getCell(r, c));
      if (label.includes("TRABAJADORES"))
        for (let f = r + 2; f <= fin; f++)
          hoja.getCell(f, c).numFmt = '#,##0;[Red]-#,##0;"—"';
      if (label.includes("ENTERADO"))
        for (let f = r + 2; f < fin; f++)
          hoja.getCell(f, c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF6DA" },
          };
    }
  }
  hoja.eachRow((row, r) => {
    const soloVaciosOCeros = row.values.every(
      (v) =>
        v === null ||
        v === undefined ||
        v === 0 ||
        (typeof v === "string" && !v.trim()),
    );
    if (soloVaciosOCeros) row.hidden = true;
    const valores = [];
    row.eachCell((cell, c) => {
      if (texto(cell)) valores.push({ c, value: texto(cell) });
    });
    const esCabecera = cabeceras.some((h) => r >= h.r && r <= h.r + 1);
    if (
      !esCabecera &&
      valores.length > 2 &&
      valores.every((v) => titulos.has(normal(v.value))) &&
      !row.values.some((v) => typeof v === "number")
    )
      row.hidden = true;
    if (
      valores.length === 1 &&
      valores[0].c === 1 &&
      valores[0].value.length > 100
    ) {
      hoja.mergeCells(r, 1, r, ultimaColumna);
      row.height = 32;
      row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
      row.getCell(1).font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF66788B" },
      };
    }
  });
  for (let r = 1; r <= hoja.rowCount; r++) {
    const row = hoja.getRow(r);
    if (
      !row.values.some(
        (v) =>
          v !== null &&
          v !== undefined &&
          !(typeof v === "string" && !v.trim()),
      )
    )
      row.height = 8;
  }
  hoja.headerFooter = {
    ...(hoja.headerFooter || {}),
    oddFooter: "Rey Pez · Acumulado · Página &P de &N",
  };
}
