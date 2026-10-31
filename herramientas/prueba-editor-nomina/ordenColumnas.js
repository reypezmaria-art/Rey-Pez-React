// Solo identifica el formato generado antes de recuperar el orden de origen.
// Las hojas personalizadas y Acumulado se conservan tal como están.
export const ordenAnterior = [
  1, 2, 5, 12, 17, 19, 20, 21, 22, 23, 24, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16,
  18, 3, 4,
];
export function hojasConOrdenAnterior(snapshot) {
  return snapshot.sheetOrder.filter((id) => {
    const hoja = snapshot.sheets[id],
      fila = hoja.cellData?.[2];
    return (
      !/^Acumulado\s+\d{4}$/i.test(hoja.name) &&
      fila?.[0]?.v === "NOMBRE" &&
      fila?.[1]?.v === "PERIODO" &&
      fila?.[2]?.v === "SUELDO DEL PERIODO" &&
      fila?.[3]?.v === "TOTAL PERCEPCIONES" &&
      fila?.[5]?.v === "IMSS (DEDUCCIÓN)" &&
      fila?.[22]?.v === "IMSS" &&
      fila?.[23]?.v === "R.F.C."
    );
  });
}

export async function recuperarOrdenOriginal(api) {
  const libro = api.getActiveWorkbook();
  const ids = hojasConOrdenAnterior(libro.save());
  // Los controladores que actualizan referencias se registran al terminar la carga.
  const listo = api.Enum.LifecycleStages.Steady;
  if (ids.length && api.getCurrentLifecycleStage() < listo) {
    await new Promise((resolve, reject) => {
      const temporizador = setTimeout(() => {
        subscripcion.dispose();
        reject(
          Error(
            "El editor sigue preparando las fórmulas. Cierra y vuelve a abrir el libro para aplicar el orden.",
          ),
        );
      }, 15000);
      const subscripcion = api.addEvent(
        api.Event.LifeCycleChanged,
        ({ stage }) => {
          if (stage < listo) return;
          clearTimeout(temporizador);
          subscripcion.dispose();
          resolve();
        },
      );
    });
  }
  const activa = libro.getActiveSheet().getSheetId();
  for (const id of ids) {
    const hoja = libro.getSheetBySheetId(id);
    libro.setActiveSheet(hoja);
    // Deshacer únicamente las combinaciones de título antes de mover columnas.
    hoja.getRange("A1:X2").breakApart();
    const actual = [...ordenAnterior];
    for (let destino = 0; destino < 24; destino++) {
      const origen = actual.indexOf(destino + 1);
      if (origen === destino) continue;
      // El motor actualiza también las referencias de las fórmulas del libro.
      hoja.moveColumns(hoja.getRange(0, origen, hoja.getMaxRows(), 1), destino);
      actual.splice(destino, 0, ...actual.splice(origen, 1));
    }
    const datos = libro.save().sheets[id].cellData;
    for (const fila of [0, 1]) {
      const hayAnotaciones = Object.entries(datos[fila] || {}).some(
        ([col, celda]) =>
          +col > 0 &&
          +col < 24 &&
          (celda.f ||
            celda.p ||
            (celda.v !== null && celda.v !== undefined && celda.v !== "")),
      );
      if (!hayAnotaciones) hoja.getRange(`A${fila + 1}:X${fila + 1}`).merge();
    }
    hoja.getRange("E3").setValue("SUELDO");
    hoja.getRange("L3").setValue("TOTAL");
    hoja.getRange("S3").setValue("IMSS");
  }
  if (ids.length) libro.setActiveSheet(activa);
  return ids.length > 0;
}
