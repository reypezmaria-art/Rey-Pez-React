// Procesamiento secuencial: cada resultado se confirma solo tras persistirlo.
export async function procesarCarpetaNomina(
  archivos,
  { leer, guardar, alProgreso = () => {} },
) {
  const lista = Array.from(archivos || []).sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(
      b.webkitRelativePath || b.name,
      "es",
      { numeric: true },
    ),
  );
  const pdfs = lista.filter((a) => /\.pdf$/i.test(a.name));
  if (!pdfs.length)
    throw Error("La carpeta no contiene archivos PDF de nómina.");
  if (pdfs.length > 100)
    throw Error("Selecciona una carpeta con hasta 100 PDF por carga.");
  if (pdfs.reduce((s, a) => s + a.size, 0) > 200 * 1024 * 1024)
    throw Error(
      "Los PDF de la carpeta superan 200 MB. Divídelos en carpetas más pequeñas.",
    );
  const resultados = [];
  for (let i = 0; i < pdfs.length; i++) {
    const archivo = pdfs[i],
      nombre = archivo.webkitRelativePath || archivo.name;
    alProgreso({ actual: i + 1, total: pdfs.length, archivo: nombre });
    try {
      const entrada = await leer(archivo);
      const cambio = await guardar(entrada);
      resultados.push({
        archivo: nombre,
        estado: cambio ? "Guardado" : "Ya cargado",
        detalle: `${entrada.empresa_nombre} · ${entrada.desde} al ${entrada.hasta}`,
      });
    } catch (error) {
      resultados.push({
        archivo: nombre,
        estado: "No guardado",
        detalle: error.message || "No se pudo procesar el archivo.",
      });
    }
  }
  return { resultados, omitidos: lista.length - pdfs.length };
}
