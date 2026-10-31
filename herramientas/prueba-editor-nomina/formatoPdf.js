const COLORES = {
  tinta: "#173957",
  claro: "#F0F5FB",
  dorado: "#F4E6BD",
  blanco: "#ffffff",
  linea: "#DCE5EF",
};
const moneda = '"$"#,##0.00;[Red]-"$"#,##0.00;"—"';
const valor = (d) => d?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? d?.v ?? "";
const normal = (v) => String(v).trim().toLocaleUpperCase("es");
const resolver = (snapshot, s) =>
  typeof s === "string" ? snapshot.styles?.[s] || {} : s || {};
// El formato antiguo se presenta después de recuperar sus columnas: C/D aún
// contienen importes y no deben recibir el formato de texto de IMSS/RFC.
const detalle = (s) =>
  valor(s.cellData?.[2]?.[0]) === "NOMBRE" &&
  valor(s.cellData?.[2]?.[1]) === "PERIODO" &&
  valor(s.cellData?.[2]?.[2]) !== "SUELDO DEL PERIODO";
const base = {
  ff: "Calibri",
  fs: 11,
  bl: 0,
  it: 0,
  cl: { rgb: COLORES.tinta },
  bg: { rgb: COLORES.blanco },
  vt: 2,
};
function textoConFormato(d, estilo) {
  if (!d.p) return d;
  const p = structuredClone(d.p);
  if (p.body?.textRuns)
    for (const run of p.body.textRuns) {
      run.ts = {
        ...run.ts,
        ff: "Calibri",
        fs: estilo.fs,
        bl: estilo.bl,
        it: 0,
        cl: estilo.cl,
      };
      delete run.ts.bg;
    }
  if (p.documentStyle?.textStyle)
    p.documentStyle.textStyle = {
      ...p.documentStyle.textStyle,
      ff: "Calibri",
      fs: estilo.fs,
      bl: estilo.bl,
      it: 0,
      cl: estilo.cl,
    };
  return { ...d, p };
}
function celda(snapshot, d, cambios) {
  const s = { ...resolver(snapshot, d.s), ...cambios };
  return { ...textoConFormato(d, s), s };
}

