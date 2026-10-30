import JSZip from "jszip";

export function claveLibroNomina({ empresa, anio, tipo }) {
  if (
    !["ALLAN", "EDGAR", "ESTUARDO"].includes(empresa) ||
    !Number.isInteger(anio) ||
    anio < 2000 ||
    anio > 2100 ||
    !["mensual", "anual"].includes(tipo)
  )
    throw Error("Selecciona empresa, año y tipo de libro válidos.");
  return `${empresa}_${anio}_${tipo}`;
}
export async function empaquetarLibro({ snapshot, bytes, nombre, fuente }) {
  if (
    !snapshot?.sheetOrder?.length ||
    snapshot.sheetOrder.length > 100 ||
    !snapshot.sheets
  )
    throw Error("El libro no contiene hojas válidas.");
  const json = JSON.stringify(snapshot);
  if (json.length > 15000000)
    throw Error(
      "El libro supera el tamaño admitido. Divide la información en varios libros.",
    );
  const zip = new JSZip();
  if (fuente) zip.file("fuente.json", JSON.stringify(fuente));
  zip.file("hojas.json", json);
  zip.file("original.xlsx", bytes);
  zip.file("nombre.txt", String(nombre).slice(0, 200));
  const carga = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  if (carga.length > 750000)
    throw Error(
      "El libro es demasiado grande para el guardado gratuito. No se guardó ningún cambio; descarga una copia y divide el archivo.",
    );
  return carga;
}
export async function desempaquetarLibro(carga) {
  if (typeof carga !== "string" || carga.length > 750000)
    throw Error("El libro guardado no es válido.");
  const zip = await JSZip.loadAsync(carga, { base64: true });
  const datos = zip.file("hojas.json"),
    original = zip.file("original.xlsx"),
    nombre = zip.file("nombre.txt");
  if (!datos || !original || !nombre)
    throw Error("El libro guardado está incompleto.");
  const json = await datos.async("string");
  if (json.length > 15000000)
    throw Error("El libro supera el tamaño admitido.");
  return {
    fuente: zip.file("fuente.json")
      ? JSON.parse(await zip.file("fuente.json").async("string"))
      : null,
    snapshot: JSON.parse(json),
    bytes: await original.async("uint8array"),
    nombre: await nombre.async("string"),
  };
}
