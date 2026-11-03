export function prepararDescarga(bytes, nombre, tipo) {
  if (!(bytes instanceof Uint8Array || bytes instanceof ArrayBuffer))
    throw Error("No se pudo preparar el archivo para descargar.");
  const seguro = String(nombre || "Nomina.xlsx")
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 200);
  return {
    url: URL.createObjectURL(
      new Blob([bytes], {
        type:
          tipo ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ),
    nombre: seguro,
  };
}
export function iniciarDescarga(archivo) {
  const enlace = document.createElement("a");
  enlace.href = archivo.url;
  enlace.download = archivo.nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
}
