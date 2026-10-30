import { companyNames } from "../datos/constantes.js";
import { normalizarNomina, centavos, validarRecibo } from "./nomina.js";
const numero = /^-?\d[\d,]*\.\d{2}$/;
export function filasPdfNomina(pagina) {
  const vistos = new Set();
  const items = pagina.items
    .filter((i) => {
      if (!i.str?.trim() || !i.transform) return false;
      const k = [
        i.str,
        i.transform[4].toFixed(2),
        i.transform[5].toFixed(2),
      ].join("|");
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((i) => ({ texto: i.str.trim(), x: i.transform[4], y: i.transform[5] }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const filas = [];
  for (const item of items) {
    let fila = filas.at(-1);
    if (!fila || Math.abs(fila.y - item.y) > 1.3) {
      fila = { y: item.y, items: [] };
      filas.push(fila);
    }
    fila.items.push(item);
  }
  return filas.map((f) => {
    const partes = f.items.sort((a, b) => a.x - b.x);
    return {
      partes,
      texto: partes.map((i) => i.texto).join(" "),
      izquierda: partes
        .filter((i) => i.x < pagina.ancho / 2)
        .map((i) => i.texto)
        .join(" "),
      derecha: partes
        .filter((i) => i.x >= pagina.ancho / 2)
        .map((i) => i.texto)
        .join(" "),
    };
  });
}
function fechaPdf(d, m, a) {
  const meses = {
    ene: 1,
    enero: 1,
    feb: 2,
    febrero: 2,
    mar: 3,
    marzo: 3,
    abr: 4,
    abril: 4,
    may: 5,
    mayo: 5,
    jun: 6,
    junio: 6,
    jul: 7,
    julio: 7,
    ago: 8,
    agosto: 8,
    sep: 9,
    sept: 9,
    septiembre: 9,
    oct: 10,
    octubre: 10,
    nov: 11,
    noviembre: 11,
    dic: 12,
    diciembre: 12,
  };
  const mes = /^\d+$/.test(m) ? Number(m) : meses[m.toLowerCase()];
  if (!mes) throw Error("No se pudo leer el mes de la nómina.");
  const f = `${a}-${String(mes).padStart(2, "0")}-${d.padStart(2, "0")}`;
  if (
    !Number.isFinite(Date.parse(f)) ||
    new Date(f + "T12:00:00Z").toISOString().slice(0, 10) !== f
  )
    throw Error("Fecha de nómina ilegible.");
  return f;
}
function conceptoDe(texto) {
  const m = texto.match(
    /^(\d{1,5})\s+(.+?)\s+(-?\d[\d,]*\.\d{2})(?:\s+(-?\d[\d,]*\.\d{2}))?$/,
  );
  if (!m) return null;
  return {
    codigo: m[1],
    concepto: m[2].trim(),
    valor: m[4] ? Number(m[3].replaceAll(",", "")) : null,
    importe: centavos(m[4] || m[3]),
    informativo: false,
  };
}
function terminar(r) {
  if (
    !r ||
    r.salarioDiario === null ||
    r.diasPagados === null ||
    r.neto === null ||
    r.totalPercepciones === null ||
    r.totalDeducciones === null
  )
    throw Error(
      "Hay un trabajador incompleto en el PDF. No se guardó la nómina.",
    );
  const porCodigo = new Map(r.deducciones.map((c) => [c.codigo, c]));
  if (porCodigo.has("45"))
    for (const codigo of ["32", "41"])
      if (porCodigo.has(codigo)) porCodigo.get(codigo).informativo = true;
  const infonavit = porCodigo.get("179");
  if (
    infonavit &&
    r.deducciones.some(
      (c) =>
        c.codigo !== "179" &&
        /infonavit/i.test(c.concepto) &&
        c.importe === infonavit.importe,
    )
  )
    infonavit.informativo = true;
  return validarRecibo(r);
}
export function extraerNomina(paginas, aliases = {}) {
  const filas = paginas.flatMap(filasPdfNomina);
  const empresas = new Set(),
    periodos = new Set(),
    numeros = new Set();
  let esperado = null;
  for (const f of filas) {
    const nombre = normalizarNomina(f.texto);
    for (const [codigo, original] of Object.entries(companyNames))
      if (
        [original, ...(aliases[codigo] || [])].some(
          (n) => normalizarNomina(n) === nombre,
        )
      )
        empresas.add(codigo);
    const p = nombre.match(
      /LISTA DE RAYA DEL\s+(\d{1,2})\/([A-Z]+|\d{1,2})\/(\d{4})\s+AL\s+(\d{1,2})\/([A-Z]+|\d{1,2})\/(\d{4})/,
    );
    if (p)
      periodos.add(
        fechaPdf(...p.slice(1, 4)) + "|" + fechaPdf(...p.slice(4, 7)),
      );
    const n = nombre.match(/PERIODO\s+QUINCENAL\s+NO\.?\s*(\d+)/);
    if (n) numeros.add(Number(n[1]));
    const total = nombre.match(
      /TOTAL DE EMPLEADOS(?: GENERAL)?\s*:\s*(\d+)$|TOTAL DE EMPLEADOS GENERAL\s+(\d+)$/,
    );
    if (total) {
      const count = Number(total[1] || total[2]);
      if (esperado !== null && esperado !== count)
        throw Error("El total de trabajadores del PDF es ambiguo.");
      esperado = count;
    }
  }
  if (empresas.size !== 1 || periodos.size !== 1 || numeros.size > 1)
    throw Error(
      "No se pudo identificar una sola empresa y período. Conserva la nómina anterior y revisa el PDF.",
    );
  const empresa_codigo = [...empresas][0],
    [desde, hasta] = [...periodos][0].split("|");
  const registros = [];
  let actual = null;
  for (const f of filas) {
    const inicio = f.izquierda.match(
      /^(\d{2,8})\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .,'-]+)$/i,
    );
    if (
      inicio &&
      !numero.test(inicio[1]) &&
      !/TOTAL|PERCEPCION|DEDUCCION/i.test(inicio[2])
    ) {
      if (actual)
        throw Error("Un recibo termina incompleto. No se importó el archivo.");
      actual = {
        clave: "COD:" + inicio[1],
        codigo: inicio[1],
        nombre: inicio[2].trim(),
        salarioDiario: null,
        diasPagados: null,
        percepciones: [],
        deducciones: [],
        totalPercepciones: null,
        totalDeducciones: null,
        neto: null,
      };
      continue;
    }
    if (!actual) continue;
    const rfc = f.texto.match(
      /\bRFC:\s*([A-ZÑ&]{3,4}[- ]?\d{6}[- ]?[A-Z0-9]{3})\b/i,
    );
    if (rfc)
      actual.clave = "RFC:" + normalizarNomina(rfc[1]).replace(/[- ]/g, "");
    const salario = f.texto.match(/Sal\.\s*diario:\s*(-?[\d,]+\.\d{2})/i);
    if (salario) actual.salarioDiario = centavos(salario[1]);
    const dias = f.texto.match(/D[ií]as pagados:\s*([\d.]+)/i);
    if (dias) actual.diasPagados = Number(dias[1]);
    const percep = f.izquierda.match(/Total Percepciones\s+(-?[\d,]+\.\d{2})/i);
    if (percep) actual.totalPercepciones = centavos(percep[1]);
    const ded = f.derecha.match(/Total Deducciones\s+(-?[\d,]+\.\d{2})/i);
    if (ded) actual.totalDeducciones = centavos(ded[1]);
    const neto = f.izquierda.match(/Neto a pagar\s+(-?[\d,]+\.\d{2})/i);
    if (neto) {
      actual.neto = centavos(neto[1]);
      registros.push(terminar(actual));
      actual = null;
      continue;
    }
    for (const [lado, campo] of [
      ["izquierda", "percepciones"],
      ["derecha", "deducciones"],
    ]) {
      const concepto = conceptoDe(f[lado]);
      if (concepto) actual[campo].push(concepto);
    }
  }
  if (
    actual ||
    !registros.length ||
    (esperado !== null && esperado !== registros.length)
  )
    throw Error(
      "No se pudieron extraer todos los trabajadores. No se guardó el PDF.",
    );
  if (new Set(registros.map((r) => r.clave)).size !== registros.length)
    throw Error("El PDF repite un trabajador dentro del período.");
  return {
    id: `${empresa_codigo}_${desde}_${hasta}`,
    empresa_codigo,
    empresa_nombre: companyNames[empresa_codigo],
    desde,
    hasta,
    anio: Number(desde.slice(0, 4)),
    mes: Number(desde.slice(5, 7)),
    numeroPeriodo: [...numeros][0] || 0,
    registrosJson: JSON.stringify(registros),
  };
}
