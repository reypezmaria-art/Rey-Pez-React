const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { traducirErrorAcceso } = require("./errores");
const { crearControlAcceso } = require("./controlAcceso");

initializeApp();

const DOMINIO = process.env.AUTH_EMAIL_DOMAIN || "acceso.reypez.app";

function correo(id) {
  const local = String(id || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(local))
    throw new HttpsError(
      "invalid-argument",
      "El ID contiene caracteres que no se pueden usar como cuenta.",
    );
  return `${local}@${DOMINIO}`;
}
async function exigirAdmin(request) {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Inicia sesión como María.");
  const admin = await getFirestore().doc("acceso/admin").get();
  const control = await getFirestore().doc("controlAccesos/MARIA").get();
  if (control.data()?.bloqueado)
    throw new HttpsError(
      "permission-denied",
      "La cuenta de administración está bloqueada.",
    );
  if (!admin.exists || admin.get("uid") !== request.auth.uid)
    throw new HttpsError(
      "permission-denied",
      "Solo María puede administrar accesos.",
    );
}
async function usuarioPorCorreo(email) {
  try {
    return await getAuth().getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function ejecutar(request) {
  await exigirAdmin(request);
  const datos = request.data || {};
  const accion = datos.accion;
  const auth = getAuth();
  const db = getFirestore();

  if (accion === "vincularTerminal" || accion === "desvincularTerminal") {
    if (!datos.deviceId)
      throw new HttpsError(
        "invalid-argument",
        "Falta el identificador del equipo.",
      );
    const email = correo(`terminal-${datos.deviceId}`);
    if (accion === "desvincularTerminal") {
      const user = await usuarioPorCorreo(email);
      if (user) {
        await auth.updateUser(user.uid, { disabled: true });
        await db
          .doc(`usuarios/${user.uid}`)
          .set({ activo: false }, { merge: true });
      }
      return { ok: true };
    }
    let user = await usuarioPorCorreo(email);
    if (!user)
      user = await auth.createUser({
        email,
        password: `${crypto.randomUUID()}Aa1`,
      });
    else if (user.disabled)
      await auth.updateUser(user.uid, { disabled: false });
    await auth.setCustomUserClaims(user.uid, {
      rol: "terminal",
      deviceId: datos.deviceId,
    });
    await db.doc(`usuarios/${user.uid}`).set(
      {
        rol: "terminal",
        deviceId: datos.deviceId,
        nombre: datos.nombre || "Terminal",
        tipo: datos.tipo || "asistencia",
        activo: true,
      },
      { merge: true },
    );
    const token = await auth.createCustomToken(user.uid, { rol: "terminal" });
    return { token };
  }

  const idEmpleado = String(datos.idEmpleado || "")
    .trim()
    .toUpperCase();
  if (!idEmpleado)
    throw new HttpsError("invalid-argument", "Selecciona un empleado.");
  const email = correo(idEmpleado);

  if (["set", "reset", "change"].includes(accion)) {
    const contrasena = String(datos.contrasena || "");
    if (contrasena.length < 6)
      throw new HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres.",
      );
    let user = await usuarioPorCorreo(email);
    if (!user) user = await auth.createUser({ email, password: contrasena });
    else
      await auth.updateUser(user.uid, {
        password: contrasena,
        disabled: false,
      });
    await db.doc(`usuarios/${user.uid}`).set(
      {
        rol: "trabajador",
        idEmpleado,
        activo: true,
        bloqueoAutomatico: false,
      },
      { merge: true },
    );
    await db.doc(`controlAccesos/${idEmpleado}`).set(
      {
        intentos: 0,
        bloqueado: false,
        desbloqueadoPor: request.auth.uid,
        actualizado: new Date().toISOString(),
      },
      { merge: true },
    );
    await auth.revokeRefreshTokens(user.uid);
    return { uid: user.uid };
  }

  if (accion === "enable" || accion === "block") {
    const user = await usuarioPorCorreo(email);
    if (!user)
      throw new HttpsError(
        "failed-precondition",
        "Ese empleado aún no tiene contraseña.",
      );
    const activo = accion === "enable";
    await auth.updateUser(user.uid, { disabled: !activo });
    await db
      .doc(`usuarios/${user.uid}`)
      .set({ activo, bloqueoAutomatico: false }, { merge: true });
    await db.doc(`controlAccesos/${idEmpleado}`).set(
      {
        intentos: 0,
        bloqueado: !activo,
        desbloqueadoPor: request.auth.uid,
        actualizado: new Date().toISOString(),
      },
      { merge: true },
    );
    if (!activo) await auth.revokeRefreshTokens(user.uid);
    return { uid: user.uid };
  }

  throw new HttpsError("invalid-argument", "Acción no reconocida.");
}

exports.gestionarAcceso = onCall(async (request) => {
  try {
    return await ejecutar(request);
  } catch (error) {
    throw traducirErrorAcceso(error);
  }
});

exports.autenticarCuenta = onCall(async (request) => {
  const id = String(request.data?.id || "")
    .trim()
    .toUpperCase();
  const email = correo(id);
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey)
    throw new HttpsError(
      "failed-precondition",
      "Falta publicar la configuración del acceso protegido en Firebase.",
    );
  const autenticar = crearControlAcceso({
    db: getFirestore(),
    auth: getAuth(),
    verificar: async (email, password, uid) => {
      let respuesta;
      try {
        respuesta = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            signal: AbortSignal.timeout(15000),
          },
        );
      } catch {
        throw new HttpsError(
          "unavailable",
          "No se pudo verificar el acceso. Intenta de nuevo.",
        );
      }
      const datos = await respuesta.json();
      if (respuesta.ok) {
        const token = await getAuth().verifyIdToken(datos.idToken);
        if (token.uid !== uid)
          throw new HttpsError(
            "unauthenticated",
            "ID o contraseña incorrectos.",
          );
        return true;
      }
      const causa = datos.error?.message;
      if (
        [
          "INVALID_PASSWORD",
          "INVALID_LOGIN_CREDENTIALS",
          "EMAIL_NOT_FOUND",
        ].includes(causa)
      )
        return false;
      if (causa === "USER_DISABLED")
        throw new HttpsError(
          "permission-denied",
          "Comunícate con el personal autorizado.",
          { bloqueado: true },
        );
      throw new HttpsError(
        "unavailable",
        "Firebase no pudo verificar la contraseña. Intenta de nuevo más tarde.",
      );
    },
  });
  try {
    return await autenticar(id, request.data?.contrasena, email);
  } catch (error) {
    if (error.controlAcceso)
      throw new HttpsError(error.code, error.message, error.details);
    if (error instanceof HttpsError) throw error;
    // No registrar contraseñas ni respuestas de autenticación.
    throw new HttpsError(
      "internal",
      "No se pudo completar el acceso protegido.",
    );
  }
});

