import test from "node:test";
import assert from "node:assert/strict";
import { crearServidor } from "../servidor-acceso/index.js";
import {
  crearGoogle,
  codificar,
  decodificar,
} from "../servidor-acceso/google.js";
import { consultarServidorAcceso } from "../codigo/firebase/servidorAcceso.js";
import { mensajeFirebase } from "../codigo/firebase/sesion.js";

const alg = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};
const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
const jwk = {
  ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
  kid: "cert-prueba",
};
const origin = "https://rey-pez-admin-react.web.app";
const proyecto = "demo-rey-pez";
const ahora = Date.now();
function serializar(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
async function jwt(uid, extra = {}) {
  const t = Math.floor(ahora / 1000);
  const unsigned = `${serializar({ alg: "RS256", kid: jwk.kid })}.${serializar({ sub: uid, aud: proyecto, iss: `https://securetoken.google.com/${proyecto}`, auth_time: t, iat: t, exp: t + 3600, ...extra })}`;
  const signature = await crypto.subtle.sign(
    alg,
    keys.privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}
function entorno() {
  let version = 0,
    conflicto = true;
  const documentos = new Map();
  function guardar(path, value) {
    documentos.set(path, {
      value,
      version: new Date(1700000000000 + ++version).toISOString(),
    });
  }
  guardar("acceso/admin", { uid: "maria" });
  guardar("usuarios/worker", {
    rol: "trabajador",
    idEmpleado: "AL-01",
    activo: true,
  });
  guardar("usuarios/worker2", {
    rol: "trabajador",
    idEmpleado: "AL-02",
    activo: true,
  });
  guardar("empleados/AL-01", {
    id_empleado: "AL-01",
    nombre_completo: "PERSONA DEMO",
    empresa_codigo: "ALLAN",
    estatus: "Activo",
  });
  guardar("empleados/AL-02", {
    id_empleado: "AL-02",
    empresa_codigo: "ALLAN",
    estatus: "Activo",
  });
  guardar("operacion/config", {
    permissions: { "AL-01": { company: "ALLAN", logs: ["chlorine"] } },
    rooms: [{ id: "ALLAN-1", company: "ALLAN", active: true }],
  });
  const users = new Map([
    [
      "maria",
      {
        localId: "maria",
        email: "maria@acceso.reypez.app",
        validSince: "0",
        password: "Prueba6",
      },
    ],
    [
      "worker",
      {
        localId: "worker",
        email: "al-01@acceso.reypez.app",
        validSince: "0",
        password: "Prueba6",
      },
    ],
    [
      "worker2",
      {
        localId: "worker2",
        email: "al-02@acceso.reypez.app",
        validSince: "0",
        password: "Prueba6",
      },
    ],
  ]);
  const env = {
    FIREBASE_PROJECT_ID: proyecto,
    FIREBASE_WEB_API_KEY: "api-publica-de-prueba",
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
      project_id: proyecto,
      client_email: "servicio@demo-rey-pez.iam.gserviceaccount.com",
      private_key: privateKey,
      private_key_id: "key-prueba",
    }),
    ALLOWED_ORIGINS: origin,
  };
  const fallo = (status, message, code) =>
    Response.json({ error: { status, message } }, { status: code });
  const fetchGoogle = async (input, options = {}) => {
    const url = new URL(input),
      body =
        typeof options.body === "string" &&
        options.headers?.["Content-Type"] === "application/json"
          ? JSON.parse(options.body)
          : {};
    if (url.origin === "https://oauth2.googleapis.com")
      return Response.json({
        access_token: "oauth-simulado",
        expires_in: 3600,
      });
    if (url.origin === "https://www.googleapis.com")
      return Response.json({ keys: [jwk] });
    if (url.pathname.endsWith("accounts:signInWithPassword")) {
      const user = [...users.values()].find((u) => u.email === body.email);
      if (!user || user.password !== body.password)
        return fallo("INVALID_ARGUMENT", "INVALID_LOGIN_CREDENTIALS", 400);
      if (user.disabled) return fallo("INVALID_ARGUMENT", "USER_DISABLED", 400);
      return Response.json({
        localId: user.localId,
        idToken: await jwt(user.localId),
      });
    }
    assert.equal(options.headers.Authorization, "Bearer oauth-simulado");
    if (url.pathname.endsWith("accounts:lookup"))
      return Response.json({
        users: [...users.values()].filter(
          (u) =>
            body.email?.includes(u.email) || body.localId?.includes(u.localId),
        ),
      });
    if (url.pathname.endsWith("accounts:update")) {
      const user = users.get(body.localId);
      Object.assign(
        user,
        body,
        ...(body.disableUser === undefined
          ? []
          : [{ disabled: body.disableUser }]),
      );
      return Response.json(user);
    }
    if (url.pathname.endsWith("/accounts")) {
      const localId = "nueva";
      users.set(localId, { ...body, localId });
      return Response.json({ localId });
    }
    if (url.pathname.endsWith("documents:commit")) {
      if (
        conflicto &&
        body.writes.some(
          (w) =>
            w.update.name.endsWith("controlAccesos/AL-01") && w.currentDocument,
        )
      ) {
        conflicto = false;
        return fallo("FAILED_PRECONDITION", "Conflicto", 412);
      }
      for (const write of body.writes) {
        const path = write.update.name.split("/documents/")[1],
          actual = documentos.get(path),
          pre = write.currentDocument;
        if (
          pre &&
          ((pre.exists === false && actual) ||
            (pre.updateTime && pre.updateTime !== actual?.version))
        )
          return fallo("FAILED_PRECONDITION", "Conflicto", 412);
      }
      for (const write of body.writes) {
        const path = write.update.name.split("/documents/")[1];
        const value = Object.fromEntries(
          Object.entries(write.update.fields).map(([k, v]) => [
            k,
            decodificar(v),
          ]),
        );
        guardar(
          path,
          write.updateMask
            ? { ...documentos.get(path)?.value, ...value }
            : value,
        );
      }
      return Response.json({ writeResults: [] });
    }
    const path = decodeURIComponent(url.pathname.split("/documents/")[1]);
    const doc = documentos.get(path);
    if (!doc) return fallo("NOT_FOUND", "No existe", 404);
    return Response.json({
      fields: Object.fromEntries(
        Object.entries(doc.value).map(([k, v]) => [k, codificar(v)]),
      ),
      updateTime: doc.version,
    });
  };
  const worker = crearServidor((vars) =>
    crearGoogle(vars, { fetchImpl: fetchGoogle, ahora: () => ahora }),
  );
  const fetchCliente = (url, options) =>
    worker.fetch(
      new Request(url, {
        ...options,
        headers: { ...options.headers, Origin: origin },
      }),
      env,
    );
  return { env, worker, fetchCliente, documentos, users };
}

