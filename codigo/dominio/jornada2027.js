// Calcula una jornada cerrada; no modifica marcaciones ni autoriza pagos.
export function calcularJornada2027(
  marcas,
  minutosProgramados,
  comidaCuenta,
  minutosComida = 30,
  horaSalida = null,
) {
  if (
    !Number.isInteger(minutosProgramados) ||
    minutosProgramados <= 0 ||
    typeof comidaCuenta !== "boolean"
  )
    return null;
  const movimientos = [...marcas].sort(
    (a, b) => Date.parse(a.fecha_hora) - Date.parse(b.fecha_hora),
  );
  const tipos = movimientos.map((m) => m.movimiento);
  const completa = tipos.join(",");
  if (
    completa !== "ENTRADA,SALIDA_FINAL" &&
    completa !== "ENTRADA,SALIDA_A_COMER,REGRESO_DE_COMER,SALIDA_FINAL"
  )
    return null;
  if (movimientos.length !== 4) return null;
  const tiempos = movimientos.map((m) => Date.parse(m.fecha_hora));
  if (
    tiempos.some((n) => !Number.isFinite(n)) ||
    tiempos.some((n, i) => i && n < tiempos[i - 1])
  )
    return null;
  let trabajado = (tiempos.at(-1) - tiempos[0]) / 60000;
  const comida = (tiempos[2] - tiempos[1]) / 60000;
  trabajado -= comidaCuenta ? Math.max(0, comida - minutosComida) : comida;
  let minutosAdicionales = Math.max(0, trabajado - minutosProgramados);
  if (horaSalida) {
    if (!/^\d{2}:\d{2}$/.test(horaSalida)) return null;
    const [h, m] = horaSalida.split(":").map(Number);
    const partes = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(tiempos.at(-1)))
      .split(":")
      .map(Number);
    minutosAdicionales = Math.min(
      minutosAdicionales,
      Math.max(0, partes[0] * 60 + partes[1] - h * 60 - m),
    );
  }
  return {
    minutosTrabajados: trabajado,
    minutosProgramados,
    minutosAdicionales,
  };
}
