import { deviceId } from "../utilidades/dispositivo.js";
import { localDate } from "../utilidades/fechas.js";
import { comprimirEvidencia } from "../utilidades/comprimirEvidencia.js";
import { correoDeIdentificador } from "./firebaseConfiguracion.js";
import {
  BACKUP_KEY,
  STORAGE_KEY,
  createLocalRepository,
  migrateState,
  validateState,
} from "./repositorioLocal.js";
import {
  consultasDe,
  decidirMigracion,
  diferencias,
  estadoDesdeDocumentos,
  estadoPublico,
  expandirConsultas,
  listaEvidencias,
  localAportaDatos,
  marcarSincronizado,
  prepararEstadoNube,
  principalDesdeEstado,
  puedeEscribir,
  quitarDatosEvidencia,
  sanitizar,
  separarEvidencias,
  trabajadoresActivosDe,
  armarEstado,
} from "./modeloFirestore.js";

const MARCA = "reypez_firebase_migracion_v1";
const CLAVE_TERMINAL = "reypez_terminal_firebase_v1";
const CLAVE_EVIDENCIAS = "reypez_evidencias_locales_v1";
const COLECCIONES_OPERACION = [
  "asistencia",
  "bitacoras",
  "mantenimiento",
  "revisionesAusencia",
  "auditoria",
  "alertas",
];

export function mensajeAuth(error) {
  const codigo = error?.code || "";
  if (codigo === "auth/email-already-in-use") {
    const copia = Error("Ese acceso ya está registrado.");
    copia.code = codigo;
    return copia;
  }
  if (codigo === "auth/invalid-email")
    return Error(
      "El correo derivado del ID no es válido. Revisa VITE_FIREBASE_AUTH_EMAIL_DOMAIN.",
    );
  if (
    codigo === "auth/weak-password" ||
    codigo === "auth/password-does-not-meet-requirements"
  )
    return Error("La contraseña debe tener al menos 6 caracteres.");
  if (codigo === "auth/too-many-requests")
    return Error(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
  if (
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-login-credentials",
    ].includes(codigo)
  )
    return Error("ID o contraseña incorrectos.");
  return Error(error?.message || "No se pudo completar el acceso.");
}

function mapa(almacenamiento, clave) {
  try {
    return JSON.parse(almacenamiento.getItem(clave) || "{}");
  } catch {
    return {};
  }
}

function guardarMapa(almacenamiento, clave, valor) {
  almacenamiento.setItem(clave, JSON.stringify(valor));
}

