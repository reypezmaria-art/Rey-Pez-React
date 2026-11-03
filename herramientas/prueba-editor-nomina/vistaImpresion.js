/* global document */
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { crearPdfImpresion } from "./impresionNomina.js";
GlobalWorkerOptions.workerSrc = workerUrl;

export async function mostrarImpresion({ libro, descargar, todas = false }) {
  await libro.endEditingAsync(true);
  const snapshot = libro.save(),
    activa = libro.getActiveSheet().getSheetId();
  const dialogo = document.getElementById("dialogo-cinta"),
    contenido = document.getElementById("contenido-dialogo");
  contenido.replaceChildren();
  document.getElementById("titulo-dialogo").textContent =
    "Imprimir carta horizontal";
  const etiqueta = document.createElement("label");
  etiqueta.textContent = "Hojas para imprimir ";
  const elegir = document.createElement("select");
  elegir.setAttribute("aria-label", "Hojas para imprimir");
  for (const [valor, texto] of [
    [activa, "Hoja actual"],
    ["todas", "Todas las hojas del libro"],
  ]) {
    const opcion = document.createElement("option");
    opcion.value = valor;
    opcion.textContent = texto;
    elegir.append(opcion);
  }
  etiqueta.append(elegir);
  if (todas) elegir.value = "todas";
  const preparar = document.createElement("button");
  preparar.textContent = "Preparar impresión";
  const imprimir = document.createElement("button");
  imprimir.textContent = "Imprimir / guardar PDF";
  const guardar = document.createElement("button");
  guardar.textContent = "Descargar PDF carta horizontal";
  const estado = document.createElement("p");
  estado.setAttribute("role", "status");
  const info = document.createElement("p");
  info.textContent =
    "Carta horizontal. Las columnas se distribuyen en páginas conservando los nombres y encabezados para que la letra sea legible.";
  const marco = document.createElement("iframe");
  marco.title = "Vista previa carta horizontal";
  marco.className = "vista-impresion";
  marco.setAttribute("sandbox", "allow-same-origin allow-modals");
  contenido.append(etiqueta, preparar, imprimir, guardar, info, estado, marco);
  dialogo.showModal();
  let bytes;
  async function generar() {
    preparar.disabled = imprimir.disabled = guardar.disabled = true;
    estado.setAttribute("role", "status");
    estado.textContent = "Preparando páginas en carta horizontal…";
    let tarea;
    try {
      bytes = crearPdfImpresion(
        snapshot,
        elegir.value === "todas" ? snapshot.sheetOrder : [activa],
      );
      tarea = getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const pdf = await tarea.promise;
      if (pdf.numPages > 120)
        throw Error(
          "La impresión supera 120 páginas. Selecciona una sola hoja para imprimir.",
        );
      const imagenes = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const pagina = await pdf.getPage(n),
          vista = pagina.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = vista.width;
        canvas.height = vista.height;
        await pagina.render({
          canvasContext: canvas.getContext("2d"),
          viewport: vista,
        }).promise;
        imagenes.push(
          `<section class="pagina"><img alt="Página ${n}" src="${canvas.toDataURL("image/png")}"></section>`,
        );
        canvas.width = canvas.height = 0;
      }
      if (!dialogo.open) return;
      marco.onload = () => {
        imprimir.disabled = false;
      };
      marco.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nómina · Carta horizontal</title><style>@page{size:letter landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8edf4}.pagina{margin:8px auto;background:white;max-width:100%}img{display:block;width:100%;height:auto}@media print{body{background:white}.pagina{width:279.4mm;height:215.9mm;max-width:none;margin:0;break-after:page}.pagina:last-child{break-after:auto}img{width:100%;height:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${imagenes.join("")}</body></html>`;
      guardar.disabled = false;
      estado.textContent = `${pdf.numPages} páginas listas. Carta horizontal.`;
    } catch (error) {
      bytes = null;
      estado.setAttribute("role", "alert");
      estado.textContent = error.message;
    } finally {
      preparar.disabled = false;
      if (tarea) await tarea.destroy();
    }
  }
  preparar.onclick = generar;
  elegir.onchange = () => {
    imprimir.disabled = guardar.disabled = true;
    estado.textContent =
      "Pulsa Preparar impresión para actualizar las páginas.";
  };
  imprimir.onclick = () => {
    marco.contentWindow.focus();
    marco.contentWindow.print();
  };
  guardar.onclick = async () => {
    if (!bytes) return;
    try {
      await descargar(
        bytes,
        `${(snapshot.name || "Nomina").replace(/\.xlsx$/i, "")}_carta_horizontal.pdf`,
      );
    } catch (error) {
      estado.setAttribute("role", "alert");
      estado.textContent = error.message;
    }
  };
  await generar();
}
