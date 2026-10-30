import { guardarNomina } from "../../codigo/dominio/nomina.js";
import { entradaNominaEjemplo } from "../soporte/nominaEjemplo.js";
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
  deleteDoc,
  setDoc,
  serverTimestamp,
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
      await setDoc(doc(db, "usuarios", "claudia"), {
        rol: "trabajador",
        idEmpleado: "ES-02",
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
      await setDoc(doc(db, "empleados", "ES-02"), {
        id_empleado: "ES-02",
        empresa_codigo: "ESTUARDO",
        estatus: "Activo",
        nombre_completo: "Claudia",
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
        permissions: {
          "ES-01": { company: "ESTUARDO", logs: ["epp"] },
          "ES-02": { company: "ESTUARDO", logs: ["epp"], nomina: true },
        },
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
      accesoControlado: true,
    });
    const terminal = entorno.authenticatedContext("terminal");
    const dbTrabajo = trabajadora.firestore();
    const dbTerminal = terminal.firestore();
    const nomina = guardarNomina(
      { payroll: [], audit: [] },
      entradaNominaEjemplo(),
    ).payroll[0];
    const nominaRef = doc(maria.firestore(), "nominas", nomina.id);
    await assertSucceeds(setDoc(nominaRef, nomina));
    await assertSucceeds(getDocs(collection(maria.firestore(), "nominas")));
    for (const db of [
      dbTrabajo,
      dbTerminal,
      anonimo.firestore(),
      intruso.firestore(),
    ]) {
      await assertFails(getDoc(doc(db, "nominas", nomina.id)));
      await assertFails(getDocs(collection(db, "nominas")));
      await assertFails(
        setDoc(doc(db, "nominas", nomina.id), { ...nomina, revision: 2 }),
      );
    }
    for (const cambio of [
      { revision: 1 },
      { empresa_codigo: "EDGAR", revision: 2 },
      { creadoMs: nomina.creadoMs - 1000, revision: 2 },
      { extra: "campo ajeno", revision: 2 },
      { registrosJson: "x".repeat(240001), revision: 2 },
      { registrosJson: [], revision: 2 },
      { anio: "2026", revision: 2 },
      { mes: 13, revision: 2 },
      { actualizadoPor: "OTRO", revision: 2 },
      { actualizadoMs: Date.now() + 3600000, revision: 2 },
      { archivo: "x".repeat(201), revision: 2 },
      { huella: "incorrecta", revision: 2 },
    ])
      await assertFails(setDoc(nominaRef, { ...nomina, ...cambio }));
    const incompleta = { ...nomina, revision: 2 };
    delete incompleta.archivo;
    await assertFails(setDoc(nominaRef, incompleta));
    await assertSucceeds(setDoc(nominaRef, { ...nomina, revision: 2 }));
    await assertFails(setDoc(nominaRef, { ...nomina, revision: 2 }));

    await assertSucceeds(
      setDoc(doc(maria.firestore(), "empresas", "ALLAN"), {
        codigo: "ALLAN",
        rfc: "AAA010101AAA",
      }),
    );
    await assertSucceeds(getDoc(doc(maria.firestore(), "empresas", "ALLAN")));
    await assertFails(getDoc(doc(dbTrabajo, "empresas", "ALLAN")));
    await assertFails(getDoc(doc(dbTerminal, "empresas", "ALLAN")));
    await assertFails(getDoc(doc(anonimo.firestore(), "empresas", "ALLAN")));
    await assertFails(
      setDoc(doc(dbTrabajo, "empresas", "ALLAN"), { codigo: "ALLAN" }),
    );

    const claudia = entorno.authenticatedContext("claudia", {
      email: "es-02@acceso.reypez.app",
      accesoControlado: true,
    });
    const dbClaudia = claudia.firestore();
    const ahora = Date.now();
    await assertSucceeds(getDoc(doc(dbClaudia, "nominas", nomina.id)));
    await assertFails(deleteDoc(doc(dbClaudia, "nominas", nomina.id)));
    await assertFails(deleteDoc(nominaRef));
    await assertFails(
      setDoc(doc(dbClaudia, "nominas", nomina.id), {
        ...nomina,
        revision: 3,
        actualizadoPor: "MARIA",
        actualizadoMs: ahora,
        actualizadoEn: new Date(ahora).toISOString(),
      }),
    );
    await assertFails(
      setDoc(doc(dbClaudia, "nominas", nomina.id), {
        ...nomina,
        empresa_codigo: "EDGAR",
        revision: 3,
        actualizadoPor: "ES-02",
        actualizadoMs: ahora,
        actualizadoEn: new Date(ahora).toISOString(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(dbClaudia, "nominas", nomina.id), {
        ...nomina,
        revision: 3,
        actualizadoPor: "ES-02",
        actualizadoMs: ahora,
        actualizadoEn: new Date(ahora).toISOString(),
      }),
    );
    const edgar = guardarNomina(
      { payroll: [], audit: [] },
      entradaNominaEjemplo({ empresa: "EDGAR" }),
      { responsable: "ES-02" },
    );
    const docEdgar = edgar.payroll[0];
    const audEdgar = edgar.audit[0];
    await assertFails(getDoc(doc(dbTrabajo, "nominas", docEdgar.id)));
    await assertFails(
      setDoc(doc(dbTrabajo, "nominas", docEdgar.id), {
        ...docEdgar,
        revision: 2,
        actualizadoPor: "ES-01",
        actualizadoMs: Date.now(),
        actualizadoEn: new Date().toISOString(),
      }),
    );
    await assertFails(deleteDoc(doc(dbTrabajo, "nominas", nomina.id)));
    const loteEdgar = writeBatch(dbClaudia);
    loteEdgar.set(doc(dbClaudia, "nominas", docEdgar.id), docEdgar);
    loteEdgar.set(doc(dbClaudia, "auditoria", audEdgar.id), audEdgar);
    await assertSucceeds(loteEdgar.commit());
    const estuardo = guardarNomina(
      { payroll: [], audit: [] },
      entradaNominaEjemplo({ empresa: "ESTUARDO" }),
      { responsable: "ES-02" },
    ).payroll[0];
    await assertSucceeds(
      setDoc(doc(dbClaudia, "nominas", estuardo.id), estuardo),
    );
    const lista = await assertSucceeds(
      getDocs(collection(dbClaudia, "nominas")),
    );
    const empresasNomina = new Set(
      lista.docs.map((item) => item.data().empresa_codigo),
    );
    assert.ok(empresasNomina.has("ALLAN"));
    assert.ok(empresasNomina.has("EDGAR"));
    assert.ok(empresasNomina.has("ESTUARDO"));
    const correccionMs = Date.now();
    const corregida = {
      ...docEdgar,
      revision: 2,
      actualizadoPor: "ES-02",
      actualizadoMs: correccionMs,
      actualizadoEn: new Date(correccionMs).toISOString(),
    };
    const audCorreccion = {
      id: crypto.randomUUID(),
      action: "Nómina corregida",
      company: "EDGAR",
      by: "ES-02",
      when: new Date(correccionMs).toISOString(),
      periodo: docEdgar.id,
      anterior: docEdgar,
      revision: 2,
      motivo: "Ajuste autorizado",
    };
    const loteCorreccion = writeBatch(dbClaudia);
    loteCorreccion.set(doc(dbClaudia, "nominas", docEdgar.id), corregida);
    loteCorreccion.set(
      doc(dbClaudia, "auditoria", audCorreccion.id),
      audCorreccion,
    );
    await assertSucceeds(loteCorreccion.commit());
    await assertFails(getDoc(doc(dbClaudia, "auditoria", audCorreccion.id)));
    await assertFails(
      setDoc(doc(dbTrabajo, "auditoria", crypto.randomUUID()), {
        ...audCorreccion,
        by: "ES-01",
      }),
    );
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, "mantenimiento", "m1"), { id: "m1" });
      await setDoc(doc(db, "horarios", "h1"), { codigo: "h1" });
      await setDoc(doc(db, "revisiones", "r1"), { id: "r1" });
      await setDoc(doc(db, "respaldos", "2026-10-30"), { date: "2026-10-30" });
    });
    for (const [coleccion, id] of [
      ["empresas", "ALLAN"],
      ["mantenimiento", "m1"],
      ["horarios", "h1"],
      ["revisiones", "r1"],
      ["respaldos", "2026-10-30"],
      ["alertasSeguridad", "x"],
      ["controlAccesos", "ES-02"],
    ]) {
      await assertFails(getDoc(doc(dbClaudia, coleccion, id)));
      await assertFails(setDoc(doc(dbClaudia, coleccion, id), { id }));
    }
    await assertFails(getDoc(doc(dbClaudia, "empleados", "AL-01")));
    await assertFails(getDocs(collection(dbClaudia, "usuarios")));
    await assertSucceeds(getDoc(doc(dbClaudia, "empleados", "ES-02")));
    await assertSucceeds(getDoc(doc(dbClaudia, "bitacoras", "suya")));
    await assertFails(getDoc(doc(dbClaudia, "bitacoras", "ajena")));

    const sinServidor = entorno.authenticatedContext("worker", {
      email: "es-01@acceso.reypez.app",
    });
    await assertFails(
      getDoc(doc(sinServidor.firestore(), "bitacoras", "suya")),
    );
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
    // Libros de nómina: historial atómico, datos acotados y delegación solo de lectura.
    const dbAdmin = maria.firestore();
    const libroId = "ALLAN_2027_mensual";
    const camposLibro = (revision, extra = {}) => ({
      id: libroId,
      empresa: "ALLAN",
      anio: 2027,
      tipo: "mensual",
      revision,
      fecha: serverTimestamp(),
      autor: "maria",
      ...extra,
    });
    const guardarLibro = async (db, revision, extra = {}) => {
      const lote = writeBatch(db),
        datos = camposLibro(revision, extra);
      lote.set(doc(db, "librosNomina", libroId), datos);
      lote.set(
        doc(db, "librosNomina", libroId, "versiones", String(revision)),
        datos,
      );
      lote.set(
        doc(db, "librosNomina", libroId, "contenidos", String(revision)),
        { ...datos, carga: "contenido-comprimido" },
      );
      return lote.commit();
    };
    await assertFails(
      setDoc(doc(dbAdmin, "librosNomina", libroId), camposLibro(1)),
    );
    await assertSucceeds(guardarLibro(dbAdmin, 1));
    await assertFails(getDocs(collection(anonimo.firestore(), "librosNomina")));
    await assertFails(getDoc(doc(dbTrabajo, "librosNomina", libroId)));
    await assertFails(getDoc(doc(dbTerminal, "librosNomina", libroId)));
    await assertFails(guardarLibro(dbAdmin, 3));
    await assertFails(guardarLibro(dbAdmin, 2, { autor: "otro" }));
    await assertFails(guardarLibro(dbAdmin, 2, { campoAjeno: true }));
    await assertFails(guardarLibro(dbAdmin, 2, { anio: "2027" }));
    await assertFails(guardarLibro(dbAdmin, 2, { fecha: new Date(0) }));
    await assertSucceeds(guardarLibro(dbAdmin, 2));
    await assertFails(
      setDoc(doc(dbAdmin, "librosNomina", libroId, "contenidos", "2"), {
        ...camposLibro(2),
        carga: "alterado",
      }),
    );
    await assertFails(
      deleteDoc(doc(dbAdmin, "librosNomina", libroId, "versiones", "1")),
    );
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, "controlAccesos", "ES-01"), {
        bloqueado: false,
        intentos: 0,
      });
      await setDoc(doc(db, "operacion", "config"), {
        permissions: {
          "ES-01": {
            company: "ESTUARDO",
            logs: ["epp"],
            consultaNominaTodas: true,
          },
        },
      });
    });
    await assertSucceeds(getDocs(collection(dbTrabajo, "librosNomina")));
    await assertSucceeds(
      getDoc(doc(dbTrabajo, "librosNomina", libroId, "contenidos", "2")),
    );
    await assertSucceeds(getDocs(collection(dbTrabajo, "nominas")));
    await assertFails(guardarLibro(dbTrabajo, 3));
    await assertFails(
      setDoc(doc(dbTrabajo, "operacion", "config"), {
        permissions: { "ES-01": { consultaNominaTodas: true } },
      }),
    );
    await assertFails(getDocs(collection(dbTrabajo, "empresas")));
    await assertFails(getDoc(doc(dbTrabajo, "empleados", "AL-01")));
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), "operacion", "config"), {
        permissions: {
          "ES-01": {
            company: "ESTUARDO",
            logs: ["epp"],
            consultaNominaTodas: false,
          },
        },
      });
    });
    await assertFails(
      getDoc(doc(dbTrabajo, "librosNomina", libroId, "contenidos", "2")),
    );
    await entorno.withSecurityRulesDisabled(async (contexto) => {
      const db = contexto.firestore();
      await setDoc(doc(db, "operacion", "config"), {
        permissions: {
          "ES-01": {
            company: "ESTUARDO",
            logs: ["epp"],
            secciones: ["employees", "maintenance", "reports"],
            cuartosConsulta: ["EST-DEMO"],
          },
        },
      });
      await setDoc(doc(db, "mantenimiento", "propio"), {
        room: "EST-DEMO",
        description: "Actividad ficticia",
      });
      await setDoc(doc(db, "mantenimiento", "ajeno"), {
        room: "ALL-DEMO",
        description: "Actividad ajena",
      });
      await setDoc(doc(db, "asistencia", "consulta-seccion"), {
        empresa_codigo: "ESTUARDO",
        id_empleado: "ES-02",
      });
      await setDoc(doc(db, "alertas", "consulta-seccion"), {
        empresa_codigo: "ESTUARDO",
        id_empleado: "ES-02",
      });
    });
    await assertSucceeds(
      getDocs(
        query(
          collection(dbTrabajo, "mantenimiento"),
          where("room", "in", ["EST-DEMO"]),
        ),
      ),
    );
    await assertFails(getDoc(doc(dbTrabajo, "mantenimiento", "ajeno")));
    await assertFails(
      setDoc(doc(dbTrabajo, "mantenimiento", "propio"), {
        room: "EST-DEMO",
        description: "Cambio",
      }),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(dbTrabajo, "asistencia"),
          where("empresa_codigo", "==", "ESTUARDO"),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(dbTrabajo, "alertas"),
          where("empresa_codigo", "==", "ESTUARDO"),
        ),
      ),
    );
    await assertFails(getDocs(collection(dbTrabajo, "asistencia")));
    await assertFails(
      getDocs(
        query(
          collection(dbTrabajo, "asistencia"),
          where("empresa_codigo", "==", "ALLAN"),
        ),
      ),
    );
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