exports.registrarAccesoDenegado = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
  const db = getFirestore();
  const ficha = await db.doc(`usuarios/${request.auth.uid}`).get();
  if (ficha.get("rol") !== "trabajador" || ficha.get("activo") !== true)
    throw new HttpsError("permission-denied", "La cuenta no está activa.");
  const idEmpleado = ficha.get("idEmpleado");
  const modulo = String(request.data?.modulo || "").slice(0, 150);
  const config = (await db.doc("operacion/config").get()).data() || {};
  const permiso = config.permissions?.[idEmpleado];
  const empleado = (await db.doc(`empleados/${idEmpleado}`).get()).data() || {};
  const cuarto = (config.rooms || []).find((a) => a.id === modulo);
  const area = cuarto || (config.areas || []).find((a) => a.id === modulo);
  const empresaValida = permiso?.company === empleado.empresa_codigo;
  const autorizado =
    empresaValida &&
    area &&
    area.active !== false &&
    permiso?.company === area.company &&
    (cuarto ? permiso.logs?.includes("temperature") : permiso.logs?.length > 0);
  if (
    autorizado ||
    (modulo === "bitacoras" && empresaValida && permiso?.logs?.length)
  )
    return { registrado: false };
  const id = crypto
    .createHash("sha256")
    .update(`${request.auth.uid}:${modulo}:${Math.floor(Date.now() / 10000)}`)
    .digest("hex");
  await db.doc(`alertasSeguridad/${id}`).set({
    id_alerta: id,
    id_empleado: idEmpleado,
    nombre_completo: empleado.nombre_completo || idEmpleado,
    empresa_codigo: empleado.empresa_codigo || "",
    seguridad: true,
    tipo: "Acceso denegado",
    modulo,
    detalle: "Intento de abrir una sección sin autorización.",
    fecha_hora: new Date().toISOString(),
    estado: "Pendiente",
  });
  return { registrado: true };
});
