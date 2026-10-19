let HttpsError;
try {
  ({ HttpsError } = require("firebase-functions/v2/https"));
} catch {
  HttpsError = class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  };
}

function traducirErrorAcceso(error) {
  if (error instanceof HttpsError || error?.name === "HttpsError") return error;
  const codigo = String(error?.code || "");
  if (codigo === "auth/user-not-found")
    return new HttpsError("not-found", "No existe esa cuenta.");
  if (codigo === "auth/email-already-exists")
    return new HttpsError("already-exists", "Esa cuenta ya existe.");
  if (codigo === "auth/invalid-password" || codigo === "auth/weak-password")
    return new HttpsError(
      "invalid-argument",
      "La contraseña debe tener al menos 6 caracteres.",
    );
  if (codigo === "auth/invalid-email")
    return new HttpsError("invalid-argument", "El ID no es un correo válido.");
  console.error(error);
  return new HttpsError(
    "internal",
    "Falló Firebase al administrar el acceso. El cambio no se aplicó.",
  );
}

module.exports = { traducirErrorAcceso };
