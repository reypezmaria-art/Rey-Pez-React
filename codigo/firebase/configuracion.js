export const DOMINIO_ACCESO_PREDETERMINADO = "acceso.reypez.app";
export const CLAVE_TERMINAL = "reypez_terminal_vinculada";

function entorno() {
  return import.meta.env ?? {};
}
export function dominioAcceso() {
  return entorno().VITE_AUTH_EMAIL_DOMAIN || DOMINIO_ACCESO_PREDETERMINADO;
}
export function firebaseConfigurado() {
  const env = entorno();
  return Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID,
  );
}
export function configuracionFirebase() {
  const env = entorno();
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  if (env.VITE_FIREBASE_MEASUREMENT_ID)
    config.measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;
  return config;
}
