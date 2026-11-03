import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Aplicacion from "./aplicacion/Aplicacion.jsx";
import ProveedorAplicacion from "./aplicacion/ProveedorAplicacion.jsx";
import "./estilos/aplicacion.css";

const claveRecarga = "reypez-recarga-chunk";
function esFalloDeChunk(error) {
  const texto = String(error?.message || error || "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    texto,
  );
}
function recargarUnaVez() {
  try {
    const previo = Number(sessionStorage.getItem(claveRecarga) || 0);
    if (Date.now() - previo < 15000) return false;
    sessionStorage.setItem(claveRecarga, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (evento) => {
  if (recargarUnaVez()) evento.preventDefault();
});
window.addEventListener("unhandledrejection", (evento) => {
  if (esFalloDeChunk(evento.reason) && recargarUnaVez())
    evento.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProveedorAplicacion>
      <Aplicacion />
    </ProveedorAplicacion>
  </StrictMode>,
);
