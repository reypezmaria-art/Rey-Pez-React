import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getBytes, ref, uploadString } from "firebase/storage";
import {
  diaGuatemala,
  fechaLocalGuatemala,
} from "../../codigo/repositorios/estadoFirebase.js";

const jpeg =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=";

function marca(id, empleado, empresa, movimiento, ms = Date.now()) {
  return {
    id_registro: id,
    id_empleado: empleado,
    empresa_codigo: empresa,
    movimiento,
    fecha_hora: new Date(ms).toISOString(),
    fecha_ms: ms,
    fecha_local: fechaLocalGuatemala(ms),
    fecha_dia: diaGuatemala(ms),
  };
}
function cursorDe(datos) {
  return {
    ultimo: datos.movimiento,
    fecha: datos.fecha_local,
    fecha_dia: datos.fecha_dia,
    registroId: datos.id_registro,
    idEmpleado: datos.id_empleado,
  };
}
async function marcar(db, datos) {
  const lote = writeBatch(db);
  lote.set(doc(db, "asistencia", datos.id_registro), datos);
  lote.set(doc(db, "secuenciaAsistencia", datos.id_empleado), cursorDe(datos));
  await lote.commit();
}

test("las reglas separan a María, la empresa y la secuencia", async () => {
  const entorno = await initializeTestEnvironment({
    projectId: "demo-rey-pez",
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8") },
    storage: { rules: readFileSync("firebase/storage.rules", "utf8") },
  });
  try {
    const anonimo = entorno.unauthenticatedContext();
    const intruso = entorno.authenticatedContext("intruso", {
      email: "otro@acceso.reypez.app",
    });
    const maria = entorno.authenticatedContext("maria", {
      email: "maria@acceso.reypez.app",
    });
    await assertSucceeds(getDoc(doc(anonimo.firestore(), "acceso", "admin")));
    await assertFails(
      setDoc(doc(intruso.firestore(), "acceso", "admin"), { uid: "intruso" }),
    );
    await assertSucceeds(
      setDoc(doc(maria.firestore(), "acceso", "admin"), { uid: "maria" }),
    );
    await assertFails(
      setDoc(doc(maria.firestore(), "acceso", "admin"), { uid: "maria" }),
    );
    await assertFails(getDocs(collection(anonimo.firestore(), "empleados")));

    await entorno.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, "usuarios", "worker"), {
        rol: "trabajador",
        idEmpleado: "ES-01",
        activo: true,
      });
      await setDoc(doc(db, "usuarios", "terminal"), {
        rol: "terminal",
        activo: true,
        deviceId: "quiosco",
      });
      await setDoc(doc(db, "empleados", "ES-01"), {
        id_empleado: "ES-01",
        empresa_codigo: "ESTUARDO",
        estatus: "Activo",
        nombre_completo: "Brenda",
      });
      await setDoc(doc(db, "empleados", "AL-01"), {
        id_empleado: "AL-01",
        empresa_codigo: "ALLAN",
        estatus: "Activo",
        nombre_completo: "Ana",
      });
      await setDoc(doc(db, "empleados", "ED-02"), {
        id_empleado: "ED-02",
        empresa_codigo: "EDGAR",
        estatus: "Activo",
        nombre_completo: "Eva",
      });
      await setDoc(doc(db, "operacion", "config"), {
        permissions: { "ES-01": { company: "ESTUARDO", logs: ["epp"] } },
      });
      await setDoc(doc(db, "bitacoras", "suya"), {
        company: "ESTUARDO",
        type: "epp",
        createdBy: "ES-01",
      });
      await setDoc(doc(db, "bitacoras", "ajena"), {
        company: "ALLAN",
        type: "epp",
        createdBy: "AL-01",
      });
      const storage = contexto.storage();
      await uploadString(
        ref(storage, "evidencias/bitacoras/ESTUARDO/epp/suya/foto.jpg"),
        jpeg,
        "data_url",
      );
      await uploadString(
        ref(storage, "evidencias/bitacoras/ALLAN/epp/ajena/foto.jpg"),
        jpeg,
        "data_url",
      );
      await uploadString(
        ref(storage, "evidencias/bitacoras/suya/foto.jpg"),
        jpeg,
        "data_url",
      );
    });

    const trabajadora = entorno.authenticatedContext("worker", {
      email: "es-01@acceso.reypez.app",
    });
    const terminal = entorno.authenticatedContext("terminal");
    const dbTrabajo = trabajadora.firestore();
    const dbTerminal = terminal.firestore();
    await assertSucceeds(getDoc(doc(dbTrabajo, "bitacoras", "suya")));
    await assertFails(getDoc(doc(dbTrabajo, "bitacoras", "ajena")));
    await assertFails(getDocs(collection(dbTrabajo, "bitacoras")));
    await assertSucceeds(
      getDocs(
        query(
          collection(dbTrabajo, "bitacoras"),
          where("company", "==", "ESTUARDO"),
          where("type", "in", ["epp"]),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(dbTrabajo, "empleados"),
          where("empresa_codigo", "==", "ALLAN"),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(dbTrabajo, "empleados"),
          where("empresa_codigo", "==", "ESTUARDO"),
        ),
      ),
    );
    await assertFails(getDocs(collection(dbTerminal, "bitacoras")));
    await assertFails(getDocs(collection(dbTrabajo, "usuarios")));
    await assertSucceeds(getDocs(collection(dbTerminal, "empleados")));
    await assertSucceeds(
      setDoc(doc(dbTrabajo, "bitacoras", "nueva"), {
        company: "ESTUARDO",
        type: "epp",
        createdBy: "ES-01",
      }),
    );
    await assertFails(
      setDoc(doc(dbTrabajo, "bitacoras", "otra"), {
        company: "ALLAN",
        type: "epp",
        createdBy: "ES-01",
      }),
    );
    await assertSucceeds(
      setDoc(doc(dbTrabajo, "auditoria", "nueva"), {
        id: "nueva",
        action: "Bitácora registrada",
        by: "ES-01",
        when: new Date().toISOString(),
      }),
    );
    await assertFails(getDoc(doc(dbTrabajo, "auditoria", "nueva")));

    const entrada = marca("r1", "AL-01", "ALLAN", "ENTRADA");
    await assertFails(
      marcar(dbTerminal, marca("malo", "AL-01", "ALLAN", "SALIDA_FINAL")),
    );
    await assertSucceeds(marcar(dbTerminal, entrada));
    await assertSucceeds(
      marcar(dbTerminal, marca("r2", "AL-01", "ALLAN", "SALIDA_A_COMER")),
    );
    await assertFails(
      marcar(dbTerminal, marca("r3", "AL-01", "ALLAN", "SALIDA_FINAL")),
    );
    await assertSucceeds(
      marcar(dbTerminal, marca("e1", "ED-02", "EDGAR", "ENTRADA")),
    );
    await assertSucceeds(
      marcar(dbTerminal, marca("e2", "ED-02", "EDGAR", "SALIDA_FINAL")),
    );
    await assertFails(
      marcar(
        dbTerminal,
        marca(
          "vieja",
          "ES-01",
          "ESTUARDO",
          "ENTRADA",
          Date.now() - 21 * 60 * 60 * 1000,
        ),
      ),
    );
    await assertFails(
      marcar(dbTrabajo, marca("ajena-marca", "AL-01", "ALLAN", "ENTRADA")),
    );
    await assertSucceeds(
      marcar(dbTrabajo, marca("propia", "ES-01", "ESTUARDO", "ENTRADA")),
    );
    await assertSucceeds(
      setDoc(doc(maria.firestore(), "asistencia", "revision"), {
        id_registro: "revision",
        id_empleado: "AL-01",
        empresa_codigo: "ALLAN",
        movimiento: "REVISION_ADMINISTRATIVA",
        fecha_hora: "2020-01-01T12:00:00.000Z",
      }),
    );

    const fotoPropia = ref(
      trabajadora.storage(),
      "evidencias/bitacoras/ESTUARDO/epp/suya/foto.jpg",
    );
    const fotoAjena = ref(
      trabajadora.storage(),
      "evidencias/bitacoras/ALLAN/epp/ajena/foto.jpg",
    );
    const fotoTerminal = ref(
      terminal.storage(),
      "evidencias/bitacoras/ESTUARDO/epp/suya/foto.jpg",
    );
    await assertSucceeds(getBytes(fotoPropia));
    await assertFails(getBytes(fotoAjena));
    await assertFails(getBytes(fotoTerminal));
    await assertFails(
      uploadString(
        ref(trabajadora.storage(), "evidencias/bitacoras/suya/foto.jpg"),
        jpeg,
        "data_url",
      ),
    );
    await assertSucceeds(
      uploadString(
        ref(
          trabajadora.storage(),
          "evidencias/bitacoras/ESTUARDO/epp/nueva/otra.jpg",
        ),
        jpeg,
        "data_url",
      ),
    );
    await assertFails(
      uploadString(
        ref(
          trabajadora.storage(),
          "evidencias/bitacoras/ALLAN/epp/nueva/otra.jpg",
        ),
        jpeg,
        "data_url",
      ),
    );
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), "alertasSeguridad", "intento"), {
        tipo: "Acceso denegado",
        estado: "Pendiente",
      });
      await setDoc(doc(contexto.firestore(), "controlAccesos", "ES-01"), {
        bloqueado: true,
        intentos: 4,
      });
    });
    await assertSucceeds(
      getDoc(doc(maria.firestore(), "alertasSeguridad", "intento")),
    );
    await assertFails(getDoc(doc(dbTerminal, "alertasSeguridad", "intento")));
    await assertFails(getDoc(doc(dbTrabajo, "alertasSeguridad", "intento")));
    await assertFails(
      setDoc(doc(dbTrabajo, "controlAccesos", "ES-01"), {
        bloqueado: false,
        intentos: 0,
      }),
    );
    await assertFails(
      setDoc(doc(maria.firestore(), "controlAccesos", "ES-01"), {
        bloqueado: false,
        intentos: 0,
      }),
    );
    await assertFails(
      setDoc(doc(dbTrabajo, "alertasSeguridad", "falsa"), { tipo: "Falsa" }),
    );
    await assertFails(getDoc(doc(dbTrabajo, "bitacoras", "suya")));
    await assertFails(getBytes(fotoPropia));
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), "controlAccesos", "MARIA"), {
        bloqueado: true,
        intentos: 4,
      });
    });
    await assertFails(getDoc(doc(maria.firestore(), "bitacoras", "suya")));
    assert.equal(entorno.projectId, "demo-rey-pez");
  } finally {
    await entorno.cleanup();
  }
});
