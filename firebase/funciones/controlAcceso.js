const { randomUUID } = require("node:crypto");

function fallo(code, message, details) {
  return Object.assign(new Error(message), {
    code,
    details,
    controlAcceso: true,
  });
}
function crearControlAcceso({
  db,
  auth,
  verificar,
  desactivarAuth = true,
  ahora = () => new Date().toISOString(),
}) {
  return async function autenticar(id, contrasena, email) {
    if (
      typeof contrasena !== "string" ||
      !contrasena ||
      contrasena.length > 4096
    )
      throw fallo("invalid-argument", "Escribe tu ID y contraseña.");
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === "auth/user-not-found")
        throw fallo("unauthenticated", "ID o contraseña incorrectos.");
      throw error;
    }
    const ref = db.doc(`controlAccesos/${id}`);
    const cuenta = await db
      .doc(id === "MARIA" ? "acceso/admin" : `usuarios/${user.uid}`)
      .get();
    const habilitada =
      id === "MARIA"
        ? cuenta.data()?.uid === user.uid
        : cuenta.data()?.rol === "trabajador" &&
          cuenta.data()?.idEmpleado === id;
    if (!habilitada)
      throw fallo("unauthenticated", "ID o contraseña incorrectos.");
    const control = await ref.get();
    const bloqueado = () =>
      fallo(
        "permission-denied",
        "Demasiados intentos. Comunícate con el personal autorizado.",
        { bloqueado: true },
      );
    if (user.disabled || control.data()?.bloqueado) throw bloqueado();
    const correcto = await verificar(email, contrasena, user.uid);
    const alertaId = randomUUID();
    const resultado = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.data()?.bloqueado) return { bloqueado: true };
      const intentos = correcto ? 0 : (snap.data()?.intentos || 0) + 1;
      const bloqueado = intentos >= 4;
      const empleado =
        bloqueado && id !== "MARIA"
          ? (await tx.get(db.doc(`empleados/${id}`))).data() || {}
          : {};
      tx.set(
        ref,
        {
          idEmpleado: id,
          uid: user.uid,
          intentos,
          bloqueado,
          actualizado: ahora(),
        },
        { merge: true },
      );
      if (bloqueado) {
        if (id !== "MARIA")
          tx.set(
            db.doc(`usuarios/${user.uid}`),
            { activo: false, bloqueoAutomatico: true },
            { merge: true },
          );
        tx.set(db.doc(`alertasSeguridad/${alertaId}`), {
          id_alerta: alertaId,
          id_empleado: id,
          nombre_completo: empleado.nombre_completo || id,
          empresa_codigo: empleado.empresa_codigo || "",
          tipo: "Cuenta bloqueada",
          modulo: "acceso",
          seguridad: true,
          detalle:
            "Cuatro intentos fallidos sobre esta cuenta. Requiere desbloqueo administrativo.",
          fecha_hora: ahora(),
          estado: "Pendiente",
        });
      }
      return { bloqueado };
    });
    if (resultado.bloqueado) {
      // Firestore ya deniega la cuenta aunque la actualización de Auth se interrumpa.
      if (desactivarAuth)
        await Promise.allSettled([
          auth.updateUser(user.uid, { disabled: true }),
          auth.revokeRefreshTokens(user.uid),
        ]);
      throw bloqueado();
    }
    if (!correcto)
      throw fallo("unauthenticated", "ID o contraseña incorrectos.");
    return {
      token: await auth.createCustomToken(user.uid, { accesoControlado: true }),
    };
  };
}
module.exports = { crearControlAcceso };
