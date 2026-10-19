import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mensajeFirebase } from "../codigo/firebase/sesion.js";

const require = createRequire(import.meta.url);
const { traducirErrorAcceso } = require("../firebase/funciones/errores.js");

test("los errores de la función conservan el motivo real", () => {
  const permiso = traducirErrorAcceso({
    code: "permission-denied",
    message: "Solo María puede administrar accesos.",
    name: "HttpsError",
  });
  assert.equal(permiso.code, "permission-denied");
  assert.match(permiso.message, /Solo María/);
  const interno = traducirErrorAcceso(
    Object.assign(new Error("boom"), {
      code: "auth/internal-error",
    }),
  );
  assert.equal(interno.code, "internal");
  assert.match(interno.message, /Falló Firebase/);
  assert.equal(
    traducirErrorAcceso({ code: "auth/user-not-found" }).code,
    "not-found",
  );
  assert.equal(mensajeFirebase(permiso).message, permiso.message);
  assert.match(
    mensajeFirebase({ code: "functions/internal", message: "internal" })
      .message,
    /Cloud Functions/,
  );
  assert.match(
    mensajeFirebase({
      code: "functions/invalid-argument",
      message: "La contraseña debe tener al menos 6 caracteres.",
    }).message,
    /6 caracteres/,
  );
  assert.equal(
    mensajeFirebase({ code: "auth/wrong-password", message: "Firebase" })
      .message,
    "ID o contraseña incorrectos.",
  );
});
