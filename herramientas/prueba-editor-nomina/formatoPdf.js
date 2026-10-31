import { MESES_NOMINA } from "../../codigo/dominio/nomina.js";
const valor = (d) => d?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? d?.v ?? "";
const estilo = (snapshot, d) =>
  typeof d?.s === "string" ? snapshot.styles?.[d.s] || {} : d?.s || {};
const detalle = (s) =>
  valor(s.cellData?.[2]?.[0]) === "NOMBRE" &&
  valor(s.cellData?.[2]?.[1]) === "PERIODO";
const contienePdf = (s) =>
  Object.values(s.cellData || {}).some((row) => row[0]?.custom?.pdfNomina);
const normal = (v) => String(v).trim().toLocaleUpperCase("es");

// Solo cambia la presentación. Mantiene valores, fórmulas, notas y marcas PDF.
export function aplicarFormatoPdf(snapshot, tipo) {
  const sheets = { ...snapshot.sheets };
  const candidatas = Object.values(sheets).filter(
    (s) =>
      detalle(s) &&
      (!contienePdf(s) ||
        Object.entries(s.cellData || {}).some(
          ([r, d]) =>
            +r >= 3 &&
            !d[0]?.custom?.pdfNomina &&
            /\d/.test(String(valor(d[1]))),
        )),
  );
  for (const id of snapshot.sheetOrder) {
    const s = sheets[id];
    if (!detalle(s) || !contienePdf(s)) continue;
    const mes = MESES_NOMINA.indexOf(s.name.toLowerCase());
    const plantilla =
      candidatas
        .filter(
          (t) =>
            MESES_NOMINA.indexOf(t.name.toLowerCase()) >= 0 &&
            MESES_NOMINA.indexOf(t.name.toLowerCase()) < mes,
        )
        .sort(
          (a, b) =>
            MESES_NOMINA.indexOf(a.name.toLowerCase()) -
            MESES_NOMINA.indexOf(b.name.toLowerCase()),
        )
        .at(-1) ||
      candidatas.at(-1) ||
      s;
    const fuente = plantilla.cellData || {};
    const bandas = [
      ...new Set(
        Object.entries(fuente)
          .filter(
            ([r, d]) =>
              +r >= 3 &&
              /\d/.test(String(valor(d[1]))) &&
              normal(valor(d[0])) !== "TOTAL",
          )
          .map(([, d]) => estilo(snapshot, d[0]).bg?.rgb || "#ffffff"),
      ),
    ];
    const banda =
      bandas.find((c) => !["#ffffff", "#fff"].includes(c.toLowerCase())) ||
      "#F0F5FB";
    const fondo = bandas.find((c) => c !== banda) || "#ffffff";
    const cellData = Object.fromEntries(
      Object.entries(s.cellData || {}).map(([r, d]) => [r, { ...d }]),
    );
    const rowData = { ...s.rowData };
    const columnData = { ...s.columnData };
    const fuenteCabecera = estilo(snapshot, fuente[2]?.[0]);
    for (let c = 0; c < 24; c++)
      columnData[c] = {
        ...(s.columnData?.[c] || {}),
        w:
          plantilla.columnData?.[c]?.w ||
          (c === 0 ? 306 : c === 1 ? 145 : c < 4 ? 166 : 131),
      };
    const mergeData = (s.mergeData || []).filter((m) => m.startRow > 1);
    for (let r = 0; r < 3; r++) {
      rowData[r] = {
        ...rowData[r],
        h: plantilla.rowData?.[r]?.h || [(34 * 4) / 3, 40, 64][r],
      };
      const fila = (cellData[r] ||= {});
      const rango = (plantilla.mergeData || []).find(
        (m) => m.startRow === r && m.endRow === r && m.startColumn === 0,
      );
      const limite = r < 2 ? (rango?.endColumn ?? 10) : 23;
      const tieneDatos = Object.entries(fila).some(
        ([c, d]) => +c > 0 && +c <= limite && (d.f || valor(d) !== ""),
      );
      for (const c of new Set([
        ...Array.from({ length: 24 }, (_, i) => String(i)),
        ...Object.keys(fila),
      ])) {
        const d = fila[c] || { v: null };
        const base =
          fuente[r]?.[c] ||
          (r < 2 && +c <= limite ? fuente[r]?.[0] : undefined);
        const patron = base
          ? estilo(snapshot, base)
          : r === 2
            ? fuenteCabecera
            : {};
        fila[c] = { ...d, s: structuredClone(patron) };
      }
      if (r < 2 && !tieneDatos)
        mergeData.push({
          startRow: r,
          endRow: r,
          startColumn: 0,
          endColumn: limite,
        });
      else if (r < 2)
        mergeData.push(...(s.mergeData || []).filter((m) => m.startRow === r));
    }
    const nombres = [
      ...new Set(
        Object.entries(cellData)
          .filter(([r, d]) => +r >= 3 && d[0]?.custom?.pdfNomina)
          .map(([, d]) => String(valor(d[0]))),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));
    for (const [r, fila] of Object.entries(cellData)) {
      if (!fila[0]?.custom?.pdfNomina) continue;
      rowData[r] = {
        ...rowData[r],
        h: plantilla.rowData?.[3]?.h || (28 * 4) / 3,
      };
      const mesFila = MESES_NOMINA.findIndex((m) =>
        normal(valor(fila[1])).startsWith(normal(m.slice(0, 3))),
      );
      const alterna =
        tipo === "anual"
          ? (mesFila + 1) % 2 === 0
          : nombres.indexOf(String(valor(fila[0]))) % 2 === 0;
      for (const c of new Set([
        ...Array.from({ length: 24 }, (_, i) => String(i)),
        ...Object.keys(fila),
      ])) {
        const d = fila[c] || { v: null };
        fila[c] = {
          ...d,
          s: {
            ...estilo(snapshot, d),
            bg: { rgb: alterna ? banda : fondo },
          },
        };
      }
    }
    const total = Object.entries(cellData).find(
      ([r, d]) => +r >= 3 && normal(valor(d[0])) === "TOTAL",
    );
    const totalFuente = Object.entries(fuente).find(
      ([r, d]) => +r >= 3 && normal(valor(d[0])) === "TOTAL",
    );
    if (total)
      for (const [c, d] of Object.entries(total[1])) {
        const base = totalFuente?.[1]?.[c];
        total[1][c] = {
          ...d,
          s: base
            ? structuredClone(estilo(snapshot, base))
            : {
                ...estilo(snapshot, d),
                bl: 1,
                ...(+c >= 4 ? { bg: { rgb: "#E6EDF6" } } : {}),
              },
        };
      }
    sheets[id] = { ...s, cellData, rowData, columnData, mergeData };
  }
  for (const [id, s] of Object.entries(sheets)) {
    const esDetalle = detalle(s),
      esAcumulado = /^Acumulado\s+\d{4}$/i.test(s.name);
    if (!esDetalle && !esAcumulado) continue;
    const cellData = Object.fromEntries(
      Object.entries(s.cellData || {}).map(([r, fila]) => [
        r,
        Object.fromEntries(
          Object.entries(fila).map(([c, d]) => {
            const base = estilo(snapshot, d);
            const fs = esDetalle
              ? +r === 0
                ? 16
                : +r === 1
                  ? 13
                  : 11
              : [16, 13].includes(base.fs)
                ? base.fs
                : 11;
            return [c, { ...d, s: { ...base, ff: "Calibri", fs } }];
          }),
        ),
      ]),
    );
    const basePredeterminada =
      typeof s.defaultStyle === "string"
        ? snapshot.styles?.[s.defaultStyle] || {}
        : s.defaultStyle || {};
    sheets[id] = {
      ...s,
      cellData,
      defaultStyle: { ...basePredeterminada, ff: "Calibri", fs: 11 },
    };
  }
  const base =
    typeof snapshot.defaultStyle === "string"
      ? snapshot.styles?.[snapshot.defaultStyle] || {}
      : snapshot.defaultStyle || {};
  return {
    ...snapshot,
    sheets,
    defaultStyle: { ...base, ff: "Calibri", fs: 11 },
  };
}
