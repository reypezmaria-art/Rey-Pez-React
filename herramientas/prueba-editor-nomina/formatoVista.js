import ExcelJS from "exceljs";
import { importar } from "./conversion.js";
import { exportarCompleto } from "./exportacionCompleta.js";
import { darFormatoAcumulado } from "../../codigo/utilidades/formatoAcumulado.js";

// Se transforma únicamente la presentación de Acumulado. El resto del libro,
// sus identificadores y recursos permanecen en el snapshot original.
export async function prepararAcumulado(snapshot) {
  const id = snapshot.sheetOrder.find((id) =>
    /^Acumulado\s+\d{4}$/i.test(snapshot.sheets[id].name),
  );
  if (!id) return snapshot;
  const original = snapshot.sheets[id];
  const uno = {
    ...snapshot,
    sheetOrder: [id],
    sheets: { [id]: original },
    resources: [],
  };
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await exportarCompleto(uno));
  darFormatoAcumulado(libro.worksheets[0]);
  const conversion = await importar(
    await libro.xlsx.writeBuffer(),
    snapshot.name || "Nomina.xlsx",
  );
  const estilo = conversion.snapshot.sheets[conversion.snapshot.sheetOrder[0]];
  return {
    ...snapshot,
    sheets: { ...snapshot.sheets, [id]: { ...original, ...estilo, id } },
  };
}
