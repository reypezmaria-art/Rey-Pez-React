import { createLocalRepository } from "./repositorioLocal.js";
import { leerConfiguracionFirebase } from "./firebaseConfiguracion.js";

const configuracion = leerConfiguracionFirebase();

function repositorioIncompleto(faltantes) {
  const mensaje = `Faltan variables de Firebase: ${faltantes.join(", ")}. Completa el archivo .env o déjalas todas vacías para seguir guardando en este navegador.`;
  const fallar = async () => {
    throw Error(mensaje);
  };
  return {
    aviso: mensaje,
    load: fallar,
    transact: fallar,
    subscribe: () => () => {},
    backups: () => [],
    autenticar: fallar,
    configurarAdministrador: fallar,
    asignarContrasena: fallar,
    cambiarEstadoTrabajador: fallar,
    cambiarContrasenaAdministrador: fallar,
    verificarTrabajador: fallar,
    cerrarSesion: fallar,
    subirDatosLocales: fallar,
  };
}

async function crearRepositorio() {
  if (!configuracion) return createLocalRepository();
  if (configuracion.incompleta)
    return repositorioIncompleto(configuracion.faltantes);
  const { crearRepositorioFirestore } =
    await import("./repositorioFirestore.js");
  return crearRepositorioFirestore(configuracion);
}

export const usandoFirebase = Boolean(
  configuracion && !configuracion.incompleta,
);
export const repository = await crearRepositorio();
