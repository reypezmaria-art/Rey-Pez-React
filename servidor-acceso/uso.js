import { fallo } from "./google.js";
const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const diaUso = (ms) => formatoDia.format(new Date(ms));
const modulos = new Set([
  "dashboard",
  "employees",
  "payroll",
  "attendance",
  "logs",
  "epp",
  "labor",
  "maintenance",
  "reports",
  "settings",
  "security",
  "administration",
  "capture",
  "kiosk",
]);
export function validarPulso(d) {
  if (
    Object.keys(d).some(
      (k) =>
        ![
          "sesion",
          "secuencia",
          "visibleMs",
          "activoMs",
          "visible",
          "activo",
          "modulo",
          "cierre",
        ].includes(k),
    ) ||
    typeof d.sesion !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      d.sesion,
    ) ||
    !Number.isSafeInteger(d.secuencia) ||
    d.secuencia < 0 ||
    ![d.visibleMs, d.activoMs].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 31536000000,
    ) ||
    d.activoMs > d.visibleMs ||
    typeof d.visible !== "boolean" ||
    typeof d.activo !== "boolean" ||
    typeof d.cierre !== "boolean" ||
    (d.activo && !d.visible) ||
    !modulos.has(d.modulo)
  )
    throw fallo("invalid-argument", "Registro de uso no válido.");
}
export async function identidadUso(request, { auth, db }, modulo) {
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw fallo("unauthenticated", "Inicia sesión.");
  const { uid } = await auth.verifyIdToken(token);
  const admin = await db.doc("acceso/admin").get();
  if (admin.get("uid") === uid) return null;
  const usuario = await db.doc(`usuarios/${uid}`).get();
  const id = usuario.get("idEmpleado");
  if (
    usuario.get("rol") !== "trabajador" ||
    usuario.get("activo") !== true ||
    !/^[A-Z0-9._-]{1,128}$/.test(id || "")
  )
    throw fallo("permission-denied", "Cuenta no activa.");
  const [empleado, bloqueo, config] = await Promise.all([
    db.doc(`empleados/${id}`).get(),
    db.doc(`controlAccesos/${id}`).get(),
    db.doc("operacion/config").get(),
  ]);
  const p = config.data()?.permissions?.[id];
  const empresa = empleado.get("empresa_codigo");
  const permitido =
    modulo === "payroll"
      ? p?.nomina === true || p?.consultaNominaTodas === true
      : p?.company === empresa &&
        (modulo === "capture"
          ? p?.logs?.length > 0
          : ["employees", "maintenance", "reports"].includes(modulo) &&
            p?.secciones?.includes(modulo));
  if (
    !empleado.exists ||
    typeof empresa !== "string" ||
    !empresa ||
    empleado.get("estatus") === "Baja" ||
    bloqueo.get("bloqueado") ||
    !permitido
  )
    throw fallo("permission-denied", "Apartado no autorizado.");
  return {
    uid,
    cuenta: id,
    nombre: empleado.get("nombre_completo") || id,
    empresa,
  };
}
export function tramosUso(inicio, fin) {
  if (inicio >= fin) return [];
  if (diaUso(inicio) === diaUso(fin - 1))
    return [{ fecha: diaUso(inicio), inicio, fin }];
  let bajo = inicio,
    alto = fin;
  while (alto - bajo > 1) {
    const medio = Math.floor((bajo + alto) / 2);
    if (diaUso(medio) === diaUso(inicio)) bajo = medio;
    else alto = medio;
  }
  return [
    { fecha: diaUso(inicio), inicio, fin: alto },
    { fecha: diaUso(alto), inicio: alto, fin },
  ];
}
export async function registrarUso(
  datos,
  request,
  servicios,
  ahora = Date.now(),
) {
  validarPulso(datos);
  const identidad = await identidadUso(request, servicios, datos.modulo);
  if (!identidad) return { ok: true, excluida: true };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identidad.uid),
  );
  const clave = [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const { db } = servicios;
  const ref = db.doc(`usoSesiones/${clave}_${datos.sesion}`);
  return db.runTransaction(async (tx) => {
    const anterior = (await tx.get(ref)).data();
    if (anterior && (anterior.finMs || datos.secuencia <= anterior.secuencia))
      return { ok: true };
    if (
      !anterior &&
      (datos.secuencia !== 0 || datos.visibleMs || datos.activoMs)
    )
      throw fallo("invalid-argument", "Inicia un nuevo registro de sesión.");
    if (
      anterior &&
      (datos.visibleMs < anterior.clienteVisibleMs ||
        datos.activoMs < anterior.clienteActivoMs)
    )
      throw fallo("invalid-argument", "Contadores no válidos.");
    const duracion = anterior
      ? Math.max(0, Math.min(120000, ahora - anterior.ultimoMs))
      : 0;
    const visible = Math.min(
      duracion,
      datos.visibleMs - (anterior?.clienteVisibleMs || 0),
    );
    const activo = Math.min(
      visible,
      datos.activoMs - (anterior?.clienteActivoMs || 0),
    );
    const fechas = new Set([
      diaUso(ahora),
      ...tramosUso(ahora - visible, ahora).map((t) => t.fecha),
    ]);
    const dias = [];
    for (const fecha of fechas) {
      const diario = db.doc(`usoDiario/${clave}_${fecha}`);
      dias.push({ fecha, ref: diario, dato: (await tx.get(diario)).data() });
    }
    for (const dia of dias) {
      const sumar = (ms, ultimo) =>
        tramosUso(ahora - ms, ahora)
          .filter((t) => t.fecha === dia.fecha)
          .reduce(
            (s, t) => s + Math.max(0, t.fin - Math.max(t.inicio, ultimo || 0)),
            0,
          );
      const v = sumar(visible, dia.dato?.visibleFinMs),
        a = Math.min(
          sumar(activo, dia.dato?.activoFinMs),
          (dia.dato?.visibleMs || 0) + v - (dia.dato?.activoMs || 0),
        );
      tx.set(dia.ref, {
        ...identidad,
        fecha: dia.fecha,
        primeroMs: dia.dato?.primeroMs || ahora,
        ultimoMs: Math.max(ahora, dia.dato?.ultimoMs || 0),
        visibleMs: (dia.dato?.visibleMs || 0) + v,
        activoMs: (dia.dato?.activoMs || 0) + a,
        visibleFinMs: v ? ahora : dia.dato?.visibleFinMs || 0,
        activoFinMs: a ? ahora : dia.dato?.activoFinMs || 0,
        sesiones:
          (dia.dato?.sesiones || 0) +
          (!anterior && dia.fecha === diaUso(ahora) ? 1 : 0),
        modulo: datos.modulo,
        visible: datos.visible && !datos.cierre,
        activo: datos.activo && !datos.cierre,
      });
    }
    tx.set(ref, {
      ...identidad,
      fecha: anterior?.fecha || diaUso(ahora),
      inicioMs: anterior?.inicioMs || ahora,
      ultimoMs: ahora,
      finMs: datos.cierre ? ahora : null,
      visibleMs: (anterior?.visibleMs || 0) + visible,
      activoMs: (anterior?.activoMs || 0) + activo,
      clienteVisibleMs: datos.visibleMs,
      clienteActivoMs: datos.activoMs,
      secuencia: datos.secuencia,
      modulo: datos.modulo,
      visible: datos.visible && !datos.cierre,
      activo: datos.activo && !datos.cierre,
    });
    return { ok: true };
  });
}
export function validarConsultaUso(d) {
  const fechaValida = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    !["diaria", "sesiones"].includes(d.vista) ||
    !fechaValida(d.desde) ||
    !fechaValida(d.hasta) ||
    d.hasta < d.desde ||
    Date.parse(d.hasta) - Date.parse(d.desde) > 366 * 86400000 ||
    (d.cursor &&
      (!fechaValida(d.cursor.fecha) ||
        !/^[a-f0-9]{64}_[a-f0-9-]{10,36}$/.test(d.cursor.id || "") ||
        d.cursor.fecha < d.desde ||
        d.cursor.fecha > d.hasta))
  )
    throw fallo("invalid-argument", "Elige fechas válidas de hasta un año.");
}
