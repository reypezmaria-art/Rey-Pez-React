export async function responderRestablecer(solicitud, servicios) {
  if (solicitud.method === "OPTIONS") return { status: 204, body: "" };
  if (solicitud.method !== "POST")
    return { status: 405, body: { error: "Método no permitido." } };
  const token = String(solicitud.token || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return { status: 401, body: { error: "Falta el token de sesión." } };
  let decodificado;
  try {
    decodificado = await servicios.verificarToken(token);
  } catch {
    return { status: 401, body: { error: "La sesión no es válida." } };
  }
  try {
    const datos = await servicios.leerCuenta(decodificado.uid);
    if (
      datos?.rol !== "admin" ||
      datos?.idEmpleado !== "MARIA" ||
      datos?.activo !== true
    )
      return { status: 403, body: { error: "Se requiere acceso de María." } };
    const idEmpleado = String(solicitud.body?.idEmpleado || "")
      .trim()
      .toUpperCase();
    const contrasena = String(solicitud.body?.contrasena || "");
    if (!idEmpleado || contrasena.length < 6)
      return {
        status: 400,
        body: {
          error:
            "Indica el empleado y una contraseña de al menos 6 caracteres.",
        },
      };
    const indice = await servicios.leerIndice(idEmpleado);
    if (!indice?.uid)
      return {
        status: 404,
        body: { error: "Ese trabajador todavía no tiene cuenta." },
      };
    await servicios.actualizarContrasena(indice.uid, contrasena);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    if (error?.code === "auth/user-not-found")
      return {
        status: 404,
        body: { error: "Ese trabajador todavía no tiene cuenta." },
      };
    if (
      error?.code === "auth/weak-password" ||
      error?.code === "auth/invalid-password"
    )
      return {
        status: 400,
        body: { error: "La contraseña no cumple los requisitos." },
      };
    return {
      status: 500,
      body: { error: "No se pudo restablecer la contraseña." },
    };
  }
}
