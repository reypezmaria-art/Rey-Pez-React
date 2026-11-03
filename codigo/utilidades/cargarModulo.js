const errorDeCarga = (error) =>
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload/i.test(
    error?.message || "",
  );

export async function cargarModulo(
  cargar,
  reimportar = (url) => import(/* @vite-ignore */ url),
  origen = window.location.origin,
) {
  try {
    return await cargar();
  } catch (error) {
    if (!errorDeCarga(error)) throw error;
    const ruta = error.message.match(/https?:\/\/[^\s"'<>]+/)?.[0];
    if (ruta) {
      const url = new URL(ruta);
      if (url.origin === origen && url.pathname.endsWith(".js")) {
        url.searchParams.set("reintento", String(Date.now()));
        try {
          return await reimportar(url.href);
        } catch {
          // La conexión puede seguir caída o el archivo pertenecer a otra versión.
        }
      }
    }
    const aviso = new Error(
      "No se pudo cargar una parte de Nómina. Comprueba tu conexión y pulsa «Actualizar página» para cargar la versión actual; después vuelve a seleccionar el archivo.",
      { cause: error },
    );
    aviso.codigo = "actualizar-aplicacion";
    throw aviso;
  }
}
