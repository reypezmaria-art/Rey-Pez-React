import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Aplicacion from "./aplicacion/Aplicacion.jsx";
import ProveedorAplicacion from "./aplicacion/ProveedorAplicacion.jsx";
import "./estilos/aplicacion.css";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProveedorAplicacion>
      <Aplicacion />
    </ProveedorAplicacion>
  </StrictMode>,
);
