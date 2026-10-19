import { firebaseConfigurado } from "../firebase/configuracion.js";
import { createFirebaseRepository } from "./repositorioFirebase.js";
import { createLocalRepository } from "./repositorioLocal.js";

export const usaFirebase = firebaseConfigurado();
export const repository = usaFirebase
  ? createFirebaseRepository()
  : createLocalRepository();
