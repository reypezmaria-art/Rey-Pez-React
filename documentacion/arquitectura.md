# Arquitectura de la revisión local

`Aplicacion.jsx` separa administración, terminal de asistencia y captura operativa. `ProveedorAplicacion.jsx` mantiene datos, sesión y reloj; centraliza guardados y validación de contraseña. El acceso administrativo exige sesión de María, mientras la captura llama a una operación que valida empresa y bitácora autorizada. La terminal registra con credencial del empleado y no contiene navegación administrativa.

`repositorioLocal.js` concentra localStorage, migración del catálogo, notificaciones entre pestañas del mismo origen y respaldos automáticos. Usa la clave histórica `reypez_react_v1` para conservar información anterior y el esquema 2 para nuevos campos. Las copias privadas no se publican en Git.

`asistencia.js` resuelve horarios vigentes, rotación semanal, excepciones por fecha, secuencia de cuatro marcajes, comida desde la salida real y ausencias pendientes de revisión. `operaciones.js` conserva registros originales; una corrección administrativa agrega un registro con responsable y motivo. Los nuevos marcajes guardan el horario aplicado para interpretación del historial.

`bitacoras.js` valida empresa, área, bitácora, resultado y motivo de No aplica. Una revisión programada se cierra mediante su clave explícita y no puede duplicarse. Las temperaturas utilizan los tres límites internos aprobados. Mantenimiento queda separado del registro de lectura.

`seguridad.js` deriva contraseñas con PBKDF2/SHA-256, 210000 iteraciones y sal aleatoria. Las sesiones se mantienen en memoria; recargar exige ingresar otra vez. Los formularios permiten asignación, cambio, restablecimiento y bloqueo. Este control de interfaz no sustituye permisos de servidor: el HTML y localStorage contienen información accesible al dueño del archivo o navegador.

## Firebase

Si `.env` no tiene proyecto, `repositorio.js` sigue usando `repositorioLocal.js`. Con `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY` y `VITE_FIREBASE_APP_ID`, el mismo estado se reparte en colecciones de Cloud Firestore (`empleados`, `asistencia`, `alertas`, `horarios`, `bitacoras`, `mantenimiento`, `revisiones`, `auditoria` y `operacion/config`). Los adjuntos van a Cloud Storage en `evidencias/`.

El ID de pantalla no cambia. Auth usa el correo `{id}@acceso.reypez.app`. María crea la primera cuenta en el navegador y el documento `acceso/admin` solo puede crearse una vez, y solo con el correo `maria@acceso.reypez.app`. Las contraseñas de trabajadores y la terminal de asistencia pasan por la función `gestionarAcceso`, porque el cliente no puede modificar la cuenta de otra persona. Las reglas rechazan lecturas de personal sin sesión: María escribe la operación; un trabajador solo lee empleados y bitácoras de su empresa y de los tipos autorizados en `operacion/config`; una terminal vinculada lee el catálogo de asistencia y no lee bitácoras ni evidencias. El marcaje de terminal o trabajador tiene que seguir la secuencia entrada, comida, regreso y salida, con la fecha del día en Guatemala, y actualizar `secuenciaAsistencia/{idEmpleado}` en el mismo lote. Las correcciones antiguas las escribe María.

La primera vez que María entra, si Firestore está vacío y el navegador tiene `reypez_react_v1`, se copia ese catálogo sin empleados de demostración ni hashes locales. Esas contraseñas hay que volver a asignarlas en Seguridad. No hay huella ni acceso remoto distinto del que Firebase ya permite con la sesión iniciada.

La vista autocontenida se genera con `npm run vista-local`; integra el catálogo privado si está disponible, logos y recursos. La herramienta no incluye empleados en el código versionado. Un QR con un archivo local o localhost funciona solo en ese entorno; captura desde teléfonos requiere una dirección accesible y la infraestructura compartida.
