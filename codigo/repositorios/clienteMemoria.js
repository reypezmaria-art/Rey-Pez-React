function claveDocumento(coleccion, id) {
  return `${coleccion}/${id}`;
}

function cumple(datos, restricciones) {
  return restricciones.every((restriccion) => {
    const valor = datos?.[restriccion.campo];
    if (restriccion.operador === "==") return valor === restriccion.valor;
    if (restriccion.operador === "in") return restriccion.valor.includes(valor);
    return false;
  });
}

export function crearClienteMemoria() {
  const documentos = new Map();
  const archivos = new Map();
  const usuarios = new Map();
  const oyentesDatos = new Set();
  const oyentesAuth = new Set();
  let sesion = null;
  let terminal = null;
  let secuencia = 1;

  const notificarDatos = () => {
    for (const oyente of oyentesDatos) oyente();
  };
  const notificarAuth = () => {
    for (const oyente of oyentesAuth) oyente();
  };
  const exigirUsuario = (correo, contrasena) => {
    const usuario = usuarios.get(correo);
    if (!usuario || usuario.contrasena !== contrasena) {
      const error = Error("ID o contraseña incorrectos.");
      error.code = "auth/invalid-credential";
      throw error;
    }
    return usuario;
  };

  return {
    async leerDocumento(coleccion, id) {
      const datos = documentos.get(claveDocumento(coleccion, id));
      return datos ? structuredClone(datos) : null;
    },
    async leerColeccion(coleccion, restricciones = []) {
      const lista = [];
      for (const [clave, datos] of documentos) {
        const separador = clave.indexOf("/");
        if (clave.slice(0, separador) !== coleccion) continue;
        if (!cumple(datos, restricciones)) continue;
        lista.push({
          id: clave.slice(separador + 1),
          datos: structuredClone(datos),
        });
      }
      return lista;
    },
    escucharDocumento(coleccion, id, callback) {
      const emitir = () => {
        const datos = documentos.get(claveDocumento(coleccion, id));
        callback(datos ? structuredClone(datos) : null);
      };
      oyentesDatos.add(emitir);
      emitir();
      return () => oyentesDatos.delete(emitir);
    },
    escucharColeccion(_coleccion, _restricciones, callback) {
      const emitir = () => callback();
      oyentesDatos.add(emitir);
      return () => oyentesDatos.delete(emitir);
    },
    async crearDocumento(coleccion, id, datos) {
      const clave = claveDocumento(coleccion, id);
      if (documentos.has(clave)) {
        const error = Error("Ya existe.");
        error.code = "already-exists";
        throw error;
      }
      documentos.set(clave, structuredClone(datos));
      notificarDatos();
    },
    async crearDocumentosAtomicos(escrituras) {
      const preparados = escrituras.map((item) => ({
        clave: claveDocumento(item.coleccion, item.id),
        datos: item.datos,
      }));
      if (preparados.some((item) => documentos.has(item.clave))) {
        const error = Error("Ya existe.");
        error.code = "already-exists";
        throw error;
      }
      for (const item of preparados)
        documentos.set(item.clave, structuredClone(item.datos));
      if (preparados.length) notificarDatos();
    },
    async escribirDocumento(coleccion, id, datos) {
      const clave = claveDocumento(coleccion, id);
      documentos.set(clave, {
        ...(documentos.get(clave) || {}),
        ...structuredClone(datos),
      });
      notificarDatos();
    },
    async aplicarLote(cambios) {
      for (const cambio of cambios) {
        const clave = claveDocumento(cambio.coleccion, cambio.id);
        if (cambio.tipo === "borrar") documentos.delete(clave);
        else documentos.set(clave, structuredClone(cambio.datos));
      }
      if (cambios.length) notificarDatos();
    },
    async subirArchivo(ruta, dataUrl) {
      archivos.set(ruta, dataUrl);
    },
    async leerArchivo(ruta) {
      return archivos.get(ruta) || null;
    },
    auth: {
      usuario: () =>
        sesion ? { uid: sesion.uid, email: sesion.correo } : null,
      async entrar(correo, contrasena) {
        sesion = exigirUsuario(correo, contrasena);
        notificarAuth();
        return { uid: sesion.uid, email: sesion.correo };
      },
      async registrarPrincipal(correo, contrasena) {
        if (usuarios.has(correo)) {
          const error = Error("Ese acceso ya está registrado.");
          error.code = "auth/email-already-in-use";
          throw error;
        }
        sesion = { uid: `uid-${secuencia}`, correo, contrasena };
        secuencia += 1;
        usuarios.set(correo, sesion);
        notificarAuth();
        return { uid: sesion.uid, email: correo };
      },
      async registrarSecundario(correo, contrasena) {
        if (usuarios.has(correo)) {
          const error = Error("Ese acceso ya está registrado.");
          error.code = "auth/email-already-in-use";
          throw error;
        }
        const usuario = { uid: `uid-${secuencia}`, correo, contrasena };
        secuencia += 1;
        usuarios.set(correo, usuario);
        return { uid: usuario.uid, email: correo };
      },
      async entrarSecundario(correo, contrasena) {
        const usuario = exigirUsuario(correo, contrasena);
        return { uid: usuario.uid, email: usuario.correo };
      },
      async salir() {
        sesion = null;
        notificarAuth();
      },
      async persistirTerminal(correo, contrasena) {
        terminal = exigirUsuario(correo, contrasena);
      },
      async tieneTerminal() {
        return Boolean(terminal);
      },
      async adoptarTerminal() {
        if (!terminal) return false;
        sesion = terminal;
        notificarAuth();
        return true;
      },
      async cerrarTerminal() {
        const uid = terminal?.uid;
        terminal = null;
        if (sesion?.uid === uid) {
          sesion = null;
          notificarAuth();
        }
      },
      async cambiarContrasena(contrasena) {
        if (!sesion) throw Error("No hay sesión activa.");
        sesion.contrasena = contrasena;
      },
      async token() {
        return sesion ? `token-${sesion.uid}` : "";
      },
      async restablecer(correo, contrasena) {
        const usuario = usuarios.get(correo);
        if (!usuario) throw Error("Ese trabajador todavía no tiene cuenta.");
        usuario.contrasena = contrasena;
      },
      escuchar(callback) {
        oyentesAuth.add(callback);
        return () => oyentesAuth.delete(callback);
      },
    },
  };
}
