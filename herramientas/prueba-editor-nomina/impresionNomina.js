import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const texto = (d) =>
  String(d?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? d?.v ?? "");
const color = [23, 57, 87];
export function crearPdfImpresion(snapshot, ids = [snapshot.sheetOrder[0]]) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter",
  });
  let primera = true;
  for (const id of ids) {
    const hoja = snapshot.sheets[id];
    if (!hoja) throw Error("La hoja seleccionada ya no existe.");
    const filas = Object.entries(hoja.cellData || {})
      .map(([r, celdas]) => [+r, celdas])
      .filter(([, fila]) =>
        Object.values(fila).some((d) => texto(d).trim() || d.f),
      )
      .sort((a, b) => a[0] - b[0]);
    if (!filas.length) continue;
    if (!primera) doc.addPage("letter", "landscape");
    primera = false;
    const detalle = texto(hoja.cellData?.[2]?.[0]) === "NOMBRE";
    const cabecera = detalle
      ? 2
      : filas.find(
          ([r, fila]) =>
            r >= 2 &&
            Object.values(fila).filter((d) => texto(d).trim()).length > 1,
        )?.[0];
    if (cabecera === undefined)
      throw Error("La hoja no tiene una tabla con encabezados para imprimir.");
    const cols = [
      ...new Set(
        filas
          .filter(([r]) => r >= cabecera)
          .flatMap(([, fila]) =>
            Object.entries(fila)
              .filter(([, d]) => texto(d).trim() || d.f)
              .map(([c]) => Number(c)),
          ),
      ),
    ].sort((a, b) => a - b);
    if (!cols.length) continue;
    if (cols.length > 200 || filas.length * cols.length > 100000)
      throw Error(
        "La hoja es demasiado grande para esta impresión. Divide los datos en hojas más pequeñas.",
      );
    const resolver = (s) =>
      typeof s === "string" ? snapshot.styles?.[s] || {} : s || {};
    const cuerpo = filas
      .filter(([r]) => r > cabecera)
      .map(([r, fila]) =>
        cols.map((c) => {
          const d = fila[c],
            estilo = {
              ...resolver(snapshot.defaultStyle),
              ...resolver(hoja.defaultStyle),
              ...resolver(hoja.columnData?.[c]?.s),
              ...resolver(hoja.rowData?.[r]?.s),
              ...resolver(d?.s),
            };
          const valor = d?.v;
          const contenido =
            typeof valor === "number" && estilo.n?.pattern?.includes("$")
              ? valor.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })
              : texto(d);
          return {
            content: contenido,
            styles: { halign: typeof valor === "number" ? "right" : "left" },
          };
        }),
      );
    const anchos = Object.fromEntries(
      cols.map((c, i) => [
        i,
        {
          cellWidth:
            i === 0
              ? detalle
                ? 62
                : 32
              : detalle && i === 1
                ? 25
                : detalle && (i === 2 || i === 3)
                  ? 32
                  : 27,
        },
      ]),
    );
    autoTable(doc, {
      startY: 36,
      margin: { top: 36, bottom: 14, left: 10, right: 10 },
      head: [
        cols.map(
          (c) => texto(hoja.cellData[cabecera][c]) || `Columna ${c + 1}`,
        ),
      ],
      body: cuerpo,
      columnStyles: anchos,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2,
        textColor: color,
        overflow: "linebreak",
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [220, 229, 239],
      },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 245, 251] },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: detalle ? [0, 1] : [0],
      horizontalPageBreakBehaviour: "afterAllRows",
      rowPageBreak: "avoid",
      didParseCell(data) {
        if (data.section !== "body") return;
        const total = /^TOTAL(?:\s|$)/i.test(
          cuerpo[data.row.index]?.[0]?.content || "",
        );
        if (total) {
          data.cell.styles.fillColor = color;
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
        } else if (data.column.index === 0) data.cell.styles.fontStyle = "bold";
      },
      willDrawPage() {
        doc.setFillColor(...color);
        doc.rect(10, 8, 259.4, 11, "F");
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(
          doc.splitTextToSize(
            texto(hoja.cellData?.[0]?.[0]) || snapshot.name || "Nómina",
            250,
          )[0],
          13,
          15,
        );
        doc.setFillColor(244, 230, 189);
        doc.rect(10, 19, 259.4, 10, "F");
        doc.setTextColor(...color);
        doc.setFontSize(9);
        doc.text(
          `${hoja.name} · ${texto(hoja.cellData?.[1]?.[0])}`.slice(0, 155),
          13,
          25,
        );
      },
    });
  }
  if (primera) throw Error("No hay datos para imprimir.");
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setTextColor(...color);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Página ${n} de ${total} · Carta horizontal`, 269, 209, {
      align: "right",
    });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
