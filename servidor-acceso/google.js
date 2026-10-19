// Adaptador para el runtime gratuito de Workers: Web Crypto y APIs REST oficiales.
// La credencial técnica solo se recibe como secreto del servidor.
const encoder = new TextEncoder();
const algoritmo = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
export const fallo = (code, message, details) =>
  Object.assign(new Error(message), { code, details });

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
const json64 = (value) => base64url(encoder.encode(JSON.stringify(value)));
function leer64(value) {
  const bytes = Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  return bytes;
}
export function codificar(valor) {
  if (valor === null) return { nullValue: null };
  if (typeof valor === "string") return { stringValue: valor };
  if (typeof valor === "boolean") return { booleanValue: valor };
  if (typeof valor === "number" && Number.isFinite(valor))
    return Number.isInteger(valor)
      ? { integerValue: String(valor) }
      : { doubleValue: valor };
  if (Array.isArray(valor))
    return { arrayValue: { values: valor.map(codificar) } };
  if (valor && typeof valor === "object")
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(valor).map(([k, v]) => [k, codificar(v)]),
        ),
      },
    };
  throw fallo("invalid-argument", "El dato no es válido.");
}
export function decodificar(valor) {
  if ("nullValue" in valor) return null;
  if ("stringValue" in valor) return valor.stringValue;
  if ("timestampValue" in valor) return valor.timestampValue;
  if ("booleanValue" in valor) return valor.booleanValue;
  if ("integerValue" in valor) return Number(valor.integerValue);
  if ("doubleValue" in valor) return valor.doubleValue;
  if ("arrayValue" in valor)
    return (valor.arrayValue.values || []).map(decodificar);
  if ("mapValue" in valor)
    return Object.fromEntries(
      Object.entries(valor.mapValue.fields || {}).map(([k, v]) => [
        k,
        decodificar(v),
      ]),
    );
  throw fallo("internal", "Tipo de dato no compatible.");
}

