import { createContext, useContext } from "react";
export const ContextoAplicacion = createContext(null);
export function useAplicacion() {
  const value = useContext(ContextoAplicacion);
  if (!value) throw Error("useAplicacion requiere ProveedorAplicacion.");
  return value;
}
