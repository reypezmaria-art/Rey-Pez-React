export const CLAVES_FIREBASE = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const activo = (valor) => /^(1|true|si|sí)$/i.test(String(valor || "").trim());

export function leerConfiguracionFirebase(env = import.meta.env ?? {}) {
  const origen = env || {};
  const valores = Object.fromEntries(
    CLAVES_FIREBASE.map((clave) => [clave, String(origen[clave] ?? "").trim()]),
  );
  const presentes = CLAVES_FIREBASE.filter((clave) => valores[clave]);
  if (!presentes.length) return null;
  if (presentes.length < CLAVES_FIREBASE.length) {
    return {
      incompleta: true,
      faltantes: CLAVES_FIREBASE.filter((clave) => !valores[clave]),
    };
  }
  return {
    incompleta: false,
    firebase: {
      apiKey: valores.VITE_FIREBASE_API_KEY,
      authDomain: valores.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: valores.VITE_FIREBASE_PROJECT_ID,
      storageBucket: valores.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: valores.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: valores.VITE_FIREBASE_APP_ID,
    },
    dominioCorreo: String(
      origen.VITE_FIREBASE_AUTH_EMAIL_DOMAIN || "usuarios.reypez.local",
    )
      .trim()
      .toLowerCase(),
    emulador: activo(origen.VITE_FIREBASE_EMULADOR),
    authEmulatorUrl:
      origen.VITE_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099",
    firestoreEmuladorHost:
      origen.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1",
    firestoreEmuladorPuerto: Number(
      origen.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080,
    ),
    storageEmuladorHost:
      origen.VITE_FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1",
    storageEmuladorPuerto: Number(
      origen.VITE_FIREBASE_STORAGE_EMULATOR_PORT || 9199,
    ),
    funcionContrasena: String(
      origen.VITE_FIREBASE_FUNCION_CONTRASENA || "",
    ).trim(),
  };
}

export function correoDeIdentificador(id, dominio) {
  const local = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!local || !dominio || local.length > 64)
    throw Error(
      "No se pudo derivar el correo de ese identificador. Revisa el ID y VITE_FIREBASE_AUTH_EMAIL_DOMAIN.",
    );
  return `${local}@${dominio}`;
}