test("el cliente, Worker y adaptador REST bloquean al cuarto fallo y María puede desbloquear", async () => {
  const e = entorno();
  const llamar = (name, data, token) =>
    consultarServidorAcceso(
      "https://acceso.example/",
      name,
      data,
      token,
      e.fetchCliente,
    );
  for (let i = 0; i < 4; i++) {
    await assert.rejects(
      llamar("autenticarCuenta", { id: "AL-01", contrasena: "incorrecta" }),
      (error) =>
        i === 3
          ? mensajeFirebase(error).code === "acceso/bloqueado"
          : error.message === "ID o contraseña incorrectos.",
    );
  }
  assert.equal(e.documentos.get("controlAccesos/AL-01").value.intentos, 4);
  assert.equal(e.documentos.get("usuarios/worker").value.activo, false);
  assert.equal(e.documentos.get("usuarios/worker2").value.activo, true);
  await assert.rejects(
    llamar("autenticarCuenta", { id: "AL-01", contrasena: "Prueba6" }),
    (error) => error.details.bloqueado,
  );
  await assert.rejects(
    llamar("gestionarAcceso", { idEmpleado: "AL-01", accion: "enable" }),
    /Inicia sesión/,
  );
  await assert.rejects(
    llamar(
      "gestionarAcceso",
      { idEmpleado: "AL-01", accion: "enable" },
      await jwt("worker2"),
    ),
    /Solo María/,
  );
  await llamar(
    "gestionarAcceso",
    { idEmpleado: "AL-01", accion: "enable" },
    await jwt("maria"),
  );
  const result = await llamar("autenticarCuenta", {
    id: "AL-01",
    contrasena: "Prueba6",
  });
  const [header, payload, signature] = result.data.token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.equal(claims.uid, "worker");
  assert.equal(claims.claims.accesoControlado, true);
  assert.ok(
    await crypto.subtle.verify(
      alg,
      keys.publicKey,
      Buffer.from(signature, "base64url"),
      Buffer.from(`${header}.${payload}`),
    ),
  );
  assert.equal(e.documentos.get("controlAccesos/AL-01").value.intentos, 0);
});
test("un QR no autorizado alerta solo con la identidad firmada y no bloquea la cuenta", async () => {
  const e = entorno(),
    token = await jwt("worker");
  const llamar = (datos, bearer = token) =>
    consultarServidorAcceso(
      "https://acceso.example/",
      "registrarAccesoDenegado",
      datos,
      bearer,
      e.fetchCliente,
    );
  await llamar({ modulo: "ALLAN-1", idEmpleado: "MARIA" });
  await llamar({ modulo: "ALLAN-1" });
  const alerts = [...e.documentos.entries()].filter(([p]) =>
    p.startsWith("alertasSeguridad/"),
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][1].value.id_empleado, "AL-01");
  assert.equal(e.documentos.get("usuarios/worker").value.activo, true);
  await assert.rejects(
    llamar(
      { modulo: "administracion" },
      await jwt("worker", { aud: "otro-proyecto" }),
    ),
    /Inicia sesión/,
  );
  await assert.rejects(
    llamar({ modulo: "administracion" }, `${token.slice(0, -5)}xxxxx`),
    /Inicia sesión/,
  );
});
test("María restablece una contraseña y solo se guarda en Authentication", async () => {
  const e = entorno();
  await consultarServidorAcceso(
    "https://acceso.example/",
    "gestionarAcceso",
    { idEmpleado: "AL-01", accion: "reset", contrasena: "Nueva06" },
    await jwt("maria"),
    e.fetchCliente,
  );
  assert.equal(e.users.get("worker").password, "Nueva06");
  assert.ok(!JSON.stringify([...e.documentos]).includes("Nueva06"));
  assert.equal(e.documentos.get("usuarios/worker").value.activo, true);
});
test("el Worker rechaza orígenes ajenos, datos enormes y secretos ausentes", async () => {
  const e = entorno();
  assert.equal(
    (
      await e.worker.fetch(
        new Request("https://acceso.example/autenticarCuenta", {
          method: "POST",
          headers: { Origin: "https://ajeno.example" },
        }),
        e.env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await e.worker.fetch(
        new Request("https://acceso.example/autenticarCuenta", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify({ id: "AL-01", contrasena: "x".repeat(9000) }),
        }),
        e.env,
      )
    ).status,
    400,
  );
  const sinClave = { ...e.env, FIREBASE_SERVICE_ACCOUNT: "" };
  const response = await e.worker.fetch(
    new Request("https://acceso.example/autenticarCuenta", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "AL-01", contrasena: "Prueba6" }),
    }),
    sinClave,
  );
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("PRIVATE KEY"));
  await assert.rejects(
    consultarServidorAcceso(
      "http://inseguro.example/",
      "autenticarCuenta",
      {},
      null,
      e.fetchCliente,
    ),
    /dirección/,
  );
});
test("el adaptador conserva listas, valores nulos y números al escribir Firestore", () => {
  const value = {
    null: null,
    boolean: true,
    int: 4,
    double: -19.5,
    text: "Comunícate",
    array: ["a", { b: 2 }],
  };
  assert.deepEqual(decodificar(codificar(value)), value);
});
