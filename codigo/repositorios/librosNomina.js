import {
  doc,
  getDoc,
  getDocs,
  collection,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseConfigurado } from "../firebase/configuracion.js";
import { obtenerServicios, uidActual } from "../firebase/sesion.js";
import { claveLibroNomina } from "../utilidades/paqueteLibroNomina.js";

const conflicto = () =>
  Error(
    "Hay una versión más reciente guardada desde otra ventana. Reabre el libro antes de guardar; tus cambios siguen en la vista actual.",
  );
function baseLocal() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("rey-pez-libros-nomina", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("libros", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(Error("No se pudo abrir el guardado local."));
  });
}
async function local(id, accion, payload) {
  const db = await baseLocal();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
          "libros",
          accion === "guardar" ? "readwrite" : "readonly",
        ),
        store = tx.objectStore("libros"),
        req = store.get(id);
      let resultado;
      req.onsuccess = () => {
        const libro = req.result || { id, revision: 0, versiones: [] };
        if (accion === "guardar") {
          if (libro.revision !== payload.revision) {
            tx.abort();
            return;
          }
          const revision = libro.revision + 1;
          const version = {
            revision,
            fecha: new Date().toISOString(),
            carga: payload.carga,
          };
          store.put({ id, revision, versiones: [...libro.versiones, version] });
          resultado = version;
        } else resultado = libro;
      };
      tx.oncomplete = () => resolve(resultado);
      tx.onabort = () => reject(conflicto());
      tx.onerror = () =>
        reject(
          Error("No se guardó el libro. Revisa el espacio del navegador."),
        );
    });
  } finally {
    db.close();
  }
}
export function repositorioLibrosNomina(ambito) {
  const id = claveLibroNomina(ambito),
    nube = firebaseConfigurado();
  const head = () => doc(obtenerServicios().db, "librosNomina", id);
  return {
    nube,
    async abrir(revision) {
      if (!nube) {
        const libro = await local(id, "leer");
        const r = revision || libro.revision;
        const version = libro.versiones.find((v) => v.revision === r);
        return version ? { ...version, actual: libro.revision } : null;
      }
      const h = await getDoc(head());
      if (!h.exists()) return null;
      const actual = h.data().revision,
        r = revision || actual;
      const version = await getDoc(doc(head(), "versiones", String(r)));
      if (!version.exists()) throw Error("No se encontró la versión guardada.");
      const contenido = await getDoc(doc(head(), "contenidos", String(r)));
      if (!contenido.exists())
        throw Error("El contenido de la versión no está disponible.");
      return {
        revision: r,
        fecha: version.data().fecha.toDate().toISOString(),
        carga: contenido.data().carga,
        actual,
      };
    },
    async listar() {
      if (!nube)
        return (await local(id, "leer")).versiones
          .map(({ revision, fecha }) => ({ revision, fecha }))
          .reverse();
      const docs = await getDocs(collection(head(), "versiones"));
      return docs.docs
        .map((d) => ({
          revision: d.data().revision,
          fecha: d.data().fecha.toDate().toISOString(),
        }))
        .sort((a, b) => b.revision - a.revision);
    },
    async guardar(carga, revision) {
      if (
        typeof carga !== "string" ||
        carga.length < 1 ||
        carga.length > 750000
      )
        throw Error("El libro supera el tamaño permitido.");
      if (!nube) return local(id, "guardar", { carga, revision });
      return runTransaction(obtenerServicios().db, async (tx) => {
        const ref = head(),
          anterior = await tx.get(ref),
          actual = anterior.exists() ? anterior.data().revision : 0;
        if (actual !== revision) throw conflicto();
        const next = actual + 1,
          fecha = new Date().toISOString();
        const campos = {
          id,
          ...ambito,
          revision: next,
          fecha: serverTimestamp(),
          autor: uidActual(),
        };
        tx.set(doc(ref, "versiones", String(next)), campos);
        tx.set(doc(ref, "contenidos", String(next)), { ...campos, carga });
        tx.set(ref, campos);
        return { revision: next, fecha };
      });
    },
  };
}

export async function listarLibrosNomina() {
  if (firebaseConfigurado()) {
    const lista = await getDocs(
      collection(obtenerServicios().db, "librosNomina"),
    );
    return lista.docs.map((d) => {
      const v = d.data();
      return {
        empresa: v.empresa,
        anio: v.anio,
        tipo: v.tipo,
        revision: v.revision,
      };
    });
  }
  const db = await baseLocal();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("libros").objectStore("libros").getAll();
      req.onerror = () =>
        reject(Error("No se pudieron leer los libros guardados."));
      req.onsuccess = () =>
        resolve(
          req.result.map((v) => {
            const [empresa, anio, tipo] = v.id.split("_");
            return { empresa, anio: Number(anio), tipo, revision: v.revision };
          }),
        );
    });
  } finally {
    db.close();
  }
}