function contrasenaDeTerminal() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createFirestoreRepository({
  configuracion,
  cliente,
  almacenamiento,
}) {
  const dominio = configuracion.dominioCorreo;
  const oyentes = new Set();
  let cache = null;
  let cuentaActual = null;
  let escuchas = [];
  let generacion = 0;
  let escribiendo = 0;
  let cola = Promise.resolve();
  let aviso = "";
  const emitir = () => {
    if (!cache) return;
    for (const oyente of oyentes) oyente(structuredClone(cache));
  };
  const encolar = (trabajo) => {
    const resultado = cola.then(trabajo, trabajo);
    cola = resultado.then(
      () => {},
      () => {},
    );
    return resultado;
  };
  const detenerEscuchas = () => {
    for (const detener of escuchas) detener();
    escuchas = [];
  };

  function idDispositivo() {
    try {
      return deviceId();
    } catch {
      return "";
    }
  }

  async function leerEstadoLocal() {
    const crudo = almacenamiento.getItem(STORAGE_KEY);
    if (!crudo) return null;
    let catalogo = globalThis.__REY_PEZ_CATALOG__ || [];
    if (import.meta.env?.DEV && !catalogo.length) {
      try {
        const respuesta = await fetch("/__local/empleados");
        if (respuesta.ok) catalogo = await respuesta.json();
      } catch {
        /* el catálogo privado es opcional */
      }
    }
    return migrateState(JSON.parse(crudo), catalogo);
  }

  async function semilla() {
    const registros = new Map();
    return createLocalRepository({
      getItem: (clave) => registros.get(clave) ?? null,
      setItem: (clave, valor) => registros.set(clave, valor),
    }).load();
  }

  async function remotoSinOperacion() {
    for (const coleccion of COLECCIONES_OPERACION) {
      if ((await cliente.leerColeccion(coleccion)).length) return false;
    }
    return true;
  }

  async function piezas() {
    const principal = await cliente.leerDocumento("estado", "principal");
    const documentos = {};
    for (const consulta of expandirConsultas(
      consultasDe({ rol: "admin", idEmpleado: "MARIA", activo: true }),
    )) {
      const nombre = consulta.definicion.coleccion;
      const lista = await cliente.leerColeccion(nombre, consulta.restricciones);
      documentos[nombre] = [...(documentos[nombre] || []), ...lista];
    }
    return { principal, documentos };
  }

  async function prepararEvidencias(estado) {
    const separado = separarEvidencias(estado);
    const locales = mapa(almacenamiento, CLAVE_EVIDENCIAS);
    const subidas = new Set();
    for (const pendiente of separado.pendientes) {
      try {
        const comprimida = await comprimirEvidencia(pendiente);
        await cliente.subirArchivo(pendiente.ruta, comprimida.data);
        subidas.add(pendiente.ruta);
        delete locales[pendiente.ruta];
      } catch {
        locales[pendiente.ruta] = {
          data: pendiente.data,
          type: pendiente.type,
          name: pendiente.name,
        };
      }
    }
    guardarMapa(almacenamiento, CLAVE_EVIDENCIAS, locales);
    for (const evidencia of listaEvidencias(separado.estado)) {
      if (subidas.has(evidencia.ruta)) evidencia.pendiente = false;
    }
    return separado.estado;
  }

  async function adjuntarEvidencias(estado) {
    const locales = mapa(almacenamiento, CLAVE_EVIDENCIAS);
    await Promise.all(
      listaEvidencias(estado).map(async (evidencia) => {
        if (locales[evidencia.ruta]?.data) {
          evidencia.data = locales[evidencia.ruta].data;
          return;
        }
        const data = await cliente.leerArchivo(evidencia.ruta);
        if (data) evidencia.data = data;
      }),
    );
    return estado;
  }

  async function escribirEstadoCompleto(estado, origen) {
    const listo = await prepararEvidencias(prepararEstadoNube(estado));
    const remoto = await piezas();
    const antes = estadoDesdeDocumentos(remoto.principal, remoto.documentos);
    const cambios = diferencias(
      quitarDatosEvidencia(antes),
      quitarDatosEvidencia(listo),
    );
    const revision = (remoto.principal?.revision || 0) + 1;
    cambios.push({
      tipo: "poner",
      coleccion: "estado",
      id: "principal",
      datos: principalDesdeEstado(listo, {
        revision,
        origen,
        trabajadoresActivos: trabajadoresActivosDe(listo),
      }),
    });
    await cliente.aplicarLote(cambios);
    await sincronizarAcceso(listo);
    await cliente.escribirDocumento("estado", "publico", {
      adminConfigurado: true,
    });
  }

  async function migrarSiCorresponde(manual = false) {
    const principal = await cliente.leerDocumento("estado", "principal");
    const local = await leerEstadoLocal();
    const aporta = localAportaDatos(local);
    if (!principal && !aporta) {
      await escribirEstadoCompleto(await semilla(), "semilla");
      return "semilla";
    }
    const decision = decidirMigracion({
      marca: manual ? "" : almacenamiento.getItem(MARCA),
      localAporta: aporta,
      remotoVacio: !principal,
      origenRemoto: principal?.origen || "",
      remotoSinOperacion: principal ? await remotoSinOperacion() : true,
    });
    if (decision === "subir" || decision === "sustituir-semilla") {
      await escribirEstadoCompleto(local, "navegador");
      almacenamiento.setItem(MARCA, "hecha");
      aviso = "";
      return decision;
    }
    if (decision === "conflicto") {
      aviso =
        "Hay información en Firebase y también en este navegador. No se reemplazó nada. Descarga un respaldo desde Reportes. La guía está en documentacion/firebase.md.";
      if (!manual) almacenamiento.setItem(MARCA, "omitida");
      if (manual) throw Error(aviso);
    }
    return decision;
  }

  async function cuentasDeAdmin() {
    if (cuentaActual?.rol !== "admin") return [];
    return (await cliente.leerColeccion("cuentas")).map(({ id, datos }) => ({
      uid: id,
      ...datos,
    }));
  }

  async function cargarEstado(cuenta) {
    const principal = await cliente.leerDocumento("estado", "principal");
    const documentos = {};
    for (const consulta of expandirConsultas(consultasDe(cuenta))) {
      const nombre = consulta.definicion.coleccion;
      const lista = await cliente.leerColeccion(nombre, consulta.restricciones);
      documentos[nombre] = [...(documentos[nombre] || []), ...lista];
    }
    const cuentas = cuenta.rol === "admin" ? await cuentasDeAdmin() : [cuenta];
    const estado = await adjuntarEvidencias(
      armarEstado(principal, documentos, cuenta, cuentas),
    );
    return estado;
  }

  function programarRecarga() {
    if (escribiendo || !cuentaActual) return;
    const uid = cliente.auth.usuario()?.uid;
    if (!uid) return;
    void (async () => {
      const cuenta = await cliente.leerDocumento("cuentas", uid);
      if (!cuenta?.activo || escribiendo) return;
      const filtrosCambiaron =
        JSON.stringify(cuenta.bitacoras || []) !==
          JSON.stringify(cuentaActual?.bitacoras || []) ||
        cuenta.empresa !== cuentaActual?.empresa;
      cuentaActual = cuenta;
      cache = await cargarEstado(cuenta);
      emitir();
      if (filtrosCambiaron) {
        generacion += 1;
        detenerEscuchas();
        suscribir(cuenta);
      }
    })().catch(() => {
      /* conservar el último estado válido */
    });
  }

  function suscribir(cuenta) {
    const ticket = generacion;
    for (const consulta of expandirConsultas(consultasDe(cuenta))) {
      escuchas.push(
        cliente.escucharColeccion(
          consulta.definicion.coleccion,
          consulta.restricciones,
          () => {
            if (ticket === generacion) programarRecarga();
          },
        ),
      );
    }
    escuchas.push(
      cliente.escucharDocumento("estado", "principal", () => {
        if (ticket === generacion) programarRecarga();
      }),
    );
  }

  async function aplicarSesion() {
    return encolar(() => aplicarSesionEncolada());
  }

  async function aplicarSesionEncolada() {
    const ticket = ++generacion;
    detenerEscuchas();
    const usuario = cliente.auth.usuario();
    if (!usuario) {
      const publico = await cliente.leerDocumento("estado", "publico");
      if (ticket !== generacion) return cache;
      cuentaActual = null;
      cache = estadoPublico(Boolean(publico?.adminConfigurado));
      escuchas.push(
        cliente.escucharDocumento("estado", "publico", (datos) => {
          if (ticket !== generacion || cuentaActual) return;
          cache = estadoPublico(Boolean(datos?.adminConfigurado));
          emitir();
        }),
      );
      emitir();
      return cache;
    }
    const cuenta = await cliente.leerDocumento("cuentas", usuario.uid);
    if (ticket !== generacion) return cache;
    if (!cuenta?.activo) {
      if (cuenta?.activo === false) {
        cuentaActual = null;
        cache = estadoPublico(true);
        emitir();
        throw Error(
          cuenta.rol === "terminal"
            ? "Este equipo fue desvinculado."
            : "La cuenta está bloqueada. Consulta a administración.",
        );
      }
      return cache;
    }
    cuentaActual = cuenta;
    if (cuenta.rol === "admin") await migrarSiCorresponde(false);
    if (ticket !== generacion) return cache;
    cache = await cargarEstado(cuenta);
    if (ticket !== generacion) return cache;
    suscribir(cuenta);
    emitir();
    return cache;
  }

  async function entrarTerminalSiCorresponde() {
    if (cliente.auth.usuario()) return;
    let hash;
    try {
      hash = globalThis.location?.hash || "";
    } catch {
      hash = "";
    }
    if (!hash.startsWith("#asistencia")) return;
    const crudo = almacenamiento.getItem(CLAVE_TERMINAL);
    if (!crudo) return;
    const credencial = JSON.parse(crudo);
    try {
      await cliente.auth.entrar(credencial.correo, credencial.contrasena);
    } catch {
      throw Error(
        "No se pudo abrir la terminal vinculada. Pide a María que la vuelva a vincular.",
      );
    }
  }

  async function sincronizarAcceso(estado) {
    if (cuentaActual?.rol !== "admin") return;
    const ids = new Set([
      ...Object.keys(estado.access?.permissions || {}),
      ...Object.keys(estado.access?.workers || {}),
    ]);
    for (const id of ids) {
      const indice = await cliente.leerDocumento("indiceCuentas", id);
      if (!indice?.uid || id.startsWith("terminal-")) continue;
      const permiso = estado.access.permissions?.[id];
      const credencial = estado.access.workers?.[id];
      await cliente.escribirDocumento("cuentas", indice.uid, {
        rol: "trabajador",
        idEmpleado: id,
        empresa: permiso?.company || null,
        bitacoras: permiso?.logs || [],
        activo: credencial ? credencial.active !== false : true,
        correo: indice.correo || correoDeIdentificador(id, dominio),
      });
    }
  }

  async function restablecerContrasena(id, correo, contrasena) {
    if (cliente.auth.restablecer)
      return cliente.auth.restablecer(correo, contrasena);
    if (!configuracion.funcionContrasena)
      throw Error(
        "Esa contraseña ya está registrada. Para cambiarla despliega la función restablecerContrasena y define VITE_FIREBASE_FUNCION_CONTRASENA. La primera asignación no la necesita. Ver documentacion/firebase.md.",
      );
    const respuesta = await fetch(configuracion.funcionContrasena, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await cliente.auth.token()}`,
      },
      body: JSON.stringify({ idEmpleado: id, contrasena }),
    });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok)
      throw Error(cuerpo.error || "No se pudo restablecer la contraseña.");
  }

  async function provisionarTerminales(antes, despues) {
    const dispositivo = idDispositivo();
    const previas = new Map(
      (antes.terminals || []).map((item) => [item.id, item]),
    );
    for (const terminal of despues.terminals || []) {
      const previa = previas.get(terminal.id);
      if (terminal.kind !== "asistencia") continue;
      const indiceId = `terminal-${terminal.id}`;
      if (terminal.active && !previa?.active && terminal.id === dispositivo) {
        const correo = correoDeIdentificador(indiceId, dominio);
        let indice = await cliente.leerDocumento("indiceCuentas", indiceId);
        let contrasena = JSON.parse(
          almacenamiento.getItem(CLAVE_TERMINAL) || "{}",
        ).contrasena;
        if (!indice) {
          contrasena = contrasenaDeTerminal();
          const creado = await cliente.auth.registrarSecundario(
            correo,
            contrasena,
          );
          await cliente.escribirDocumento("cuentas", creado.uid, {
            rol: "terminal",
            idEmpleado: indiceId,
            terminalId: terminal.id,
            activo: true,
            correo,
            empresa: null,
            bitacoras: [],
          });
          await cliente.crearDocumento("indiceCuentas", indiceId, {
            uid: creado.uid,
            correo,
          });
        } else {
          await cliente.escribirDocumento("cuentas", indice.uid, {
            activo: true,
          });
          if (!contrasena) {
            contrasena = contrasenaDeTerminal();
            await restablecerContrasena(indiceId, correo, contrasena);
          }
        }
        almacenamiento.setItem(
          CLAVE_TERMINAL,
          JSON.stringify({ correo, contrasena }),
        );
      }
      if (!terminal.active && previa?.active) {
        const indice = await cliente.leerDocumento("indiceCuentas", indiceId);
        if (indice?.uid)
          await cliente.escribirDocumento("cuentas", indice.uid, {
            activo: false,
          });
        if (terminal.id === dispositivo)
          almacenamiento.removeItem(CLAVE_TERMINAL);
      }
    }
  }

  function respaldar(estado) {
    try {
      const previas = JSON.parse(almacenamiento.getItem(BACKUP_KEY) || "[]");
      const hoy = localDate();
      if (previas.some((item) => item.date === hoy)) return;
      almacenamiento.setItem(
        BACKUP_KEY,
        JSON.stringify(
          [
            { date: hoy, state: quitarDatosEvidencia(structuredClone(estado)) },
            ...previas,
          ].slice(0, 7),
        ),
      );
    } catch {
      /* la copia diaria no debe impedir el guardado */
    }
  }

  async function transact(update) {
    return encolar(async () => {
      if (!cuentaActual?.activo) throw Error("Inicia sesión para guardar.");
      escribiendo += 1;
      try {
        const actual = structuredClone(
          cache || (await cargarEstado(cuentaActual)),
        );
        const calculado = update(structuredClone(actual));
        const next = validateState(
          sanitizar({
            ...calculado,
            attendance: (calculado.attendance || []).map(marcarSincronizado),
          }),
        );
        const preparado = await prepararEvidencias(next);
        const cambios = diferencias(
          quitarDatosEvidencia(actual),
          quitarDatosEvidencia(preparado),
        );
        for (const cambio of cambios) {
          if (!puedeEscribir(cuentaActual, cambio))
            throw Error("No tienes permiso para guardar ese cambio.");
        }
        if (cuentaActual.rol === "admin") {
          const principal = await cliente.leerDocumento("estado", "principal");
          cambios.push({
            tipo: "poner",
            coleccion: "estado",
            id: "principal",
            datos: principalDesdeEstado(preparado, {
              revision: (principal?.revision || 0) + 1,
              origen: principal?.origen || "navegador",
              trabajadoresActivos: trabajadoresActivosDe(preparado),
            }),
          });
        }
        await cliente.aplicarLote(cambios);
        await sincronizarAcceso(preparado);
        await provisionarTerminales(actual, preparado);
        respaldar(actual);
        cache = preparado;
        emitir();
        return structuredClone(cache);
      } finally {
        escribiendo -= 1;
        programarRecarga();
      }
    });
  }

  cliente.auth.escuchar(() => {
    void aplicarSesion().catch((error) => {
      aviso = error.message;
    });
  });

  return {
    get aviso() {
      return aviso;
    },
    async load() {
      await entrarTerminalSiCorresponde();
      return aplicarSesion();
    },
    transact,
    subscribe(oyente) {
      oyentes.add(oyente);
      if (cache) oyente(structuredClone(cache));
      return () => oyentes.delete(oyente);
    },
    backups: () => {
      try {
        return JSON.parse(almacenamiento.getItem(BACKUP_KEY) || "[]");
      } catch {
        return [];
      }
    },
    async autenticar(id, contrasena) {
      const clave = id.trim().toUpperCase();
      try {
        await cliente.auth.entrar(
          correoDeIdentificador(clave, dominio),
          contrasena,
        );
      } catch (error) {
        throw mensajeAuth(error);
      }
      const estado = await aplicarSesion();
      if (!cuentaActual?.activo)
        throw Error(
          "La cuenta no está autorizada. María debe crearla en Seguridad.",
        );
      if (clave === "MARIA") {
        if (cuentaActual.rol !== "admin")
          throw Error("ID o contraseña incorrectos.");
        return { id: "MARIA", name: "María", role: "admin" };
      }
      const empleado = estado.employees.find(
        (item) => item.id_empleado === clave && item.estatus !== "Baja",
      );
      if (
        cuentaActual.rol !== "trabajador" ||
        cuentaActual.idEmpleado !== clave ||
        !empleado
      )
        throw Error("ID o contraseña incorrectos.");
      return { id: clave, name: empleado.nombre_completo, role: "worker" };
    },
    async configurarAdministrador(contrasena) {
      if (contrasena.length < 6)
        throw Error("La contraseña debe tener al menos 6 caracteres.");
      const correo = correoDeIdentificador("MARIA", dominio);
      if (await cliente.leerDocumento("indiceCuentas", "MARIA"))
        throw Error("La administración ya está configurada.");
      try {
        await cliente.auth.registrarPrincipal(correo, contrasena);
      } catch (error) {
        if (error.code !== "auth/email-already-in-use")
          throw mensajeAuth(error);
        try {
          await cliente.auth.entrar(correo, contrasena);
        } catch (acceso) {
          throw mensajeAuth(acceso);
        }
      }
      const uid = cliente.auth.usuario()?.uid;
      if (!uid) throw Error("No se pudo abrir la sesión de María.");
      if (
        (await cliente.leerDocumento("cuentas", uid))?.rol === "admin" &&
        (await cliente.leerDocumento("indiceCuentas", "MARIA"))
      )
        throw Error("La administración ya está configurada.");
      await cliente.escribirDocumento("cuentas", uid, {
        rol: "admin",
        idEmpleado: "MARIA",
        activo: true,
        correo,
        empresa: null,
        bitacoras: [],
      });
      try {
        await cliente.crearDocumento("indiceCuentas", "MARIA", { uid, correo });
      } catch (error) {
        if (!String(error.message).includes("Ya existe")) throw error;
      }
      await cliente.escribirDocumento("estado", "publico", {
        adminConfigurado: true,
      });
      return aplicarSesion();
    },
    async asignarContrasena(
      idEmpleado,
      contrasena,
      etiqueta = "Contraseña actualizada",
    ) {
      if (contrasena.length < 6)
        throw Error("La contraseña debe tener al menos 6 caracteres.");
      const id = idEmpleado.trim().toUpperCase();
      const correo = correoDeIdentificador(id, dominio);
      const indice = await cliente.leerDocumento("indiceCuentas", id);
      if (!indice) {
        try {
          const creado = await cliente.auth.registrarSecundario(
            correo,
            contrasena,
          );
          await cliente.escribirDocumento("cuentas", creado.uid, {
            rol: "trabajador",
            idEmpleado: id,
            empresa: cache?.access?.permissions?.[id]?.company || null,
            bitacoras: cache?.access?.permissions?.[id]?.logs || [],
            activo: true,
            correo,
          });
          await cliente.crearDocumento("indiceCuentas", id, {
            uid: creado.uid,
            correo,
          });
        } catch (error) {
          if (error.code !== "auth/email-already-in-use")
            throw mensajeAuth(error);
          await restablecerContrasena(id, correo, contrasena);
        }
      } else await restablecerContrasena(id, correo, contrasena);
      return transact((estado) => ({
        ...estado,
        access: {
          ...estado.access,
          workers: {
            ...estado.access.workers,
            [id]: {
              proveedor: "firebase",
              active: true,
              hash: "firebase",
              correo,
            },
          },
        },
        audit: [
          {
            id: crypto.randomUUID(),
            action: etiqueta,
            employeeId: id,
            by: "MARIA",
            when: new Date().toISOString(),
          },
          ...estado.audit,
        ],
      }));
    },
    async cambiarEstadoTrabajador(idEmpleado, activo) {
      const id = idEmpleado.trim().toUpperCase();
      return transact((estado) => ({
        ...estado,
        access: {
          ...estado.access,
          workers: {
            ...estado.access.workers,
            [id]: {
              ...(estado.access.workers[id] || { proveedor: "firebase" }),
              active: activo,
            },
          },
        },
        audit: [
          {
            id: crypto.randomUUID(),
            action: activo ? "Habilitar acceso" : "Bloquear acceso",
            employeeId: id,
            by: "MARIA",
            when: new Date().toISOString(),
          },
          ...estado.audit,
        ],
      }));
    },
    async cambiarContrasenaAdministrador(contrasena) {
      if (contrasena.length < 6)
        throw Error("La contraseña debe tener al menos 6 caracteres.");
      await cliente.auth.cambiarContrasena(contrasena);
    },
    async verificarTrabajador(id, contrasena) {
      const clave = id.trim().toUpperCase();
      try {
        await cliente.auth.entrarSecundario(
          correoDeIdentificador(clave, dominio),
          contrasena,
        );
      } catch (error) {
        throw mensajeAuth(error);
      }
    },
    async cerrarSesion() {
      await cliente.auth.salir();
      return aplicarSesion();
    },
    async subirDatosLocales() {
      if (cuentaActual?.rol !== "admin")
        throw Error("Se requiere acceso de María.");
      const resultado = await migrarSiCorresponde(true);
      if (resultado === "omitir")
        throw Error("Este navegador no tiene datos locales nuevos para subir.");
      cache = await cargarEstado(cuentaActual);
      emitir();
      return "Datos de este navegador enviados a Firebase.";
    },
  };
}

export async function crearRepositorioFirestore(
  configuracion,
  almacenamiento = globalThis.localStorage,
) {
  const { crearClienteFirebase } = await import("./clienteFirebase.js");
  return createFirestoreRepository({
    configuracion,
    cliente: await crearClienteFirebase(configuracion),
    almacenamiento,
  });
}
