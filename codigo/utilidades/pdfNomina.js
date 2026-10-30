import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { extraerNomina } from "../dominio/extraerNomina.js";
GlobalWorkerOptions.workerSrc = workerUrl;
export async function leerPdfNomina(archivo, aliases = {}) {
  if (
    !archivo ||
    !/\.pdf$/i.test(archivo.name) ||
    archivo.size === 0 ||
    archivo.size > 15 * 1024 * 1024
  )
    throw Error("Selecciona un PDF de nómina de hasta 15 MB.");
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw Error("El archivo no es un PDF válido.");
  const huella = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const tarea = getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: true,
  });
  try {
    const pdf = await tarea.promise;
    if (pdf.numPages > 100)
      throw Error("El PDF supera las 100 páginas permitidas.");
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const texto = await pagina.getTextContent();
      paginas.push({
        ancho: pagina.getViewport({ scale: 1 }).width,
        items: texto.items,
      });
    }
    return {
      ...extraerNomina(paginas, aliases),
      archivo: archivo.name.slice(0, 200),
      huella,
    };
  } catch (err) {
    if (err.name === "PasswordException")
      throw Error("El PDF tiene contraseña. Sube una copia sin protección.", {
        cause: err,
      });
    if (
      err.message?.includes("PDF") ||
      err.message?.includes("nómina") ||
      err.message?.includes("trabajador") ||
      err.message?.includes("totales") ||
      err.message?.includes("período")
    )
      throw err;
    throw Error(
      "No se pudo leer el PDF. Sube el reporte original con texto seleccionable; los documentos escaneados no se importan.",
      { cause: err },
    );
  } finally {
    await tarea.destroy();
  }
}
