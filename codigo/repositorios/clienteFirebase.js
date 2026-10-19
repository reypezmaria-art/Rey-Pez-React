import { deleteApp, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getBlob,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { bytesADataUrl, dataUrlABytes } from "../utilidades/datosUrl.js";

const LOTE = 400;

function crearBase(aplicacion) {
  try {
    return initializeFirestore(aplicacion, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    try {
      return initializeFirestore(aplicacion, {
        localCache: persistentLocalCache(),
      });
    } catch {
      return initializeFirestore(aplicacion, {
        localCache: memoryLocalCache(),
      });
    }
  }
}

function consulta(db, nombre, restricciones) {
  const base = collection(db, nombre);
  if (!restricciones.length) return base;
  return query(
    base,
    ...restricciones.map((item) =>
      where(item.campo, item.operador, item.valor),
    ),
  );
}

async function blobADataUrl(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  return bytesADataUrl(buffer, blob.type || "application/octet-stream");
}

function esperarAuth(authInstancia) {
  if (authInstancia.currentUser)
    return Promise.resolve(authInstancia.currentUser);
  return new Promise((resolve) => {
    const detener = onAuthStateChanged(authInstancia, (usuario) => {
      detener();
      resolve(usuario);
    });
  });
}

function conectarEmuladores(
  configuracion,
  authInstancia,
  dbInstancia,
  storage,
) {
  if (!configuracion.emulador) return;
  connectAuthEmulator(authInstancia, configuracion.authEmulatorUrl, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(
    dbInstancia,
    configuracion.firestoreEmuladorHost,
    configuracion.firestoreEmuladorPuerto,
  );
  connectStorageEmulator(
    storage,
    configuracion.storageEmuladorHost,
    configuracion.storageEmuladorPuerto,
  );
}

export async function crearClienteFirebase(configuracion) {
  const aplicacion = initializeApp(configuracion.firebase);
  const aplicacionTerminal = initializeApp(
    configuracion.firebase,
    "reypez-terminal",
  );
  const auth = getAuth(aplicacion);
  const authTerminal = getAuth(aplicacionTerminal);
  const db = crearBase(aplicacion);
  const dbTerminal = crearBase(aplicacionTerminal);
  const storage = getStorage(aplicacion);
  const storageTerminal = getStorage(aplicacionTerminal);
  conectarEmuladores(configuracion, auth, db, storage);
  conectarEmuladores(configuracion, authTerminal, dbTerminal, storageTerminal);
  await setPersistence(auth, browserLocalPersistence);
  await setPersistence(authTerminal, browserLocalPersistence);
  let modoTerminal = false;
  const recursos = () =>
    modoTerminal
      ? { db: dbTerminal, storage: storageTerminal }
      : { db, storage };
  const authActivo = () => (modoTerminal ? authTerminal : auth);

  async function conSecundaria(accion) {
    const secundaria = initializeApp(
      configuracion.firebase,
      `alta-${crypto.randomUUID()}`,
    );
    const authSecundaria = getAuth(secundaria);
    if (configuracion.emulador)
      connectAuthEmulator(authSecundaria, configuracion.authEmulatorUrl, {
        disableWarnings: true,
      });
    try {
      return await accion(authSecundaria);
    } finally {
      await signOut(authSecundaria).catch(() => {});
      await deleteApp(secundaria);
    }
  }

  return {
    async leerDocumento(coleccion, id) {
      const instantanea = await getDoc(doc(recursos().db, coleccion, id));
      return instantanea.exists() ? instantanea.data() : null;
    },
    async leerColeccion(nombre, restricciones = []) {
      const instantanea = await getDocs(
        consulta(recursos().db, nombre, restricciones),
      );
      return instantanea.docs.map((item) => ({
        id: item.id,
        datos: item.data(),
      }));
    },
    escucharDocumento(coleccion, id, callback) {
      return onSnapshot(doc(recursos().db, coleccion, id), (instantanea) => {
        callback(instantanea.exists() ? instantanea.data() : null);
      });
    },
    escucharColeccion(nombre, restricciones, callback) {
      return onSnapshot(consulta(recursos().db, nombre, restricciones), () =>
        callback(),
      );
    },
    async crearDocumento(coleccion, id, datos) {
      const referencia = doc(recursos().db, coleccion, id);
      const actual = await getDoc(referencia);
      if (actual.exists()) {
        const error = Error("Ya existe.");
        error.code = "already-exists";
        throw error;
      }
      await setDoc(referencia, datos);
    },
    async crearDocumentosAtomicos(escrituras) {
      const lote = writeBatch(recursos().db);
      for (const item of escrituras)
        lote.create(doc(recursos().db, item.coleccion, item.id), item.datos);
      await lote.commit();
    },
    async escribirDocumento(coleccion, id, datos) {
      await setDoc(doc(recursos().db, coleccion, id), datos, { merge: true });
    },
    async aplicarLote(cambios) {
      const base = recursos().db;
      for (let inicio = 0; inicio < cambios.length; inicio += LOTE) {
        const lote = writeBatch(base);
        for (const cambio of cambios.slice(inicio, inicio + LOTE)) {
          const referencia = doc(base, cambio.coleccion, cambio.id);
          if (cambio.tipo === "borrar") lote.delete(referencia);
          else lote.set(referencia, cambio.datos);
        }
        await lote.commit();
      }
    },
    async subirArchivo(ruta, dataUrl) {
      const { bytes, tipo } = dataUrlABytes(dataUrl);
      if (bytes.length > 1500000)
        throw Error(
          "La evidencia sigue siendo demasiado grande después de comprimirla.",
        );
      await uploadBytes(ref(recursos().storage, ruta), bytes, {
        contentType: tipo,
      });
    },
    async leerArchivo(ruta) {
      try {
        return await blobADataUrl(await getBlob(ref(recursos().storage, ruta)));
      } catch {
        return null;
      }
    },
    auth: {
      usuario: () => {
        const actual = authActivo().currentUser;
        return actual ? { uid: actual.uid, email: actual.email } : null;
      },
      async entrar(correo, contrasena) {
        modoTerminal = false;
        const credencial = await signInWithEmailAndPassword(
          auth,
          correo,
          contrasena,
        );
        return { uid: credencial.user.uid, email: credencial.user.email };
      },
      async registrarPrincipal(correo, contrasena) {
        const credencial = await createUserWithEmailAndPassword(
          auth,
          correo,
          contrasena,
        );
        return { uid: credencial.user.uid, email: credencial.user.email };
      },
      async registrarSecundario(correo, contrasena) {
        return conSecundaria(async (authSecundaria) => {
          const credencial = await createUserWithEmailAndPassword(
            authSecundaria,
            correo,
            contrasena,
          );
          return { uid: credencial.user.uid, email: credencial.user.email };
        });
      },
      async entrarSecundario(correo, contrasena) {
        return conSecundaria(async (authSecundaria) => {
          const credencial = await signInWithEmailAndPassword(
            authSecundaria,
            correo,
            contrasena,
          );
          return { uid: credencial.user.uid, email: credencial.user.email };
        });
      },
      async salir() {
        modoTerminal = false;
        await signOut(auth);
      },
      async persistirTerminal(correo, contrasena) {
        await signInWithEmailAndPassword(authTerminal, correo, contrasena);
      },
      async tieneTerminal() {
        if (authTerminal.currentUser) return true;
        await esperarAuth(authTerminal);
        return Boolean(authTerminal.currentUser);
      },
      async adoptarTerminal() {
        if (!authTerminal.currentUser) await esperarAuth(authTerminal);
        if (!authTerminal.currentUser) return false;
        modoTerminal = true;
        return true;
      },
      async cerrarTerminal() {
        modoTerminal = false;
        await signOut(authTerminal);
      },
      async cambiarContrasena(contrasena) {
        if (!auth.currentUser) throw Error("No hay sesión activa.");
        await updatePassword(auth.currentUser, contrasena);
      },
      async token() {
        if (!auth.currentUser) return "";
        return auth.currentUser.getIdToken();
      },
      escuchar(callback) {
        return onAuthStateChanged(auth, () => callback());
      },
    },
  };
}
