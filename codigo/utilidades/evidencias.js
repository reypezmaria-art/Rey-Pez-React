export function readEvidence(file, allowPdf = false, opciones = {}) {
  if (!file) return Promise.resolve(null);
  const limiteImagen = opciones.limiteImagen ?? 1000000;
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(allowPdf ? ["application/pdf"] : []),
    ].includes(file.type)
  )
    throw Error("Adjunta JPG, PNG, WEBP o un PDF permitido.");
  const limite = file.type.startsWith("image/") ? limiteImagen : 1000000;
  if (file.size > limite)
    throw Error(
      limite > 1000000
        ? "La foto debe pesar menos de 8 MB. Se comprimirá antes de subirla."
        : "El adjunto debe pesar menos de 1 MB para esta copia local.",
    );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(Error("No se pudo leer el adjunto."));
    reader.readAsDataURL(file);
  });
}
export function enlaceEvidencia(evidence) {
  return evidence?.data || evidence?.url || "";
}
