import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { localDate, formatDateTime } from "./fechas.js";
import { areaLabel } from "../datos/listasRevision.js";
export function withinRange(value, from, to) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    ? value
    : localDate(new Date(value));
  return date >= from && date <= to;
}
export function reportRows(data, records, kind, from, to) {
  if (!from || !to || from > to)
    throw Error(
      "Selecciona un rango válido: Desde debe ser anterior o igual a Hasta.",
    );
  return records
    .filter((r) =>
      withinRange(
        kind === "attendance" ? r.fecha_hora || r.date : r.when,
        from,
        to,
      ),
    )
    .map((r) => {
      if (kind === "attendance")
        return [
          r.fecha_hora ? formatDateTime(r.fecha_hora) : r.date,
          `${r.id_empleado || r.employeeId}\n${r.nombre_completo || r.name}`,
          r.empresa_codigo ||
            data.employees.find(
              (e) => e.id_empleado === (r.id_empleado || r.employeeId),
            )?.empresa_codigo ||
            "—",
          (r.movimiento || r.classification || "Revisión").replaceAll("_", " "),
          [r.incidencia, r.notes || r.motivo, r.by ? `Revisó: ${r.by}` : ""]
            .filter(Boolean)
            .join("\n") || "—",
        ];
      const area = data.areas.concat(data.rooms).find((a) => a.id === r.area);
      const result = r.checks?.length
        ? r.checks
            .map(
              (c) =>
                `${c.label}: ${c.status === "yes" ? "Cumplió" : "No cumplió"}${c.reason ? `\nMotivo: ${c.reason}` : ""}`,
            )
            .join("\n")
        : r.type === "temperature" && !r.notApplicable
          ? `${r.value} °C · ${r.result}`
          : r.result || String(r.value || "");
      return [
        formatDateTime(r.when),
        area ? areaLabel(area, r.type) : r.area,
        r.subjectName || r.performedBy || "—",
        result,
        [r.notes, r.expiry ? `Vence: ${r.expiry}` : ""]
          .filter(Boolean)
          .join("\n") || "—",
        r.responsible || "—",
      ];
    });
}
export function downloadReport({
  data,
  records,
  kind,
  title,
  company,
  from,
  to,
}) {
  const rows = reportRows(data, records, kind, from, to);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFontSize(17);
  pdf.text("Rey Pez", 14, 16);
  pdf.setFontSize(12);
  pdf.text(title, 14, 24);
  pdf.setFontSize(10);
  pdf.text(
    `Empresa: ${company} | Desde: ${from} | Hasta: ${to} | Registros: ${rows.length}`,
    14,
    32,
  );
  autoTable(pdf, {
    startY: 39,
    head: [
      kind === "attendance"
        ? [
            "Fecha y hora",
            "Empleado",
            "Empresa",
            "Movimiento / revisión",
            "Incidencia / motivo",
          ]
        : [
            "Fecha y hora",
            "Lugar / área",
            kind === "chlorine" ? "Realizó" : "Empleado / realizó",
            kind === "chlorine"
              ? "Valores de cloro en agua"
              : "Resultado / elementos revisados",
            "Observaciones",
            "Revisó",
          ],
    ],
    body: rows.length
      ? rows
      : [
          [
            {
              content: "Sin registros en este período.",
              colSpan: kind === "attendance" ? 5 : 6,
            },
          ],
        ],
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [13, 72, 106] },
    margin: { bottom: 17 },
    didDrawPage: () => {
      pdf.setFontSize(9);
      pdf.text(
        `Rey Pez · ${title} · Página ${pdf.getNumberOfPages()}`,
        14,
        202,
      );
    },
  });
  pdf.save(`${kind}_${company}_${from}_${to}.pdf`);
  return rows.length;
}
