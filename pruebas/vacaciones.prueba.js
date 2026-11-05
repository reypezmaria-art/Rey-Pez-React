import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularSalida,
  derechoVacaciones,
  diasPorAntiguedad,
  festivosMexico,
  guardarVacaciones,
  guardarDiasUsados,
  saldoVacaciones,
  cancelarVacaciones,
  vacacionesDelMes,
} from "../codigo/dominio/vacaciones.js";
const empleado = {
  id_empleado: "E-01",
  nombre_completo: "Persona ficticia",
  empresa_codigo: "ALLAN",
  fecha_ingreso: "2018-10-04",
  estatus: "Activo",
};
const base = () => ({ employees: [{ ...empleado }], holidays: [], audit: [] });
const form = () => ({
  empleadoId: "E-01",
  anio: 2026,
  inicio: "2026-10-30",
  dias: 21,
  previos: 0,
  motivo: "Acuerdo de prueba",
  confirmado: true,
});
const ahora = new Date("2026-11-05T18:00:00Z");
test("tabla anual LFT, aniversarios completos y fecha imposible", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21].map(diasPorAntiguedad),
    [0, 12, 14, 16, 18, 20, 22, 22, 24, 24, 26, 26, 28],
  );
  assert.equal(derechoVacaciones(empleado, "2026-10-03").anios, 7);
  assert.equal(derechoVacaciones(empleado, "2026-10-04").anios, 8);
  assert.equal(
    derechoVacaciones(
      { ...empleado, fecha_ingreso: "2026-02-30" },
      "2026-11-05",
    ),
    null,
  );
  assert.equal(
    derechoVacaciones(
      { ...empleado, fecha_ingreso: "2026-10-01" },
      "2026-11-05",
    ).dias,
    0,
  );
  assert.equal(
    derechoVacaciones(
      { ...empleado, fecha_ingreso: "2020-08-31" },
      "2026-09-01",
    ).limite,
    "2027-02-28",
  );
  assert.equal(
    derechoVacaciones(
      { ...empleado, fecha_ingreso: "2020-02-29" },
      "2026-02-28",
    ).anios,
    6,
  );
});
test("salida octubre, regreso noviembre: sábados cuentan y festivo 16 no consume días", () => {
  const v = calcularSalida("2026-10-30", 21);
  assert.equal(v.fin, "2026-11-24");
  assert.equal(v.regreso, "2026-11-25");
  assert.ok(v.descansos.some((d) => d.fecha === "2026-11-16"));
  assert.equal(calcularSalida("2026-10-31", 1).regreso, "2026-11-02");
  assert.equal(calcularSalida("2026-11-14", 1).regreso, "2026-11-17");
  assert.equal(
    calcularSalida("2026-11-14", 1, ["2026-11-17"]).regreso,
    "2026-11-18",
  );
  assert.throws(() => calcularSalida("2026-11-16", 1));
  assert.throws(() => calcularSalida("2026-11-02", 1.5));
  assert.equal(festivosMexico(2026)["2026-11-02"], undefined);
  assert.ok(festivosMexico(2030)["2030-10-01"]);
  assert.equal(calcularSalida("2026-12-31", 2).fin, "2027-01-02");
});
test("guarda sin alterar originales, muestra ambos meses, evita duplicados y conserva cancelación auditada", () => {
  const inicial = base(),
    s = guardarVacaciones(inicial, form(), "MARIA", ahora);
  assert.equal(inicial.employees[0].vacaciones, undefined);
  assert.equal(vacacionesDelMes(s.employees, "2026-10").length, 1);
  assert.equal(vacacionesDelMes(s.employees, "2026-11", "ALLAN").length, 1);
  assert.equal(vacacionesDelMes(s.employees, "2026-11", "EDGAR").length, 0);
  assert.throws(() => guardarVacaciones(s, form(), "MARIA", ahora), /cruza/);
  const v = s.employees[0].vacaciones.registros[0];
  const editado = guardarVacaciones(
    s,
    { ...form(), id: v.id, dias: 22 },
    "MARIA",
    ahora,
  );
  assert.equal(editado.audit[0].anterior.dias, 21);
  assert.equal(editado.audit[0].siguiente.dias, 22);
  const c = cancelarVacaciones(
    editado,
    "E-01",
    v.id,
    "Cambio acordado",
    "MARIA",
    ahora,
  );
  assert.equal(c.employees[0].vacaciones.registros[0].estado, "Cancelada");
  assert.equal(vacacionesDelMes(c.employees, "2026-11").length, 0);
  assert.equal(c.audit.length, 3);
});
test("no inventa saldo previo, valida antigüedad y resta días de registros y períodos previos", () => {
  assert.throws(
    () => guardarVacaciones(base(), { ...form(), previos: "" }, "MARIA", ahora),
    /ya utilizados/,
  );
  assert.throws(
    () =>
      guardarVacaciones(
        base(),
        { ...form(), confirmado: false },
        "MARIA",
        ahora,
      ),
    /Confirma/,
  );
  assert.throws(
    () => guardarVacaciones(base(), { ...form(), dias: 23 }, "MARIA", ahora),
    /supera/,
  );
  assert.throws(() =>
    guardarVacaciones(base(), { ...form(), anio: 2027 }, "MARIA", ahora),
  );
  const s = guardarVacaciones(
    base(),
    { ...form(), dias: 10, previos: 2 },
    "MARIA",
    ahora,
  );
  assert.throws(
    () =>
      guardarVacaciones(
        s,
        { ...form(), inicio: "2026-12-01", dias: 11, previos: 2 },
        "MARIA",
        ahora,
      ),
    /supera/,
  );
  const n = guardarVacaciones(
    s,
    { ...form(), inicio: "2026-12-01", dias: 10, previos: 2 },
    "MARIA",
    ahora,
  );
  assert.equal(n.employees[0].vacaciones.registros.length, 2);
});

