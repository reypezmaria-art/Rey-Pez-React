const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { traducirErrorAcceso } = require("./errores");

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
    await db
      .doc(`usuarios/${user.uid}`)
      .set({ rol: "trabajador", idEmpleado, activo: true }, { merge: true });
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
    await db.doc(`usuarios/${user.uid}`).set({ activo }, { merge: true });
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
