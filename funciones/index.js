import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

export const restablecerContrasena = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Método no permitido." });
      return;
    }
    try {
      const token = String(req.get("Authorization") || "").replace(
        /^Bearer\s+/i,
        "",
      );
      const decodificado = await getAuth().verifyIdToken(token);
      const cuenta = await getFirestore()
        .doc(`cuentas/${decodificado.uid}`)
        .get();
      const datos = cuenta.data();
      if (
        datos?.rol !== "admin" ||
        datos?.idEmpleado !== "MARIA" ||
        datos?.activo !== true
      ) {
        res.status(403).json({ error: "Se requiere acceso de María." });
        return;
      }
      const idEmpleado = String(req.body?.idEmpleado || "")
        .trim()
        .toUpperCase();
      const contrasena = String(req.body?.contrasena || "");
      if (!idEmpleado || contrasena.length < 6) {
        res.status(400).json({
          error:
            "Indica el empleado y una contraseña de al menos 6 caracteres.",
        });
        return;
      }
      const indice = await getFirestore()
        .doc(`indiceCuentas/${idEmpleado}`)
        .get();
      if (!indice.exists) {
        res
          .status(404)
          .json({ error: "Ese trabajador todavía no tiene cuenta." });
        return;
      }
      await getAuth().updateUser(indice.data().uid, { password: contrasena });
      res.json({ ok: true });
    } catch {
      res.status(401).json({ error: "No se pudo restablecer la contraseña." });
    }
  },
);
