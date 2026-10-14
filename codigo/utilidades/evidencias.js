export function readEvidence(file, allowPdf = false) {
  if (!file) return Promise.resolve(null);
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(allowPdf ? ["application/pdf"] : []),
    ].includes(file.type)
  )
    throw Error("Adjunta JPG, PNG, WEBP o un PDF permitido.");
  if (file.size > 1000000)
    throw Error("El adjunto debe pesar menos de 1 MB para esta copia local.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(Error("No se pudo leer el adjunto."));
    reader.readAsDataURL(file);
  });
}
