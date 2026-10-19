export function dataUrlABytes(dataUrl) {
  const [meta, contenido] = String(dataUrl || "").split(",");
  const tipo = /data:([^;,]+)/.exec(meta)?.[1] || "application/octet-stream";
  const binario = atob(contenido || "");
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice += 1)
    bytes[indice] = binario.charCodeAt(indice);
  return { bytes, tipo };
}

export function bytesADataUrl(bytes, tipo) {
  let binario = "";
  const bloque = 0x8000;
  for (let indice = 0; indice < bytes.length; indice += bloque) {
    binario += String.fromCharCode(...bytes.subarray(indice, indice + bloque));
  }
  return `data:${tipo || "application/octet-stream"};base64,${btoa(binario)}`;
}
