function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(Error("No se pudo preparar la foto."));
    imagen.src = dataUrl;
  });
}

export async function comprimirEvidencia(evidence) {
  if (!evidence?.data?.startsWith("data:image/")) return evidence;
  if (typeof document === "undefined") return evidence;
  const imagen = await cargarImagen(evidence.data);
  const maximo = 1600;
  const escala = Math.min(
    1,
    maximo / Math.max(imagen.width || 1, imagen.height || 1),
  );
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round((imagen.width || 1) * escala));
  lienzo.height = Math.max(1, Math.round((imagen.height || 1) * escala));
  const contexto = lienzo.getContext("2d");
  if (!contexto) return evidence;
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  let calidad = 0.72;
  let data = lienzo.toDataURL("image/jpeg", calidad);
  while (data.length > 450000 && calidad > 0.45) {
    calidad -= 0.08;
    data = lienzo.toDataURL("image/jpeg", calidad);
  }
  const nombre = String(evidence.name || "evidencia").replace(/\.\w+$/, "");
  return { ...evidence, name: `${nombre}.jpg`, type: "image/jpeg", data };
}
