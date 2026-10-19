const rutas = new Set([
  "autenticarCuenta",
  "gestionarAcceso",
  "registrarAccesoDenegado",
]);

export async function consultarServidorAcceso(
  base,
  nombre,
  datos,
  token,
  fetchImpl = fetch,
) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !rutas.has(nombre)
  )
    throw Error("La dirección del servidor de acceso no es válida.");
  let respuesta;
  try {
    respuesta = await fetchImpl(new URL(nombre, url).href, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(25000),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw Error(
      "No se pudo conectar con el acceso protegido. Revisa la conexión e intenta de nuevo.",
    );
  }
  let resultado;
  try {
    resultado = await respuesta.json();
  } catch {
    throw Error("El acceso protegido no pudo responder. Intenta de nuevo.");
  }
  if (!respuesta.ok || resultado.error) {
    throw Object.assign(
      Error(resultado.error?.message || "No se pudo completar el acceso."),
      {
        code: `functions/${resultado.error?.code || "unavailable"}`,
        details: resultado.error?.details,
      },
    );
  }
  if (!Object.hasOwn(resultado, "data"))
    throw Error("La respuesta del acceso protegido no es válida.");
  return resultado;
}
