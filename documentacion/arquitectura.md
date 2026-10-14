# Arquitectura de la revisión local

`Aplicacion.jsx` separa administración, terminal de asistencia y captura operativa. `ProveedorAplicacion.jsx` mantiene datos, sesión y reloj; centraliza guardados y validación de contraseña. El acceso administrativo exige sesión de María, mientras la captura llama a una operación que valida empresa y bitácora autorizada. La terminal registra con credencial del empleado y no contiene navegación administrativa.

`repositorioLocal.js` concentra localStorage, migración del catálogo, notificaciones entre pestañas del mismo origen y respaldos automáticos. Usa la clave histórica `reypez_react_v1` para conservar información anterior y el esquema 2 para nuevos campos. Las copias privadas no se publican en Git.

`asistencia.js` resuelve horarios vigentes, rotación semanal, excepciones por fecha, secuencia de cuatro marcajes, comida desde la salida real y ausencias pendientes de revisión. `operaciones.js` conserva registros originales; una corrección administrativa agrega un registro con responsable y motivo. Los nuevos marcajes guardan el horario aplicado para interpretación del historial.

`bitacoras.js` valida empresa, área, bitácora, resultado y motivo de No aplica. Una revisión programada se cierra mediante su clave explícita y no puede duplicarse. Las temperaturas utilizan los tres límites internos aprobados. Mantenimiento queda separado del registro de lectura.

`seguridad.js` deriva contraseñas con PBKDF2/SHA-256, 210000 iteraciones y sal aleatoria. Las sesiones se mantienen en memoria; recargar exige ingresar otra vez. Los formularios permiten asignación, cambio, restablecimiento y bloqueo. Este control de interfaz no sustituye permisos de servidor: el HTML y localStorage contienen información accesible al dueño del archivo o navegador.

## Próxima infraestructura

No hay Firebase activo. Para operación multiusuario se requieren credenciales del servicio, autenticación centralizada, permisos de servidor por entidad, sincronización, gestión segura de archivos y autorización central de equipos. El archivo `.env.ejemplo` únicamente documenta parámetros futuros. No se simulan registros sincronizados, huellas ni acceso remoto funcional.

La vista autocontenida se genera con `npm run vista-local`; integra el catálogo privado si está disponible, logos y recursos. La herramienta no incluye empleados en el código versionado. Un QR con un archivo local o localhost funciona solo en ese entorno; captura desde teléfonos requiere una dirección accesible y la infraestructura compartida.