test("vacaciones programadas retiran la ausencia pendiente y cancelarlas la restablece", async () => {
  const { pendingAbsences } = await import("../codigo/dominio/asistencia.js");
  const s = guardarVacaciones(
    {
      ...base(),
      attendance: [],
      schedules: [
        {
          codigo: "ALL-GEN",
          empresa_codigo: "ALLAN",
          hora_inicio: "08:00",
          tolerancia_minutos: 10,
        },
      ],
    },
    form(),
    "MARIA",
    ahora,
  );
  const dia = new Date(2026, 10, 5, 12);
  assert.equal(pendingAbsences(s, dia).length, 0);
  const id = s.employees[0].vacaciones.registros[0].id;
  const c = cancelarVacaciones(s, "E-01", id, "Se posponen", "MARIA", ahora);
  assert.equal(pendingAbsences(c, dia).length, 1);
});

test("saldo automático: doce días, diez usados y dos disponibles sin inventar otra salida", () => {
  const s = base();
  s.employees[0].fecha_ingreso = "2025-01-27";
  assert.equal(saldoVacaciones(s.employees[0], 2026).disponibles, null);
  const entrada = { ...form(), previos: 10, inicio: "", dias: "", motivo: "" };
  const actualizado = guardarDiasUsados(s, entrada, "MARIA", ahora);
  assert.equal(actualizado.employees[0].vacaciones.registros, undefined);
  assert.equal(saldoVacaciones(actualizado.employees[0], 2026).dias, 12);
  assert.equal(saldoVacaciones(actualizado.employees[0], 2026).anios, 1);
  assert.equal(saldoVacaciones(actualizado.employees[0], 2026).disponibles, 2);
  assert.equal(s.employees[0].vacaciones, undefined);
  const salida = guardarVacaciones(
    actualizado,
    { ...entrada, inicio: "2026-11-06" },
    "MARIA",
    ahora,
  );
  assert.equal(salida.employees[0].vacaciones.registros[0].dias, 2);
  assert.equal(saldoVacaciones(salida.employees[0], 2026).disponibles, 0);
  assert.equal(
    saldoVacaciones(salida.employees[0], 2026, {
      excluirId: salida.employees[0].vacaciones.registros[0].id,
    }).disponibles,
    2,
  );
  assert.ok(salida.audit[0].motivo.includes("2 días"));
  assert.throws(
    () =>
      guardarDiasUsados(salida, { ...entrada, previos: 11 }, "MARIA", ahora),
    /superan/,
  );
  const completo = guardarDiasUsados(
    actualizado,
    { ...entrada, previos: 12 },
    "MARIA",
    ahora,
  );
  assert.equal(saldoVacaciones(completo.employees[0], 2026).disponibles, 0);
  assert.equal(completo.employees[0].vacaciones.registros, undefined);
  assert.equal(completo.audit[0].anterior.usadosPrevios, 10);
  for (const previos of ["", null, -1, 1.5, 13])
    assert.throws(() =>
      guardarDiasUsados(s, { ...entrada, previos }, "MARIA", ahora),
    );
  assert.throws(() =>
    guardarDiasUsados(s, { ...entrada, confirmado: false }, "MARIA", ahora),
  );
});
