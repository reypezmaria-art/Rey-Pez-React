import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { defaultSchedules } from "../datos/horariosIniciales.js";
import {
  adoptarTerminal,
  cerrarSesionAuth,
  crearCuentaMaria,
  obtenerServicios,
  observarAuth,
  prepararPersistencia,
  uidActual,
} from "../firebase/sesion.js";
import { localDate } from "../utilidades/fechas.js";
import {
  armarEstado,
  catalogoParaImportar,
  COLECCIONES,
  idDocumento,
  cambiosDeIdentidad,
  diferencias,
  estadoPublico,
  rutasDeEvidencia,
} from "./estadoFirebase.js";
import { STORAGE_KEY, validateState } from "./repositorioLocal.js";

function nombreAdjunto(nombre) {
  return String(nombre || "adjunto")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}
function sinSecretos(state) {
  return {
    ...state,
    access: {
      admin: state.access?.admin?.uid
        ? { active: true, uid: state.access.admin.uid }
        : null,
      workers: Object.fromEntries(
        Object.entries(state.access?.workers || {}).map(([id, worker]) => [
          id,
          { active: worker.active !== false, uid: worker.uid || null },
        ]),
      ),
      permissions: state.access?.permissions || {},
    },
  };
}
export function createFirebaseRepository() {
  const listeners = new Set();
  let estado = null;
  let respaldos = [];
  let detenerEscuchas = () => {};
  let cola = Promise.resolve();
  const urls = new Map();
  const emitir = (siguiente) => {
    estado = siguiente;
    for (const listener of listeners) listener(structuredClone(siguiente));
  };
  const storage = () => obtenerServicios().storage;
  const base = () => obtenerServicios().db;
  async function leerAdminUid() {
    const snap = await getDoc(doc(base(), "acceso", "admin"));
    return snap.exists() ? snap.data().uid : null;
  }
  async function hidratar(state) {
    const pendientes = [];
    for (const coleccion of COLECCIONES) {
      for (const item of state[coleccion.estado] || [])
        rutasDeEvidencia(item, (evidence) => {
          if (
            evidence.path &&
            !String(evidence.data || "").startsWith("http") &&
            !String(evidence.data || "").startsWith("data:")
          )
            pendientes.push(evidence);
        });
    }
    await Promise.all(
      pendientes.map(async (evidence) => {
        try {
          if (!urls.has(evidence.path))
            urls.set(
              evidence.path,
              await getDownloadURL(ref(storage(), evidence.path)),
            );
          evidence.data = urls.get(evidence.path);
        } catch {
          evidence.data = "";
        }
      }),
    );
    return state;
  }
  async function subirAdjuntos(state) {
    for (const coleccion of COLECCIONES) {
      for (const [indice, item] of (state[coleccion.estado] || []).entries()) {
        const id = idDocumento(item, coleccion.id, indice);
        const subidas = [];
        rutasDeEvidencia(item, (evidence) => {
          if (String(evidence.data || "").startsWith("data:") && !evidence.path)
            subidas.push(evidence);
        });
        for (const evidence of subidas) {
          const path = `evidencias/${coleccion.coleccion}/${id}/${nombreAdjunto(evidence.name)}`;
          await uploadString(ref(storage(), path), evidence.data, "data_url");
          evidence.path = path;
          urls.set(path, evidence.data);
        }
      }
    }
    return state;
  }
  async function escribir(antes, despues) {
    const next = await subirAdjuntos(structuredClone(despues));
    const operaciones = diferencias(antes, next);
    const db = base();
    for (let i = 0; i < operaciones.length; i += 400) {
      const lote = writeBatch(db);
      for (const operacion of operaciones.slice(i, i + 400)) {
        const referencia = doc(db, operacion.coleccion, operacion.id);
        if (operacion.tipo === "delete") lote.delete(referencia);
        else lote.set(referencia, operacion.datos);
      }
      await lote.commit();
    }
    for (const cambio of cambiosDeIdentidad(antes, next))
      await setDoc(
        doc(db, "usuarios", cambio.uid),
        { idEmpleado: cambio.idEmpleado },
        { merge: true },
      );
    return next;
  }
  async function respaldar(antes) {
    const fecha = localDate();
    if (respaldos.some((copia) => copia.date === fecha)) return;
    const contenido = JSON.stringify(sinSecretos(antes));
    if (contenido.length > 900000) return;
    await setDoc(doc(base(), "respaldos", fecha), { date: fecha, contenido });
    respaldos = [{ date: fecha }, ...respaldos].slice(0, 7);
  }
  async function puedeEscuchar(uid) {
    for (let intento = 0; intento < 8; intento++) {
      const admin = await getDoc(doc(base(), "acceso", "admin")).catch(
        () => null,
      );
      if (admin?.exists() && admin.data().uid === uid) return true;
      const propio = await getDoc(doc(base(), "usuarios", uid)).catch(
        () => null,
      );
      if (propio?.exists()) return true;
      await new Promise((resolver) => setTimeout(resolver, 250));
    }
    return false;
  }
  function semillaLocal(uid) {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (!guardado)
      return catalogoParaImportar(
        {
          employees: [],
          attendance: [],
          schedules: structuredClone(defaultSchedules),
          alerts: [],
        },
        uid,
      );
    try {
      return catalogoParaImportar(JSON.parse(guardado), uid);
    } catch {
      return catalogoParaImportar(
        {
          employees: [],
          attendance: [],
          schedules: structuredClone(defaultSchedules),
          alerts: [],
        },
        uid,
      );
    }
  }
  async function asegurarOperacion() {
    const config = await getDoc(doc(base(), "operacion", "config"));
    if (config.exists()) return;
    const uid = uidActual();
    const adminUid = await leerAdminUid();
    if (!uid || uid !== adminUid) return;
    const semilla = validateState(semillaLocal(uid));
    await escribir({ access: { permissions: {} } }, semilla);
  }
  async function leerUsuarios() {
    const db = base();
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      return snap.docs.map((item) => ({ uid: item.id, ...item.data() }));
    } catch {
      const uid = uidActual();
      if (!uid) return [];
      const propio = await getDoc(doc(db, "usuarios", uid));
      return propio.exists() ? [{ uid, ...propio.data() }] : [];
    }
  }
  async function leerTodo() {
    const db = base();
    const listas = {};
    for (const coleccion of COLECCIONES) {
      const snap = await getDocs(collection(db, coleccion.coleccion));
      listas[coleccion.estado] = snap.docs.map((item) => item.data());
    }
    const configSnap = await getDoc(doc(db, "operacion", "config"));
    const adminUid = await leerAdminUid();
    const usuarios = await leerUsuarios();
    try {
      const snap = await getDocs(collection(db, "respaldos"));
      respaldos = snap.docs
        .map((item) => item.data())
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 7);
    } catch {
      respaldos = [];
    }
    const siguiente = await hidratar(
      armarEstado({
        listas,
        config: configSnap.exists() ? configSnap.data() : null,
        usuarios,
        adminUid,
      }),
    );
    emitir(siguiente);
    return structuredClone(siguiente);
  }
  function escuchar() {
    detenerEscuchas();
    const db = base();
    const parar = [];
    const snaps = {};
    let config;
    let usuarios;
    let adminUid;
    const publicar = () => {
      if (
        COLECCIONES.some((coleccion) => !snaps[coleccion.coleccion]) ||
        config === undefined ||
        usuarios === undefined ||
        adminUid === undefined
      )
        return;
      const listas = {};
      for (const coleccion of COLECCIONES)
        listas[coleccion.estado] = snaps[coleccion.coleccion].docs.map((item) =>
          item.data(),
        );
      hidratar(armarEstado({ listas, config, usuarios, adminUid }))
        .then(emitir)
        .catch(() => {
          /* conservar el último estado válido */
        });
    };
    const ignorarPermiso = () => {
      /* la sesión todavía no puede leer; no se vacía el estado */
    };
    for (const coleccion of COLECCIONES)
      parar.push(
        onSnapshot(
          collection(db, coleccion.coleccion),
          (snap) => {
            snaps[coleccion.coleccion] = snap;
            publicar();
          },
          ignorarPermiso,
        ),
      );
    parar.push(
      onSnapshot(
        doc(db, "operacion", "config"),
        (snap) => {
          config = snap.exists() ? snap.data() : null;
          publicar();
        },
        ignorarPermiso,
      ),
    );
    parar.push(
      onSnapshot(doc(db, "acceso", "admin"), (snap) => {
        adminUid = snap.exists() ? snap.data().uid : null;
        publicar();
      }),
    );
    parar.push(
      onSnapshot(
        collection(db, "usuarios"),
        (snap) => {
          usuarios = snap.docs.map((item) => ({
            uid: item.id,
            ...item.data(),
          }));
          publicar();
        },
        () => {
          const uid = uidActual();
          if (!uid) {
            usuarios = [];
            publicar();
            return;
          }
          if (parar.some((item) => item.propio)) return;
          const detenerPropio = onSnapshot(doc(db, "usuarios", uid), (snap) => {
            usuarios = snap.exists() ? [{ uid, ...snap.data() }] : [];
            publicar();
          });
          detenerPropio.propio = true;
          parar.push(detenerPropio);
        },
      ),
    );
    parar.push(
      onSnapshot(
        collection(db, "respaldos"),
        (snap) => {
          respaldos = snap.docs
            .map((item) => ({
              date: item.data().date || item.id,
              path: item.data().path,
            }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 7);
        },
        () => {
          respaldos = [];
        },
      ),
    );
    detenerEscuchas = () => {
      for (const pararUna of parar) pararUna();
    };
  }
  return {
    firebase: true,
    async load() {
      await prepararPersistencia();
      let adminUid;
      try {
        adminUid = await leerAdminUid();
      } catch {
        adminUid = null;
      }
      if (!uidActual()) {
        const publico = estadoPublico(adminUid);
        emitir(publico);
        return structuredClone(publico);
      }
      await asegurarOperacion();
      return leerTodo();
    },
    async crearAdministracion(password) {
      const uid = await crearCuentaMaria(password);
      const acceso = doc(base(), "acceso", "admin");
      const actual = await getDoc(acceso);
      if (!actual.exists()) await setDoc(acceso, { uid });
      else if (actual.data().uid !== uid)
        throw Error("La administración ya está configurada.");
      await asegurarOperacion();
      return leerTodo();
    },
    transact(update) {
      const ejecucion = cola.then(async () => {
        if (!estado || !uidActual()) throw Error("Inicia sesión para guardar.");
        const antes = structuredClone(estado);
        const calculado = validateState(update(structuredClone(antes)));
        if (uidActual() === antes.access?.admin?.uid) {
          try {
            await respaldar(antes);
          } catch {
            /* el cambio operativo no depende del respaldo */
          }
        }
        const siguiente = await escribir(antes, calculado);
        emitir(siguiente);
        return structuredClone(siguiente);
      });
      cola = ejecucion.catch(() => {});
      return ejecucion;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (estado) listener(structuredClone(estado));
      let activa = true;
      let detenerAuth = () => {};
      prepararPersistencia()
        .then(() => {
          if (!activa) return;
          detenerAuth = observarAuth((user) => {
            detenerEscuchas();
            if (!user) {
              leerAdminUid()
                .catch(() => null)
                .then((adminUid) => {
                  if (activa) emitir(estadoPublico(adminUid));
                });
              return;
            }
            puedeEscuchar(user.uid).then((listo) => {
              if (activa && listo && uidActual() === user.uid) escuchar();
            });
          });
        })
        .catch(() => {
          /* load informa el error de configuración */
        });
      return () => {
        activa = false;
        listeners.delete(listener);
        if (!listeners.size) {
          detenerEscuchas();
          detenerAuth();
        }
      };
    },
    backups: () => respaldos,
    async leerRespaldo(fecha) {
      const snap = await getDoc(doc(base(), "respaldos", fecha));
      if (snap.exists() && snap.data().contenido)
        return JSON.parse(snap.data().contenido);
      const copia = respaldos.find((item) => item.date === fecha);
      if (!copia?.path) throw Error("No se encontró el respaldo de ese día.");
      const url = await getDownloadURL(ref(storage(), copia.path));
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw Error("No se pudo leer el respaldo.");
      return respuesta.json();
    },
    cerrarSesion: cerrarSesionAuth,
    adoptarTerminal,
  };
}
