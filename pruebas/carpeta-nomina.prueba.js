import test from "node:test";
import assert from "node:assert/strict";
import { procesarCarpetaNomina } from "../codigo/utilidades/carpetaNomina.js";
import { guardarNomina } from "../codigo/dominio/nomina.js";
import { entradaNominaEjemplo } from "./soporte/nominaEjemplo.js";
test("carpeta mixta acumula empresas y meses, omite otros formatos, preserva duplicados y continúa tras errores", async () => {
  let state = { payroll: [], audit: [] };
  const vistos = [],
    progreso = [];
  const entradas = {
    "a.pdf": entradaNominaEjemplo(),
    "b.pdf": entradaNominaEjemplo({ empresa: "EDGAR", mes: 2 }),
    "c.pdf": entradaNominaEjemplo(),
  };
  const resultado = await procesarCarpetaNomina(
    ["a.pdf", "b.pdf", "c.pdf", "d.pdf", "notas.txt"].map((name) => ({
      name,
      size: 100,
      webkitRelativePath: "carpeta/sub/" + name,
    })),
    {
      leer: async (archivo) => {
        vistos.push(archivo.name);
        if (archivo.name === "d.pdf") throw Error("PDF ilegible");
        return entradas[archivo.name];
      },
      guardar: async (entrada) => {
        const next = guardarNomina(state, entrada);
        const cambio = next !== state;
        state = next;
        return cambio;
      },
      alProgreso: (p) => progreso.push(p),
    },
  );
  assert.deepEqual(
    resultado.resultados.map((r) => r.estado),
    ["Guardado", "Guardado", "Ya cargado", "No guardado"],
  );
  assert.equal(resultado.omitidos, 1);
  assert.equal(state.payroll.length, 2);
  assert.equal(vistos.includes("notas.txt"), false);
  assert.equal(progreso.at(-1).total, 4);
});
test("carpeta no confirma un guardado que falló y permite continuar", async () => {
  let intentos = 0;
  const r = await procesarCarpetaNomina(
    [
      { name: "1.pdf", size: 1 },
      { name: "2.pdf", size: 1 },
    ],
    {
      leer: async () => entradaNominaEjemplo(),
      guardar: async () => {
        if (++intentos === 1) throw Error("Sin conexión");
        return true;
      },
    },
  );
  assert.deepEqual(
    r.resultados.map((r) => r.estado),
    ["No guardado", "Guardado"],
  );
});
test("carpetas vacías, excesivas o demasiado grandes se rechazan antes de leer", async () => {
  const opciones = {
    leer: async () => assert.fail("No debe leer"),
    guardar: async () => assert.fail("No debe guardar"),
  };
  for (const archivos of [
    [],
    [{ name: "a.txt", size: 1 }],
    Array.from({ length: 101 }, () => ({ name: "a.pdf", size: 1 })),
    [{ name: "a.pdf", size: 201 * 1024 * 1024 }],
  ])
    await assert.rejects(() => procesarCarpetaNomina(archivos, opciones));
});
