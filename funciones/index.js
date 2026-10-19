import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { responderRestablecer } from "./restablecer.js";

initializeApp();

export const restablecerContrasena = onRequest(
  { cors: true },
  async (req, res) => {
    const resultado = await responderRestablecer(
      {
        method: req.method,
        token: req.get("Authorization") || "",
        body: req.body,
      },
      {
        verificarToken: (token) => getAuth().verifyIdToken(token),
        leerCuenta: async (uid) =>
          (await getFirestore().doc(`cuentas/${uid}`).get()).data(),
        leerIndice: async (idEmpleado) => {
          const indice = await getFirestore()
            .doc(`indiceCuentas/${idEmpleado}`)
            .get();
          return indice.exists ? indice.data() : null;
        },
        actualizarContrasena: (uid, contrasena) =>
          getAuth().updateUser(uid, { password: contrasena }),
      },
    );
    if (resultado.status === 204) {
      res.status(204).send("");
      return;
    }
    res.status(resultado.status).json(resultado.body);
  },
);
