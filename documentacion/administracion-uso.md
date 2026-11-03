# Administración y uso de la aplicación

María abre **Administración** desde la barra lateral. Los trabajadores conservan únicamente sus apartados autorizados. El informe no concede permisos nuevos ni altera asistencia, nómina o sanciones.

La consulta permite elegir fechas (hasta un año), resumen por usuario o sesiones iniciadas en el período, empresa de la cuenta y usuario. **Consultar / actualizar** trae datos actuales. Si hay más de 200 registros, **Cargar más registros** completa la consulta; los totales y los filtros son parciales hasta terminar. Se muestra cuándo se consultó. La empresa indicada es la de la cuenta: una autorización de Nómina de tres empresas no cambia la empresa del trabajador.

## Qué se cuenta

- **Visible:** intervalos observados con la aplicación visible y al frente.
- **Actividad reciente:** parte del tiempo visible con una interacción en los cinco minutos anteriores. Incluye las interacciones dentro del editor de nómina.
- **Sesiones iniciadas:** ingresos registrados en las fechas elegidas. Una sesión que cruza medianoche aparece una sola vez en Sesiones, pero su duración se divide entre los días correspondientes en el resumen.
- **Sin señal reciente:** no ha llegado un pulso en dos minutos; no significa necesariamente que la persona haya cerrado sesión.

El pie de página informa al usuario que se registra el uso. No se guardan contraseñas, teclas, contenido de celdas ni coordenadas del puntero. El tiempo es aproximado, no equivale a horas trabajadas. No existe historial anterior a la publicación. Una desconexión o suspensión puede perder intervalos; no se reconstruyen tiempos desconocidos. La copia local sin Firebase no registra este informe compartido.

## Persistencia y acceso

Firestore existente: edición Standard, proyecto `rey-pez-admin-react`. Colecciones privadas `usoSesiones` y `usoDiario`, accesibles solo desde el Worker con la credencial técnica existente. Las reglas actuales deniegan el acceso directo a estas colecciones, incluso al SDK cliente de María. `consultarUso` exige el UID de `acceso/admin`, token válido y cuenta sin bloqueo. `registrarUso` deriva identidad, nombre, empresa y permisos de los documentos del servidor; no acepta identidad enviada por el navegador.

Los pulsos se envían cada minuto y al cambiar de visibilidad o cerrar sesión. Se miden intervalos de hasta 30 segundos y el servidor limita cada crédito a dos minutos y al tiempo real transcurrido. Los contadores acumulativos y la secuencia hacen idempotentes los reintentos. Las transacciones evitan sumar dos veces intervalos de una misma cuenta desde pestañas o equipos simultáneos en el resumen. Cada fila de Sesiones muestra su propia duración, que puede coincidir con otra sesión. No se guarda un documento por pulsación: se actualiza la sesión y el acumulado diario. Los datos permanecen hasta una futura política de eliminación que María defina. El respaldo JSON operativo no incluye este historial de uso.

Se usa el mismo Worker gratuito y Firebase Spark; no se activa Blaze, Functions, Storage ni un servicio de pago. La función aumenta las lecturas y escrituras según los usuarios conectados y las consultas realizadas, dentro de las cuotas disponibles del proyecto. La actualización necesita publicar **primero el Worker y después Hosting**. `herramientas/actualizarNomina.ps1` realiza ambos pasos y conserva las credenciales existentes.

## Asistencia 2

La empresa se elige una sola vez y aparecen seis tarjetas: Revisar ausencias, Registros de asistencia, Historial de incidencias, Alertas pendientes, Reporte en PDF y Pantalla de trabajador. Al entrar se muestra únicamente ese apartado; **Volver a Asistencia 2** regresa a las tarjetas. Registros e historial permiten buscar; los registros se muestran de 30 en 30. Revisar alertas solo afecta a la empresa seleccionada. Se conservan los formularios de revisión, los motivos, los responsables y los registros originales.
