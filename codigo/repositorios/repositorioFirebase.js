import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
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
  AVISOS_COPIA,
  catalogoParaImportar,
  COLECCIONES,
  idDocumento,
  consultasDeTrabajador,
  cambiosDeIdentidad,
  cursoresDeAsistencia,
  cursoresFaltantes,
  decidirCopiaLocal,
  diferencias,
  enriquecerAsistenciaNueva,
  estadoPublico,
  lotesAtomicos,
  rutaAdjunto,
  rutasDeEvidencia,
  tieneOperacionPropia,
} from "./estadoFirebase.js";
import { STORAGE_KEY, validateState } from "./repositorioLocal.js";

const CLAVE_DECISION = "reypez_decision_nube";
const COLECCIONES_TERMINAL = ["employees", "attendance", "alerts", "schedules"];

function listasVacias() {
  return {
    employees: [],
    companies: [],
    payroll: [],
    attendance: [],
    alerts: [],
    schedules: [],
    logs: [],
    maintenance: [],
    absenceReviews: [],
    audit: [],
  };
}
function esPermisoDenegado(error) {
  return error?.code === "permission-denied";
}
export function createFirebaseRepository() {
  const listeners = new Set();
  const avisos = new Set();
  let estado = null;
  let avisoActual = "";
  let respaldos = [];
  let detenerEscuchas = () => {};
  let cola = Promise.resolve();
  const urls = new Map();
  const emitir = (siguiente) => {
    estado = siguiente;
    for (const listener of listeners) listener(structuredClone(siguiente));
  };
  const publicarAviso = (texto) => {
    avisoActual = texto || "";
    for (const listener of avisos) listener(avisoActual);
  };
  const publicarDecision = (decision) => {
    try {
      if (localStorage.getItem(CLAVE_DECISION) === decision) return;
      localStorage.setItem(CLAVE_DECISION, decision);
    } catch {
      /* localStorage no está disponible en todas las pruebas */
    }
    if (AVISOS_COPIA[decision]) publicarAviso(AVISOS_COPIA[decision]);
  };
  const storage = () => obtenerServicios().storage;
  const base = () => obtenerServicios().db;
  async function leerAdminUid() {
    const snap = await getDoc(doc(base(), "acceso", "admin"));
    return snap.exists() ? snap.data().uid : null;
  }
  async function perfilActual(adminConocido) {
    const uid = uidActual();
    if (!uid) return { rol: "ninguno" };
    const adminUid =
      adminConocido === undefined
        ? await leerAdminUid().catch(() => null)
        : adminConocido;
    if (adminUid === uid) return { rol: "admin", uid };
    const propio = await getDoc(doc(base(), "usuarios", uid));
    if (!propio.exists() || propio.data().activo === false)
      return { rol: "ninguno", uid };
    const datos = propio.data();
    if (datos.rol === "terminal")
      return { rol: "terminal", uid, deviceId: datos.deviceId || "" };
    if (datos.rol === "trabajador" && datos.idEmpleado) {
      const config = await getDoc(doc(base(), "operacion", "config"));
      const permiso = config.exists()
        ? config.data().permissions?.[datos.idEmpleado] || null
        : null;
      return { rol: "trabajador", uid, idEmpleado: datos.idEmpleado, permiso };
    }
    return { rol: "ninguno", uid };
  }
  function referenciasOperacion(db, perfil) {
    if (perfil.rol === "admin")
      return COLECCIONES.map((coleccion) => ({
        estado: coleccion.estado,
        referencia: collection(db, coleccion.coleccion),
      }));
    if (perfil.rol === "terminal")
      return COLECCIONES.filter((coleccion) =>
        COLECCIONES_TERMINAL.includes(coleccion.estado),
      ).map((coleccion) => ({
        estado: coleccion.estado,
        referencia: collection(db, coleccion.coleccion),
      }));
    if (perfil.rol !== "trabajador") return [];
    return consultasDeTrabajador(perfil.permiso, perfil.idEmpleado).map(
      (consulta) => {
        if (consulta.estado === "payroll")
          return {
            estado: "payroll",
            referencia: collection(db, "nominas"),
          };
        if (consulta.estado === "logs")
          return {
            estado: "logs",
            referencia: query(
              collection(db, "bitacoras"),
              where("company", "==", consulta.empresa),
              where("type", "in", consulta.tipos),
            ),
          };
        if (consulta.idEmpleado)
          return {
            estado: "employees",
            referencia: query(
              collection(db, "empleados"),
              where("id_empleado", "==", consulta.idEmpleado),
            ),
          };
        return {
          estado: "employees",
          referencia: query(
            collection(db, "empleados"),
            where("empresa_codigo", "==", consulta.empresa),
          ),
        };
      },
    );
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
        } catch (error) {
          evidence.error = error?.message || "No se pudo leer el adjunto.";
          publicarAviso(
            `No se pudo abrir el adjunto ${evidence.name || evidence.path}: ${evidence.error}`,
          );
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
          const path = rutaAdjunto(
            coleccion.coleccion,
            id,
            item,
            evidence.name,
          );
          await uploadString(ref(storage(), path), evidence.data, "data_url");
          evidence.path = path;
          urls.set(path, evidence.data);
        }
      }
    }
    return state;
  }
  async function enviarLote(operaciones) {
    if (!operaciones.length) return;
    const db = base();
    const lote = writeBatch(db);
    for (const operacion of operaciones) {
      const referencia = doc(db, operacion.coleccion, operacion.id);
      if (operacion.tipo === "delete") lote.delete(referencia);
      else lote.set(referencia, operacion.datos);
    }
    await lote.commit();
  }
  async function confirmarLote(operaciones) {
    for (const grupo of lotesAtomicos(operaciones, [])) await enviarLote(grupo);
  }
  async function confirmarConSecuencia(operaciones, secuencia) {
    for (const grupo of lotesAtomicos(operaciones, secuencia)) {
      try {
        await enviarLote(grupo);
      } catch (error) {
        const haySecuencia = grupo.some(
          (op) => op.coleccion === "secuenciaAsistencia",
        );
        if (!haySecuencia || !esPermisoDenegado(error)) throw error;
        const resto = grupo.filter(
          (op) => op.coleccion !== "secuenciaAsistencia",
        );
        if (!resto.length) throw error;
        try {
          await enviarLote(resto);
          publicarAviso(
            "El marcaje se guardó, pero las reglas todavía no exigen la secuencia. Publica firestore:rules para cerrar ese hueco.",
          );
        } catch (segundo) {
          throw Error(
            "La asistencia no cumple la secuencia entrada, comida, regreso y salida, o la fecha está fuera del turno. No se guardó el marcaje.",
            { cause: segundo },
          );
        }
      }
    }
  }
  async function escribir(antes, despues) {
    const subido = await subirAdjuntos(structuredClone(despues));
    const next = enriquecerAsistenciaNueva(antes, subido);
    const operaciones = diferencias(antes, next);
    const secuencia = cursoresDeAsistencia(antes, next);
    await confirmarConSecuencia(operaciones, secuencia);
    for (const cambio of cambiosDeIdentidad(antes, next))
      await setDoc(
        doc(base(), "usuarios", cambio.uid),
        { idEmpleado: cambio.idEmpleado },
        { merge: true },
      );
    return next;
  }
  async function respaldar(antes) {
    const fecha = localDate();
    if (respaldos.some((copia) => copia.date === fecha)) return;
    const contenido = JSON.stringify(sinSecretos(antes));
    if (contenido.length > 900000)
      throw Error(
        "El respaldo del día supera el tamaño de un documento de Firestore.",
      );
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
          companies: [],
          payroll: [],
          attendance: [],
          schedules: structuredClone(defaultSchedules),
          alerts: [],
        },
        uid,
      );
    try {
      return catalogoParaImportar(JSON.parse(guardado), uid);
    } catch (error) {
      publicarAviso(
        `No se pudo leer la copia local: ${error.message}. No se subió nada.`,
      );
      return catalogoParaImportar(
        {
          employees: [],
          companies: [],
          payroll: [],
          attendance: [],
          schedules: structuredClone(defaultSchedules),
          alerts: [],
        },
        uid,
      );
    }
  }
  async function existeOperacion() {
    const config = await getDoc(doc(base(), "operacion", "config"));
    if (config.exists()) return true;
    for (const coleccion of COLECCIONES) {
      const snap = await getDocs(
        query(collection(base(), coleccion.coleccion), limit(1)),
      );
      if (!snap.empty) return true;
    }
    return false;
  }
  async function asegurarOperacion() {
    const uid = uidActual();
    const adminUid = await leerAdminUid();
    if (!uid || uid !== adminUid) return;
    const semilla = validateState(semillaLocal(uid));
    const decision = decidirCopiaLocal({
      localTieneOperacion: tieneOperacionPropia(semilla),
      nubeTieneOperacion: await existeOperacion(),
    });
    if (decision === "conservar" || decision === "nada") {
      publicarDecision(decision);
      return;
    }
    await escribir({ access: { permissions: {} } }, semilla);
    publicarDecision(decision);
  }
  async function leerUsuarios(perfil) {
    const db = base();
    if (perfil.rol === "trabajador") {
      const propio = await getDoc(doc(db, "usuarios", perfil.uid));
      return propio.exists() ? [{ uid: perfil.uid, ...propio.data() }] : [];
    }
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      return snap.docs.map((item) => ({ uid: item.id, ...item.data() }));
    } catch (error) {
      if (!esPermisoDenegado(error))
        publicarAviso(
          `No se pudieron leer las cuentas: ${error.message || error.code}`,
        );
      const uid = uidActual();
      if (!uid) return [];
      const propio = await getDoc(doc(db, "usuarios", uid));
      return propio.exists() ? [{ uid, ...propio.data() }] : [];
    }
  }
  async function completarSecuencia(state) {
    try {
      const snap = await getDocs(collection(base(), "secuenciaAsistencia"));
      const operaciones = cursoresFaltantes(
        state.attendance,
        snap.docs.map((item) => item.id),
      );
      if (operaciones.length) await confirmarLote(operaciones);
    } catch (error) {
      if (esPermisoDenegado(error)) return;
      publicarAviso(
        `No se completó la secuencia de asistencia de hoy: ${error.message || error.code}`,
      );
    }
  }
  async function leerTodo(perfil) {
    const db = base();
    const fuentes = referenciasOperacion(db, perfil);
    const listas = listasVacias();
    for (const fuente of fuentes) {
      const snap = await getDocs(fuente.referencia);
      listas[fuente.estado] = snap.docs.map((item) => item.data());
    }
    const configSnap = await getDoc(doc(db, "operacion", "config"));
    const adminUid = await leerAdminUid();
    const usuarios = await leerUsuarios(perfil);
    if (perfil.rol === "admin") {
      try {
        const snap = await getDocs(collection(db, "respaldos"));
        respaldos = snap.docs
          .map((item) => item.data())
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, 7);
      } catch (error) {
        respaldos = [];
        publicarAviso(
          `No se pudieron leer los respaldos: ${error.message || error.code}`,
        );
      }
    } else respaldos = [];
    const siguiente = await hidratar(
      armarEstado({
        listas,
        config: configSnap.exists() ? configSnap.data() : null,
        usuarios,
        adminUid,
      }),
    );
    emitir(siguiente);
    if (perfil.rol === "admin") await completarSecuencia(siguiente);
    return structuredClone(siguiente);
  }
  function escuchar(perfil) {
    detenerEscuchas();
    const db = base();
    const parar = [];
    const fuentes = referenciasOperacion(db, perfil);
    const snaps = {};
    let config;
    let usuarios;
    let adminUid;
    const publicar = () => {
      if (
        fuentes.some((fuente) => !snaps[fuente.estado]) ||
        config === undefined ||
        usuarios === undefined ||
        adminUid === undefined
      )
        return;
      const listas = listasVacias();
      for (const fuente of fuentes)
        listas[fuente.estado] = snaps[fuente.estado].docs.map((item) =>
          item.data(),
        );
      hidratar(armarEstado({ listas, config, usuarios, adminUid }))
        .then(emitir)
        .catch((error) => {
          publicarAviso(
            error?.message || "No se pudo preparar la información recibida.",
          );
        });
    };
    const fallo = (error) => {
      if (esPermisoDenegado(error)) return;
      publicarAviso(
        error?.message || "No se pudo escuchar un cambio de Firestore.",
      );
    };
    for (const fuente of fuentes)
      parar.push(
        onSnapshot(
          fuente.referencia,
          (snap) => {
            snaps[fuente.estado] = snap;
            publicar();
          },
          fallo,
        ),
      );
    parar.push(
      onSnapshot(
        doc(db, "operacion", "config"),
        (snap) => {
          config = snap.exists() ? snap.data() : null;
          publicar();
        },
        fallo,
      ),
    );
    parar.push(
      onSnapshot(
        doc(db, "acceso", "admin"),
        (snap) => {
          adminUid = snap.exists() ? snap.data().uid : null;
          publicar();
        },
        fallo,
      ),
    );
    if (perfil.rol === "trabajador")
      parar.push(
        onSnapshot(
          doc(db, "usuarios", perfil.uid),
          (snap) => {
            usuarios = snap.exists()
              ? [{ uid: perfil.uid, ...snap.data() }]
              : [];
            publicar();
          },
          fallo,
        ),
      );
    else
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
          (error) => {
            if (!esPermisoDenegado(error)) {
              fallo(error);
              return;
            }
            const uid = uidActual();
            if (!uid) {
              usuarios = [];
              publicar();
              return;
            }
            if (parar.some((item) => item.propio)) return;
            const detenerPropio = onSnapshot(
              doc(db, "usuarios", uid),
              (snap) => {
                usuarios = snap.exists() ? [{ uid, ...snap.data() }] : [];
                publicar();
              },
              fallo,
            );
            detenerPropio.propio = true;
            parar.push(detenerPropio);
          },
        ),
      );
    if (perfil.rol === "admin")
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
          (error) => {
            respaldos = [];
            if (!esPermisoDenegado(error))
              publicarAviso(
                `No se pudieron leer los respaldos: ${error.message || error.code}`,
              );
          },
        ),
      );
    detenerEscuchas = () => {
      for (const pararUna of parar) pararUna();
    };
  }
  return {
    firebase: true,
    observarAviso(listener) {
      avisos.add(listener);
      if (avisoActual) listener(avisoActual);
      return () => avisos.delete(listener);
    },
    async load() {
      await prepararPersistencia();
      let adminUid = null;
      try {
        adminUid = await leerAdminUid();
      } catch (error) {
        if (!esPermisoDenegado(error))
          publicarAviso(
            error?.message || "No se pudo leer el acceso de María.",
          );
      }
      if (!uidActual()) {
        const publico = estadoPublico(adminUid);
        emitir(publico);
        return structuredClone(publico);
      }
      const perfil = await perfilActual(adminUid);
      if (perfil.rol === "ninguno") {
        const publico = estadoPublico(adminUid);
        emitir(publico);
        return structuredClone(publico);
      }
      if (perfil.rol === "admin") await asegurarOperacion();
      try {
        return await leerTodo(perfil);
      } catch (error) {
        if (esPermisoDenegado(error))
          throw Error(
            `Firestore rechazó la lectura (${error.code}). ${error.message}`,
            { cause: error },
          );
        throw error;
      }
    },
    async crearAdministracion(password) {
      const uid = await crearCuentaMaria(password);
      const acceso = doc(base(), "acceso", "admin");
      try {
        await runTransaction(base(), async (tx) => {
          const actual = await tx.get(acceso);
          if (!actual.exists()) tx.set(acceso, { uid });
          else if (actual.data().uid !== uid)
            throw Error("La administración ya está configurada.");
        });
      } catch (error) {
        if (error?.message === "La administración ya está configurada.")
          throw error;
        if (esPermisoDenegado(error))
          throw Error(
            "Solo la cuenta MARIA puede crear la administración, y solo una vez.",
            { cause: error },
          );
        throw error;
      }
      await asegurarOperacion();
      return leerTodo(await perfilActual());
    },
    transact(update) {
      const ejecucion = cola.then(async () => {
        if (!estado || !uidActual()) throw Error("Inicia sesión para guardar.");
        const antes = structuredClone(estado);
        const calculado = validateState(update(structuredClone(antes)));
        if (uidActual() === antes.access?.admin?.uid) {
          try {
            await respaldar(antes);
          } catch (error) {
            publicarAviso(
              `No se guardó el respaldo de hoy: ${error.message || "error desconocido"}`,
            );
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
                .catch((error) => {
                  if (!esPermisoDenegado(error))
                    publicarAviso(
                      error?.message || "No se pudo leer el acceso de María.",
                    );
                  return null;
                })
                .then((adminUid) => {
                  if (activa) emitir(estadoPublico(adminUid));
                });
              return;
            }
            puedeEscuchar(user.uid).then(async (listo) => {
              if (!(activa && listo && uidActual() === user.uid)) return;
              const perfil = await perfilActual();
              if (
                activa &&
                uidActual() === user.uid &&
                perfil.rol !== "ninguno"
              )
                escuchar(perfil);
            });
          });
        })
        .catch((error) => {
          publicarAviso(
            error?.message || "No se pudo preparar la sesión de Firebase.",
          );
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
