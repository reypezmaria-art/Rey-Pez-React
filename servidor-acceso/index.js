import control from "../firebase/funciones/controlAcceso.js";
import { crearGoogle, fallo } from "./google.js";

const { crearControlAcceso } = control;
const accionesClave = ["set", "reset", "change"];
function normalizar(id) {
  const key = String(id || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9._-]{1,128}$/.test(key))
    throw fallo("invalid-argument", "Escribe un ID válido.");
  return key;
}
function correo(id, env) {
  return `${normalizar(id).toLowerCase()}@${env.AUTH_EMAIL_DOMAIN || "acceso.reypez.app"}`;
}
async function leerSolicitud(request) {
  const lector = request.body?.getReader();
  if (!lector) return "";
  const decoder = new TextDecoder();
  let longitud = 0,
    texto = "";
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) return texto + decoder.decode();
      longitud += value.byteLength;
      if (longitud > 8192) {
        await lector.cancel();
        throw fallo("invalid-argument", "Solicitud demasiado grande.");
      }
      texto += decoder.decode(value, { stream: true });
    }
  } finally {
    lector.releaseLock();
  }
}
async function usuarioPorCorreo(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === "auth/user-not-found") return null;
    throw e;
  }
}
async function exigirAdmin(request, { db, auth }) {
  const bearer = request.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer "))
    throw fallo("unauthenticated", "Inicia sesión como María.");
  const identidad = await auth.verifyIdToken(bearer.slice(7));
  const [admin, bloqueo] = await Promise.all([
    db.doc("acceso/admin").get(),
    db.doc("controlAccesos/MARIA").get(),
  ]);
  if (admin.get("uid") !== identidad.uid || bloqueo.get("bloqueado"))
    throw fallo("permission-denied", "Solo María puede administrar accesos.");
  return identidad;
}
async function gestionar(datos, request, services, env) {
  const identidad = await exigirAdmin(request, services);
  const { auth, db } = services;
  const accion = datos.accion;
  if (["vincularTerminal", "desvincularTerminal"].includes(accion)) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(datos.deviceId || ""))
      throw fallo("invalid-argument", "Equipo no válido.");
    const email = correo(`terminal-${datos.deviceId}`, env);
    let user = await usuarioPorCorreo(auth, email);
    if (accion === "desvincularTerminal") {
      if (user) {
        await auth.updateUser(user.uid, { disabled: true });
        await auth.revokeRefreshTokens(user.uid);
        await db
          .doc(`usuarios/${user.uid}`)
          .set({ activo: false }, { merge: true });
      }
      return { ok: true };
    }
    if (!user)
      user = await auth.createUser({
        email,
        password: `${crypto.randomUUID()}Aa1`,
      });
    else if (user.disabled)
      await auth.updateUser(user.uid, { disabled: false });
    await auth.setCustomUserClaims(user.uid, {
      rol: "terminal",
      deviceId: datos.deviceId,
    });
    await db.doc(`usuarios/${user.uid}`).set(
      {
        rol: "terminal",
        deviceId: datos.deviceId,
        nombre: String(datos.nombre || "Terminal").slice(0, 120),
        tipo: datos.tipo === "asistencia" ? "asistencia" : "captura",
        activo: true,
      },
      { merge: true },
    );
    return {
      token: await auth.createCustomToken(user.uid, { rol: "terminal" }),
    };
  }
  const id = normalizar(datos.idEmpleado);
  const empleado = await db.doc(`empleados/${id}`).get();
  if (id === "MARIA" || !empleado.exists)
    throw fallo("invalid-argument", "Selecciona un empleado registrado.");
  if (![...accionesClave, "enable", "block"].includes(accion))
    throw fallo("invalid-argument", "Acción no reconocida.");
  if (
    (accionesClave.includes(accion) || accion === "enable") &&
    empleado.get("estatus") === "Baja"
  )
    throw fallo(
      "failed-precondition",
      "Primero revisa el estado de baja del empleado.",
    );
  const email = correo(id, env);
  let user = await usuarioPorCorreo(auth, email);
  if (accionesClave.includes(accion)) {
    if (
      typeof datos.contrasena !== "string" ||
      datos.contrasena.length < 6 ||
      datos.contrasena.length > 4096
    )
      throw fallo(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres.",
      );
    if (!user)
      user = await auth.createUser({ email, password: datos.contrasena });
    else
      await auth.updateUser(user.uid, {
        password: datos.contrasena,
        disabled: false,
      });
    await auth.revokeRefreshTokens(user.uid);
    await db.doc(`usuarios/${user.uid}`).set(
      {
        rol: "trabajador",
        idEmpleado: id,
        activo: true,
        bloqueoAutomatico: false,
      },
      { merge: true },
    );
  } else {
    if (!user)
      throw fallo(
        "failed-precondition",
        "Ese empleado aún no tiene contraseña.",
      );
    const activo = accion === "enable";
    await auth.updateUser(user.uid, { disabled: !activo });
    if (!activo) await auth.revokeRefreshTokens(user.uid);
    await db
      .doc(`usuarios/${user.uid}`)
      .set({ activo, bloqueoAutomatico: false }, { merge: true });
  }
  await db.doc(`controlAccesos/${id}`).set(
    {
      intentos: 0,
      bloqueado: accion === "block",
      desbloqueadoPor: identidad.uid,
      actualizado: new Date().toISOString(),
    },
    { merge: true },
  );
  return { uid: user.uid };
}
async function denegar(datos, request, { auth, db }) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw fallo("unauthenticated", "Inicia sesión.");
  const identidad = await auth.verifyIdToken(token);
  const ficha = await db.doc(`usuarios/${identidad.uid}`).get();
  if (ficha.get("rol") !== "trabajador" || ficha.get("activo") !== true)
    throw fallo("permission-denied", "La cuenta no está activa.");
  const id = normalizar(ficha.get("idEmpleado"));
  const bloqueo = await db.doc(`controlAccesos/${id}`).get();
  if (bloqueo.get("bloqueado"))
    throw fallo("permission-denied", "La cuenta está bloqueada.");
  const modulo = String(datos.modulo || "").slice(0, 150);
  const [configSnap, empleadoSnap] = await Promise.all([
    db.doc("operacion/config").get(),
    db.doc(`empleados/${id}`).get(),
  ]);
  const config = configSnap.data() || {},
    empleado = empleadoSnap.data() || {},
    permiso = config.permissions?.[id];
  const cuarto = (config.rooms || []).find((a) => a.id === modulo),
    area = cuarto || (config.areas || []).find((a) => a.id === modulo);
  const empresaValida = permiso?.company === empleado.empresa_codigo;
  const autorizado =
    empresaValida &&
    area &&
    area.active !== false &&
    permiso?.company === area.company &&
    (cuarto ? permiso.logs?.includes("temperature") : permiso.logs?.length > 0);
  if (
    autorizado ||
    (modulo === "bitacoras" && empresaValida && permiso?.logs?.length)
  )
    return { registrado: false };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${identidad.uid}:${modulo}:${Math.floor(Date.now() / 10000)}`,
    ),
  );
  const alertaId = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await db.doc(`alertasSeguridad/${alertaId}`).set({
    id_alerta: alertaId,
    id_empleado: id,
    nombre_completo: empleado.nombre_completo || id,
    empresa_codigo: empleado.empresa_codigo || "",
    seguridad: true,
    tipo: "Acceso denegado",
    modulo,
    detalle: "Intento de abrir una sección sin autorización.",
    fecha_hora: new Date().toISOString(),
    estado: "Pendiente",
  });
  return { registrado: true };
}

export function crearServidor(crearServicios = crearGoogle) {
  const cache = new WeakMap();
  return {
    async fetch(request, env) {
      const origen = request.headers.get("Origin");
      const permitidos = String(env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        Vary: "Origin",
      };
      if (origen && !permitidos.includes(origen))
        return Response.json(
          {
            error: {
              code: "permission-denied",
              message: "Origen no autorizado.",
            },
          },
          { status: 403, headers },
        );
      if (origen) headers["Access-Control-Allow-Origin"] = origen;
      headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      const pathname = new URL(request.url).pathname;
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      if (request.method === "GET" && pathname === "/salud")
        return Response.json(
          {
            servicio: "rey-pez-acceso",
            version: 1,
            listo: Boolean(
              env.FIREBASE_SERVICE_ACCOUNT &&
              env.FIREBASE_WEB_API_KEY &&
              env.FIREBASE_PROJECT_ID,
            ),
          },
          { headers },
        );
      const nombre = pathname.replace(/^\//, "");
      if (
        ![
          "autenticarCuenta",
          "gestionarAcceso",
          "registrarAccesoDenegado",
        ].includes(nombre)
      )
        return Response.json(
          { error: { code: "not-found", message: "Ruta no disponible." } },
          { status: 404, headers },
        );
      if (request.method !== "POST")
        return Response.json(
          { error: { code: "invalid-argument", message: "Usa POST." } },
          { status: 405, headers },
        );
      try {
        if (
          !request.headers.get("Content-Type")?.startsWith("application/json")
        )
          throw fallo("invalid-argument", "Formato no válido.");
        if (Number(request.headers.get("Content-Length") || 0) > 8192)
          throw fallo("invalid-argument", "Solicitud demasiado grande.");
        const texto = await leerSolicitud(request);
        let datos;
        try {
          datos = JSON.parse(texto);
        } catch {
          throw fallo("invalid-argument", "Formato no válido.");
        }
        if (!datos || typeof datos !== "object" || Array.isArray(datos))
          throw fallo("invalid-argument", "Datos no válidos.");
        if (!env.FIREBASE_WEB_API_KEY)
          throw fallo(
            "failed-precondition",
            "Falta configurar el servidor de acceso.",
          );
        if (!cache.has(env)) cache.set(env, crearServicios(env));
        const services = cache.get(env);
        let result;
        if (nombre === "autenticarCuenta") {
          const id = normalizar(datos.id);
          result = await crearControlAcceso({
            ...services,
            desactivarAuth: false,
          })(id, datos.contrasena, correo(id, env));
        } else if (nombre === "gestionarAcceso")
          result = await gestionar(datos, request, services, env);
        else result = await denegar(datos, request, services);
        return Response.json({ data: result }, { headers });
      } catch (e) {
        const mensajes = {
          EMAIL_EXISTS: "Esa cuenta ya existe.",
          INVALID_PASSWORD: "La contraseña debe tener al menos 6 caracteres.",
        };
        const seguros = [
          "invalid-argument",
          "unauthenticated",
          "permission-denied",
          "failed-precondition",
          "unavailable",
          "not-found",
        ];
        const code = seguros.includes(e.code) ? e.code : "unavailable";
        const message = seguros.includes(e.code)
          ? e.message
          : mensajes[e.code] ||
            "No se pudo completar el acceso. Intenta de nuevo.";
        const status = {
          "invalid-argument": 400,
          unauthenticated: 401,
          "permission-denied": 403,
          "not-found": 404,
          "failed-precondition": 503,
          unavailable: 503,
        }[code];
        // Nunca devolver ni registrar credenciales, tokens o respuestas internas de Google.
        return Response.json(
          {
            error: {
              code,
              message,
              ...(e.details?.bloqueado ? { details: { bloqueado: true } } : {}),
            },
          },
          { status, headers },
        );
      }
    },
  };
}
export default crearServidor();
