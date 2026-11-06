import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularJornada2027 } from "../codigo/dominio/jornada2027.js";
import { scheduleForEmployee } from "../codigo/dominio/asistencia.js";
import { defaultSchedules } from "../codigo/datos/horariosIniciales.js";
const marcas = (entrada, salida) => [
  { movimiento: "ENTRADA", fecha_hora: `2027-01-04T${entrada}:00` },
  { movimiento: "SALIDA_A_COMER", fecha_hora: "2027-01-04T13:00:00" },
  { movimiento: "REGRESO_DE_COMER", fecha_hora: "2027-01-04T14:00:00" },
  { movimiento: "SALIDA_FINAL", fecha_hora: `2027-01-04T${salida}:00` },
];
test("la salida posterior compensa el retraso antes de calcular tiempo adicional", () => {
  assert.equal(
    calcularJornada2027(marcas("09:30", "18:30"), 480, false)
      .minutosAdicionales,
    0,
  );
  assert.equal(
    calcularJornada2027(marcas("09:30", "19:00"), 480, false)
      .minutosAdicionales,
    30,
  );
});
test("la comida cuenta o se descuenta según la configuración", () => {
  assert.equal(
    calcularJornada2027(marcas("09:00", "18:00"), 480, false)
      .minutosAdicionales,
    0,
  );
  assert.equal(
    calcularJornada2027(marcas("09:00", "18:00"), 480, true).minutosAdicionales,
    30,
  );
});
test("una jornada incompleta no produce un cálculo", () => {
  assert.equal(
    calcularJornada2027(marcas("09:00", "18:00").slice(0, 3), 480, false),
    null,
  );
});
test("llegar antes no crea tiempo adicional si se sale a la hora prevista", () => {
  const registros = [
    { movimiento: "ENTRADA", fecha_hora: "2027-01-04T14:30:00Z" },
    { movimiento: "SALIDA_A_COMER", fecha_hora: "2027-01-04T19:00:00Z" },
    { movimiento: "REGRESO_DE_COMER", fecha_hora: "2027-01-04T19:30:00Z" },
    { movimiento: "SALIDA_FINAL", fecha_hora: "2027-01-04T23:00:00Z" },
  ];
  assert.equal(
    calcularJornada2027(registros, 480, true, 30, "17:00").minutosAdicionales,
    0,
  );
});
test("los horarios de 2027 conservan 2026 y distinguen el sábado y la comida", () => {
  const general = {
    codigo_horario: "ALL-GEN",
    nombre_completo: "Ejemplo",
    empresa_codigo: "ALLAN",
  };
  const admin = { ...general, codigo_horario: "ALL-ADM" };
  assert.equal(
    scheduleForEmployee(general, defaultSchedules, new Date(2026, 11, 26, 12))
      .hora_fin,
    "18:00",
  );
  const sabado = scheduleForEmployee(
    general,
    defaultSchedules,
    new Date(2027, 0, 2, 12),
  );
  assert.equal(sabado.hora_fin, "16:00");
  assert.equal(sabado.minutos_programados, 360);
  assert.equal(sabado.comida_cuenta_jornada, false);
  assert.equal(
    scheduleForEmployee(admin, defaultSchedules, new Date(2027, 0, 2, 12))
      .hora_fin,
    "15:00",
  );
  assert.equal(
    scheduleForEmployee(admin, defaultSchedules, new Date(2027, 0, 2, 12))
      .comida_cuenta_jornada,
    true,
  );
  const rotativo = scheduleForEmployee(
    { ...general, codigo_horario: "EDG-ROT" },
    defaultSchedules,
    new Date(2027, 0, 2, 12),
  );
  assert.equal(
    Number(rotativo.hora_fin.slice(0, 2)) -
      Number(rotativo.hora_inicio.slice(0, 2)),
    6,
  );
});