// Tema fijo para todos los detalles, incluso libros antiguos sin marcas PDF.
// No se reutilizan colores de filas existentes: pueden haber heredado el encabezado.
export function aplicarFormatoPdf(snapshot) {
  const sheets = { ...snapshot.sheets };
  for (const id of snapshot.sheetOrder) {
    const original = snapshot.sheets[id];
    if (!detalle(original)) {
      if (/^Acumulado\s+\d{4}$/i.test(original.name)) {
        const cellData = Object.fromEntries(
          Object.entries(original.cellData || {}).map(([r, fila]) => [
            r,
            Object.fromEntries(
              Object.entries(fila).map(([c, d]) => {
                const previo = resolver(snapshot, d.s);
                return [
                  c,
                  celda(snapshot, d, {
                    ff: "Calibri",
                    fs: [16, 13].includes(previo.fs) ? previo.fs : 11,
                  }),
                ];
              }),
            ),
          ]),
        );
        sheets[id] = { ...original, cellData };
      }
      continue;
    }
    const cellData = Object.fromEntries(
      Object.entries(original.cellData || {}).map(([r, fila]) => [
        r,
        { ...fila },
      ]),
    );
    const rowData = { ...original.rowData },
      columnData = { ...original.columnData };
    for (const [r, d] of Object.entries(rowData))
      if (+r >= 3)
        rowData[r] = { ...d, s: { ...resolver(snapshot, d.s), ...base } };
    const columnas = Math.max(
      23,
      ...Object.keys(cellData[2] || {}).map(Number),
    );
    for (let c = 0; c <= columnas; c++) {
      const anterior = columnData[c] || {};
      columnData[c] = {
        ...anterior,
        w:
          c === 0
            ? Math.max(360, anterior.w || 0)
            : c === 1
              ? 160
              : c < 4
                ? 180
                : Math.max(140, anterior.w || 0),
        s: { ...resolver(snapshot, anterior.s), ...base },
      };
    }
    const mergeData = (original.mergeData || []).filter((m) => m.startRow > 1);
    for (let r = 0; r < 3; r++) {
      const titulo = r === 0,
        subtitulo = r === 1;
      const estilo = {
        ...base,
        fs: titulo ? 16 : subtitulo ? 13 : 11,
        bl: 1,
        cl: { rgb: subtitulo ? COLORES.tinta : COLORES.blanco },
        bg: { rgb: subtitulo ? COLORES.dorado : COLORES.tinta },
        tb: 3,
      };
      rowData[r] = {
        ...rowData[r],
        h: titulo ? 48 : subtitulo ? 40 : 64,
        ia: 0,
        s: estilo,
      };
      const fila = (cellData[r] ||= {});
      const tieneDatos = Object.entries(fila).some(
        ([c, d]) => +c > 0 && +c <= columnas && (d.f || valor(d) !== ""),
      );
      for (const c of new Set([
        ...Array.from({ length: columnas + 1 }, (_, i) => String(i)),
        ...Object.keys(fila),
      ])) {
        fila[c] = celda(snapshot, fila[c] || { v: null }, {
          ...estilo,
          ht: r === 2 && +c > 1 ? 2 : 1,
        });
      }
      if (r < 2 && !tieneDatos)
        mergeData.push({
          startRow: r,
          endRow: r,
          startColumn: 0,
          endColumn: columnas,
        });
      else if (r < 2)
        mergeData.push(
          ...(original.mergeData || []).filter((m) => m.startRow === r),
        );
    }
    let indice = 0;
    for (const r of Object.keys(cellData)
      .map(Number)
      .filter((r) => r >= 3)
      .sort((a, b) => a - b)) {
      const fila = cellData[r];
      const total = /^TOTAL(?:\s|$)/.test(normal(valor(fila[0])));
      const datos =
        String(valor(fila[0])).trim() !== "" ||
        String(valor(fila[1])).trim() !== "";
      const color = total
        ? COLORES.tinta
        : datos && indice % 2 === 0
          ? COLORES.claro
          : COLORES.blanco;
      const altura = Math.max(
        38,
        Math.ceil(String(valor(fila[0])).length / 46) * 18 + 12,
      );
      // Neutralizar también los estilos heredados; las celdas vacías no deben quedar azules.
      rowData[r] = {
        ...rowData[r],
        h: total ? 45 : altura,
        ia: 0,
        s: { ...resolver(snapshot, rowData[r]?.s), ...base },
      };
      for (const c of new Set([
        ...Array.from({ length: columnas + 1 }, (_, i) => String(i)),
        ...Object.keys(fila),
      ])) {
        const d = fila[c] || { v: null },
          previo = resolver(snapshot, d.s);
        const cambios = {
          ...base,
          bl: total || +c === 0 ? 1 : 0,
          cl: { rgb: total ? COLORES.blanco : COLORES.tinta },
          bg: { rgb: color },
          ht: +c < 4 ? 1 : 3,
          tb: 3,
          bd: total
            ? { t: { s: 8, cl: { rgb: "#E3BE61" } } }
            : { b: { s: 2, cl: { rgb: COLORES.linea } } },
        };
        if (+c === 2 || +c === 3) cambios.n = { pattern: "@" };
        else if (+c >= 4 && +c < 24) cambios.n = { pattern: moneda };
        else if (previo.n) cambios.n = previo.n;
        fila[c] = celda(snapshot, d, cambios);
      }
      if (datos && !total) indice++;
    }
    sheets[id] = {
      ...original,
      cellData,
      rowData,
      columnData,
      mergeData,
      defaultStyle: { ...resolver(snapshot, original.defaultStyle), ...base },
      defaultRowHeight: 38,
    };
  }
  return {
    ...snapshot,
    sheets,
    defaultStyle: { ...resolver(snapshot, snapshot.defaultStyle), ...base },
  };
}
