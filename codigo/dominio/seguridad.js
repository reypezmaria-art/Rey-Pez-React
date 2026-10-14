const bytesToHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function passwordHash(password, salt) {
  if (!globalThis.crypto?.subtle)
    throw Error(
      "Abre la app en Chrome o desde localhost para configurar contraseñas.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return bytesToHex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode(salt),
        iterations: 210000,
      },
      key,
      256,
    ),
  );
}
export async function makeCredential(password) {
  if (password.length < 8)
    throw Error("La contraseña debe tener al menos 8 caracteres.");
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await passwordHash(password, salt), active: true };
}
export async function verifyCredential(credential, password) {
  return Boolean(
    credential?.active &&
    credential.hash === (await passwordHash(password, credential.salt)),
  );
}
export function canCapture(state, session, company, type) {
  if (session?.role === "admin") return true;
  if (session?.role !== "worker") return false;
  const e = state.employees.find(
    (e) => e.id_empleado === session.id && e.estatus !== "Baja",
  );
  const permission = state.access?.permissions?.[session.id];
  return Boolean(
    e &&
    state.access.workers[session.id]?.active &&
    permission?.company === company &&
    permission.logs?.includes(type),
  );
}
