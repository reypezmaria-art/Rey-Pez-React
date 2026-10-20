import test from "node:test";
import assert from "node:assert/strict";
import { baseOperation } from "../codigo/datos/operacionInicial.js";
import { guardarEmpresa } from "../codigo/dominio/empresas.js";
import {
  armarEstado,
  diferencias,
  configuracionDe,
} from "../codigo/repositorios/estadoFirebase.js";
import {
  rangoPeriodo,
  contarIncidencias,
  filtrarIncidencias,
  personalDeHoy,
} from "../codigo/dominio/panel.js";
const ahora = new Date("2026-10-20T16:00:00Z");
const base = () => ({
  ...structuredClone(baseOperation),
  employees: [
    {
      id_empleado: "AL-01",
      empresa_codigo: "ALLAN",
      nombre_completo: "PERSONA DE PRUEBA",
      estatus: "Activo",
    },
  ],
  attendance: [],
  alerts: [],
  schedules: [],
});
const form = {
  codigo: "ALLAN",
  razonSocial: "Empresa de prueba",
  rfc: "",
  regimenFiscal: "",
  giro: "",
  estatus: "Activa",
  activaDesde: "2020-03-15",
};
test("editar datos fiscales conserva empleados e historial y no comparte RFC en configuración operativa", () => {
  const state = base();
  const next = guardarEmpresa(
    state,
    {
      ...form,
      rfc: "AAA010101AAA",
      regimenFiscal: "Régimen de prueba",
      giro: "Giro de prueba",
    },
    ahora,
  );
  assert.equal(next.companies[0].rfc, "AAA010101AAA");
  assert.equal(next.companies[0].activaDesde, "2020-03-15");
  assert.strictEqual(next.employees, state.employees);
  assert.equal(state.companies.length, 0);
  assert.equal(next.audit[0].by, "MARIA");
  assert.equal(next.audit[0].siguiente.rfc, "AAA010101AAA");
  const config = configuracionDe(next);
  assert.equal(config.companyDirectory.ALLAN.nombre, "Empresa de prueba");
  assert.ok(!JSON.stringify(config).includes("AAA010101AAA"));
  const ops = diferencias(state, next);
  assert.equal(
    ops.find((o) => o.coleccion === "empresas").datos.rfc,
    "AAA010101AAA",
  );
  assert.ok(
    !ops.some((o) => o.coleccion === "empleados" || o.tipo === "delete"),
  );
  const loaded = armarEstado({
    listas: {
      companies: next.companies,
      employees: next.employees,
      audit: next.audit,
    },
    config,
  });
  assert.equal(loaded.companies[0].razonSocial, "Empresa de prueba");
  const baja = guardarEmpresa(
    loaded,
    { ...form, estatus: "Baja", motivo: "Baja administrativa" },
    ahora,
  );
  assert.equal(baja.employees.length, 1);
  assert.equal(baja.audit.length, 2);
  assert.equal(baja.audit[0].anterior.rfc, "AAA010101AAA");
});
test("datos de empresa rechazan empresa ajena, RFC inválido y fecha de actividad imposible o futura", () => {
  for (const cambio of [
    { codigo: "OTRA" },
    { rfc: "123" },
    { activaDesde: "2026-02-30" },
    { activaDesde: "2026-10-21" },
  ])
    assert.throws(() => guardarEmpresa(base(), { ...form, ...cambio }, ahora));
});
test("gráficas usan semanas de lunes a domingo, meses reales y fechas de México sin atribuir empresas desconocidas", () => {
  assert.deepEqual(rangoPeriodo("semana", "2026-11-01"), {
    desde: "2026-10-26",
    hasta: "2026-11-01",
  });
  assert.deepEqual(rangoPeriodo("mes", "2028-02"), {
    desde: "2028-02-01",
    hasta: "2028-02-29",
  });
  assert.equal(rangoPeriodo("mes", "2026-13"), null);
  const state = base();
  state.alerts = [
    {
      id_alerta: "uno",
      empresa_codigo: "ALLAN",
      fecha_hora: "2026-10-20T05:59:59Z",
      estado: "Revisada",
    },
    {
      id_alerta: "dos",
      empresa_codigo: "EDGAR",
      fecha_hora: "2026-10-20T06:00:00Z",
    },
  ];
  state.securityAlerts = [
    {
      id_alerta: "tres",
      fecha_hora: "2026-10-20T08:00:00Z",
      id_empleado: "AL-01",
    },
  ];
  const rango = { desde: "2026-10-20", hasta: "2026-10-20" };
  const grupos = contarIncidencias(state, rango);
  assert.equal(grupos.find((g) => g.codigo === "ALLAN").total, 0);
  assert.equal(grupos.find((g) => g.codigo === "EDGAR").total, 1);
  assert.equal(grupos.find((g) => g.codigo === "").total, 1);
  assert.equal(filtrarIncidencias(state, rango, "EDGAR").length, 1);
  assert.equal(filtrarIncidencias(state, rango, "").length, 1);
});
test("el detalle de estado usa el último movimiento aun si los registros están desordenados", () => {
  const state = base();
  state.attendance = [
    {
      id_empleado: "AL-01",
      fecha_hora: "2026-10-20T12:00:00Z",
      movimiento: "ENTRADA",
    },
    {
      id_empleado: "AL-01",
      fecha_hora: "2026-10-20T15:00:00Z",
      movimiento: "SALIDA_A_COMER",
    },
  ];
  assert.equal(personalDeHoy(state, ahora)[0].movimientoHoy, "SALIDA_A_COMER");
});

test("Activa desde no se inventa y conserva los metadatos y auditorías anteriores", () => {
  const state = base();
  state.companies = [
    { ...form, fechaVigencia: "2026-10-19", activaDesde: undefined },
  ];
  state.audit = [{ id: "anterior", motivo: "Registro previo" }];
  const next = guardarEmpresa(state, { ...form, activaDesde: "" }, ahora);
  assert.equal(next.companies[0].activaDesde, "");
  assert.equal(next.companies[0].fechaVigencia, "2026-10-19");
  assert.equal(next.audit[1].motivo, "Registro previo");
});