export function crearGoogle(env, { fetchImpl = fetch, ahora = Date.now } = {}) {
  let cuenta;
  try {
    cuenta = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "");
  } catch {
    throw fallo(
      "failed-precondition",
      "Falta autorizar el servidor de acceso.",
    );
  }
  const proyecto = env.FIREBASE_PROJECT_ID;
  if (
    !/^[a-z0-9-]+$/.test(proyecto || "") ||
    cuenta.project_id !== proyecto ||
    !cuenta.client_email ||
    !cuenta.private_key
  )
    throw fallo(
      "failed-precondition",
      "La configuración del servidor no coincide con el proyecto.",
    );
  const documentos = `projects/${proyecto}/databases/(default)/documents`;
  const origenDatos = `https://firestore.googleapis.com/v1/${documentos}`;
  const origenAuth = `https://identitytoolkit.googleapis.com/v1/projects/${proyecto}/accounts`;
  let llave, acceso, pendiente, llavesPublicas;
  async function firmar(payload) {
    if (!llave) {
      const pem = cuenta.private_key
        .replace(/-----[^-]+-----/g, "")
        .replace(/\s/g, "");
      llave = crypto.subtle.importKey(
        "pkcs8",
        Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
        algoritmo,
        false,
        ["sign"],
      );
    }
    const header = {
      alg: "RS256",
      typ: "JWT",
      ...(cuenta.private_key_id ? { kid: cuenta.private_key_id } : {}),
    };
    const cuerpo = `${json64(header)}.${json64(payload)}`;
    const firma = await crypto.subtle.sign(
      algoritmo,
      await llave,
      encoder.encode(cuerpo),
    );
    return `${cuerpo}.${base64url(new Uint8Array(firma))}`;
  }
  async function solicitar(url, options = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw fallo(
        "unavailable",
        "No hay conexión con el servicio de acceso. Intenta de nuevo.",
      );
    }
    let datos;
    try {
      datos = await response.json();
    } catch {
      throw fallo(
        "unavailable",
        "El servicio no pudo responder. Intenta de nuevo.",
      );
    }
    if (!response.ok) {
      const motivo = String(datos.error?.message || "").split(" : ")[0];
      const code = /^[A-Z_]+$/.test(motivo)
        ? motivo
        : datos.error?.status || "UNKNOWN";
      const error = fallo(code, "El servicio no pudo completar la operación.");
      error.status = response.status;
      throw error;
    }
    return { datos, response };
  }
  async function tokenGoogle() {
    if (acceso && acceso.hasta > ahora() + 60000) return acceso.token;
    if (!pendiente)
      pendiente = (async () => {
        const iat = Math.floor(ahora() / 1000);
        const assertion = await firmar({
          iss: cuenta.client_email,
          scope: "https://www.googleapis.com/auth/cloud-platform",
          aud: "https://oauth2.googleapis.com/token",
          iat,
          exp: iat + 3600,
        });
        const { datos } = await solicitar(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion,
            }).toString(),
          },
        );
        if (!datos.access_token)
          throw fallo("unavailable", "No se pudo autorizar el servidor.");
        acceso = {
          token: datos.access_token,
          hasta: ahora() + Number(datos.expires_in || 3600) * 1000,
        };
        return acceso.token;
      })().finally(() => {
        pendiente = null;
      });
    return pendiente;
  }
  async function api(url, { method = "POST", body } = {}) {
    const token = await tokenGoogle();
    return (
      await solicitar(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    ).datos;
  }
  function referencia(path) {
    if (
      typeof path !== "string" ||
      path.split("/").length !== 2 ||
      path
        .split("/")
        .some(
          (p) =>
            !p ||
            p.length > 1500 ||
            /[?#]/.test(p) ||
            [...p].some((c) => c.charCodeAt(0) < 32),
        )
    )
      throw fallo("invalid-argument", "Referencia no válida.");
    return {
      path,
      get: () => leer(path),
      set: (datos, options) =>
        escribir([{ path, datos, merge: options?.merge }]),
    };
  }
  async function leer(path) {
    let raw;
    try {
      raw = await api(
        `${origenDatos}/${path.split("/").map(encodeURIComponent).join("/")}`,
        { method: "GET" },
      );
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const valor = raw
      ? Object.fromEntries(
          Object.entries(raw.fields || {}).map(([k, v]) => [k, decodificar(v)]),
        )
      : undefined;
    return {
      exists: Boolean(raw),
      updateTime: raw?.updateTime,
      data: () => valor,
      get: (campo) => valor?.[campo],
    };
  }
  async function escribir(operaciones, lecturas = new Map()) {
    if (!operaciones.length) return;
    const writes = operaciones.map(({ path, datos, merge }) => {
      const snapshot = lecturas.get(path);
      const fields = Object.fromEntries(
        Object.entries(datos).map(([k, v]) => [k, codificar(v)]),
      );
      return {
        update: { name: `${documentos}/${path}`, fields },
        ...(merge ? { updateMask: { fieldPaths: Object.keys(fields) } } : {}),
        ...(snapshot
          ? {
              currentDocument: snapshot.exists
                ? { updateTime: snapshot.updateTime }
                : { exists: false },
            }
          : {}),
      };
    });
    await api(`${origenDatos}:commit`, { body: { writes } });
  }
  const db = {
    doc: referencia,
    async runTransaction(update) {
      for (let intento = 0; intento < 5; intento++) {
        const lecturas = new Map(),
          escrituras = [];
        const resultado = await update({
          get: async (ref) => {
            if (escrituras.length)
              throw fallo(
                "internal",
                "Las lecturas deben preceder a las escrituras.",
              );
            const snap = await leer(ref.path);
            lecturas.set(ref.path, snap);
            return snap;
          },
          set: (ref, datos, options) =>
            escrituras.push({ path: ref.path, datos, merge: options?.merge }),
        });
        try {
          await escribir(escrituras, lecturas);
          return resultado;
        } catch (e) {
          if (
            ![409, 412].includes(e.status) &&
            !["ABORTED", "FAILED_PRECONDITION", "ALREADY_EXISTS"].includes(
              e.code,
            )
          )
            throw e;
        }
      }
      throw fallo(
        "unavailable",
        "Hubo intentos simultáneos. Intenta de nuevo.",
      );
    },
  };
  function usuario(raw) {
    return {
      ...raw,
      uid: raw.localId,
      disabled: raw.disabled === true || raw.disableUser === true,
    };
  }
  async function buscar(filtro) {
    const result = await api(`${origenAuth}:lookup`, { body: filtro });
    if (!result.users?.length)
      throw fallo("auth/user-not-found", "No existe esa cuenta.");
    return usuario(result.users[0]);
  }
  const auth = {
    getUserByEmail: (email) => buscar({ email: [email] }),
    getUser: (uid) => buscar({ localId: [uid] }),
    async updateUser(uid, options) {
      const { disabled, ...resto } = options;
      const result = await api(`${origenAuth}:update`, {
        body: {
          localId: uid,
          ...resto,
          ...(disabled === undefined ? {} : { disableUser: disabled }),
        },
      });
      return usuario(result);
    },
    async createUser(options) {
      const result = await api(
        `${origenAuth}?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
        { body: options },
      );
      return usuario(result);
    },
    setCustomUserClaims: (uid, claims) =>
      auth.updateUser(uid, { customAttributes: JSON.stringify(claims) }),
    revokeRefreshTokens: (uid) =>
      auth.updateUser(uid, { validSince: String(Math.floor(ahora() / 1000)) }),
    async createCustomToken(uid, claims = {}) {
      if (typeof uid !== "string" || !uid || uid.length > 128)
        throw fallo("invalid-argument", "Cuenta no válida.");
      const iat = Math.floor(ahora() / 1000);
      return firmar({
        iss: cuenta.client_email,
        sub: cuenta.client_email,
        aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
        iat,
        exp: iat + 3600,
        uid,
        claims,
      });
    },
    async verifyIdToken(token) {
      let header, payload, firma, cuerpo;
      try {
        const partes = token.split(".");
        if (partes.length !== 3) throw Error();
        header = JSON.parse(new TextDecoder().decode(leer64(partes[0])));
        payload = JSON.parse(new TextDecoder().decode(leer64(partes[1])));
        firma = leer64(partes[2]);
        cuerpo = `${partes[0]}.${partes[1]}`;
      } catch {
        throw fallo("unauthenticated", "Inicia sesión de nuevo.");
      }
      const segundos = Math.floor(ahora() / 1000);
      if (
        header.alg !== "RS256" ||
        typeof header.kid !== "string" ||
        payload.aud !== proyecto ||
        payload.iss !== `https://securetoken.google.com/${proyecto}` ||
        typeof payload.sub !== "string" ||
        !payload.sub ||
        payload.sub.length > 128 ||
        !Number.isInteger(payload.exp) ||
        payload.exp <= segundos ||
        !Number.isInteger(payload.iat) ||
        payload.iat > segundos + 30 ||
        !Number.isInteger(payload.auth_time) ||
        payload.auth_time > segundos + 30
      )
        throw fallo("unauthenticated", "Inicia sesión de nuevo.");
      if (!llavesPublicas || llavesPublicas.hasta <= ahora()) {
        const { datos } = await solicitar(
          "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
          { method: "GET" },
        );
        llavesPublicas = { llaves: datos.keys || [], hasta: ahora() + 3600000 };
      }
      const jwk = llavesPublicas.llaves.find((k) => k.kid === header.kid);
      if (!jwk) throw fallo("unauthenticated", "Inicia sesión de nuevo.");
      const key = await crypto.subtle.importKey("jwk", jwk, algoritmo, false, [
        "verify",
      ]);
      if (
        !(await crypto.subtle.verify(
          algoritmo,
          key,
          firma,
          encoder.encode(cuerpo),
        ))
      )
        throw fallo("unauthenticated", "Inicia sesión de nuevo.");
      const perfil = await auth.getUser(payload.sub);
      if (perfil.disabled || payload.auth_time < Number(perfil.validSince || 0))
        throw fallo("unauthenticated", "La sesión ya no está activa.");
      return { ...payload, uid: payload.sub };
    },
  };
  async function verificar(email, password, uid) {
    try {
      const { datos } = await solicitar(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      const token = await auth.verifyIdToken(datos.idToken);
      if (token.uid !== uid)
        throw fallo("unauthenticated", "ID o contraseña incorrectos.");
      return true;
    } catch (e) {
      if (
        [
          "INVALID_PASSWORD",
          "INVALID_LOGIN_CREDENTIALS",
          "EMAIL_NOT_FOUND",
        ].includes(e.code)
      )
        return false;
      if (e.code === "USER_DISABLED")
        throw fallo(
          "permission-denied",
          "Comunícate con el personal autorizado.",
          { bloqueado: true },
        );
      throw e;
    }
  }
  return { db, auth, verificar };
}
