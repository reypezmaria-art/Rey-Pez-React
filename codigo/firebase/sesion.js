import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { correoDeCuenta } from "../repositorios/estadoFirebase.js";
import {
  CLAVE_TERMINAL,
  configuracionFirebase,
  dominioAcceso,
  firebaseConfigurado,
} from "./configuracion.js";

const MENSAJES = {
  "auth/invalid-credential": "ID o contraseña incorrectos.",
  "auth/wrong-password": "ID o contraseña incorrectos.",
  "auth/user-not-found": "ID o contraseña incorrectos.",
  "auth/invalid-email": "ID o contraseña incorrectos.",
  "auth/email-already-in-use": "La administración ya está configurada.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
  "auth/requires-recent-login":
    "Vuelve a ingresar y cambia la contraseña otra vez.",
  "auth/user-disabled": "La cuenta no está activa. Consulta a administración.",
  "auth/operation-not-allowed":
    "En Firebase abre Authentication y activa Correo electrónico/contraseña.",
  "auth/configuration-not-found":
    "En Firebase abre Authentication, pulsa Comenzar y activa Correo electrónico/contraseña.",
};
let servicios;

export function mensajeFirebase(error) {
  const bruto = String(error?.message || "");
  const embebido = bruto.match(/auth\/[a-z0-9-]+/i)?.[0] || "";
  const codigo = error?.code || embebido;
  if (String(codigo).startsWith("functions/")) {
    const texto = bruto
      .replace(/^Firebase:\s*/i, "")
      .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
      .trim();
    if (texto && !/^(internal|error)$/i.test(texto)) return Error(texto);
    return Error(
      "La función no completó la acción. Revisa el registro de Cloud Functions.",
    );
  }
  if (MENSAJES[codigo]) return Error(MENSAJES[codigo]);
  if (/CONFIGURATION_NOT_FOUND/i.test(bruto))
    return Error(MENSAJES["auth/configuration-not-found"]);
  const texto = bruto.replace(/^Firebase:\s*/i, "");
  if (texto && !/^Error \(auth\//.test(texto)) return Error(texto);
  return Error("No se pudo completar el acceso.");
}
export function terminalVinculada() {
  return localStorage.getItem(CLAVE_TERMINAL) === "1";
}
export function obtenerServicios() {
  if (!firebaseConfigurado())
    throw Error("Falta la configuración de Firebase en .env.");
  if (servicios) return servicios;
  const existente = getApps().find((app) => app.name === "[DEFAULT]");
  const app = existente || initializeApp(configuracionFirebase());
  servicios = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
  return servicios;
}
function authSecundaria() {
  const nombre = "verificacion-rey-pez";
  const existente = getApps().find((app) => app.name === nombre);
  const app = existente || initializeApp(configuracionFirebase(), nombre);
  return getAuth(app);
}
export function uidActual() {
  if (!firebaseConfigurado()) return null;
  return obtenerServicios().auth.currentUser?.uid || null;
}
export async function prepararPersistencia() {
  const { auth } = obtenerServicios();
  await setPersistence(
    auth,
    terminalVinculada() ? browserLocalPersistence : browserSessionPersistence,
  );
}
export async function crearCuentaMaria(password) {
  if (password.length < 6)
    throw Error("La contraseña debe tener al menos 6 caracteres.");
  const { auth } = obtenerServicios();
  await prepararPersistencia();
  const correo = correoDeCuenta("MARIA", dominioAcceso());
  try {
    const credencial = await createUserWithEmailAndPassword(
      auth,
      correo,
      password,
    );
    return credencial.user.uid;
  } catch (error) {
    if (error?.code !== "auth/email-already-in-use")
      throw mensajeFirebase(error);
  }
  try {
    const credencial = await signInWithEmailAndPassword(auth, correo, password);
    return credencial.user.uid;
  } catch (error) {
    throw mensajeFirebase(error);
  }
}
export async function iniciarSesion(id, password) {
  const { auth } = obtenerServicios();
  try {
    await signInWithEmailAndPassword(
      auth,
      correoDeCuenta(id, dominioAcceso()),
      password,
    );
  } catch (error) {
    throw mensajeFirebase(error);
  }
  localStorage.removeItem(CLAVE_TERMINAL);
  await setPersistence(auth, browserSessionPersistence);
}
export async function verificarTrabajador(id, password) {
  const auth = authSecundaria();
  try {
    await signInWithEmailAndPassword(
      auth,
      correoDeCuenta(id, dominioAcceso()),
      password,
    );
  } catch (error) {
    throw mensajeFirebase(error);
  } finally {
    if (auth.currentUser) await signOut(auth);
  }
}
export async function cambiarContrasenaMaria(password) {
  if (password.length < 6)
    throw Error("La contraseña debe tener al menos 6 caracteres.");
  const { auth } = obtenerServicios();
  if (!auth.currentUser) throw Error("Vuelve a ingresar como María.");
  try {
    await updatePassword(auth.currentUser, password);
  } catch (error) {
    throw mensajeFirebase(error);
  }
}
export async function cerrarSesionAuth() {
  if (!firebaseConfigurado()) return;
  const { auth } = obtenerServicios();
  if (terminalVinculada() || !auth.currentUser) return;
  await signOut(auth);
}
export async function adoptarTerminal(token) {
  const { auth } = obtenerServicios();
  localStorage.setItem(CLAVE_TERMINAL, "1");
  await setPersistence(auth, browserLocalPersistence);
  try {
    await signInWithCustomToken(auth, token);
  } catch (error) {
    localStorage.removeItem(CLAVE_TERMINAL);
    throw mensajeFirebase(error);
  }
}
export async function gestionarAcceso(datos) {
  const { app } = obtenerServicios();
  try {
    const resultado = await httpsCallable(
      getFunctions(app),
      "gestionarAcceso",
    )(datos);
    return resultado.data;
  } catch (error) {
    throw mensajeFirebase(error);
  }
}
export function observarAuth(callback) {
  return onAuthStateChanged(obtenerServicios().auth, callback);
}
