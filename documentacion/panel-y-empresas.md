# Panel, seguridad y empresas · 20/10/2026

- Las tarjetas del panel abren la información que cuentan. Alertas por revisar reúne alertas de asistencia, de seguridad, ausencias y revisiones programadas pendientes. La revisión se realiza en su módulo correspondiente.
- Total de empleados abre el personal y el desglose por empresa, con filtros y estado activo/baja. Se retiró el bloque duplicado de la parte inferior del panel.
- Las gráficas usan una semana de lunes a domingo y un mes calendario. Ambas permiten elegir período y abrir el detalle por empresa. Cuentan alertas de asistencia, revisiones de ausencias y alertas de seguridad, incluidas las ya revisadas. No cuentan una ausencia pendiente como falta ni aplican sanciones.
- Las fechas con zona se convierten a Ciudad de México. Los registros sin empresa registrada se agrupan por separado, sin inferir la empresa histórica a partir de un empleado que pudo haber sido transferido.
- Seguridad exige seleccionar primero empresa y después trabajador. Cambiar empresa limpia empleado, acción y contraseñas.
- Marcar revisada conserva la alerta y sus datos de revisión, pero la mueve de pendientes a Registro de incidencias, debajo de Admin, cerrado inicialmente y desplegable mediante una flecha. No desbloquea ninguna cuenta ni elimina registros.
- Las escenas de bloqueo y acceso denegado comienzan animadas por solicitud explícita de María. Se retiró el control de pausa por solicitud de María; el regreso a inicio sigue siendo de diez segundos. El ID se muestra en mayúsculas al escribir y los intentos rechazados limpian la contraseña en acceso y asistencia.
- Seguridad incluye Datos de empresas: razón social, RFC, régimen fiscal, giro, estado y Activa desde. La fecha de actividad queda vacía hasta que María la capture; no se deduce de la fecha de edición. Se retiraron el motivo y la fecha de vigencia del formulario y su tabla de cambios. La auditoría interna conserva valores anteriores, nuevos, responsable y fecha.
- Los RFC, régimen y giro se guardan en la colección privada `empresas`, con acceso solo de administración. El directorio compartido lleva exclusivamente nombre y estado. El código de empresa conserva su identidad y las referencias históricas.
- Dar de baja una empresa no elimina empleados ni registros. No bloquea por sí sola sus cuentas: los accesos siguen administrándose individualmente en Seguridad. La fecha de actividad no admite fechas futuras.

Verificación: pruebas de fechas y períodos, persistencia de empresas y conservación del historial, permisos con emuladores de Firebase, navegación y filtros en escritorio/móvil, fotogramas de ambas escenas bajo movimiento reducido sin control de pausa, y reintentos de contraseña con ID en mayúsculas.

Cuando el formulario rechaza una contraseña aparece un único destello rojo de 900 ms en los bordes. Se repite con cada intento incorrecto, limpia la contraseña y conserva el ID. Se aplica en acceso y asistencia; los errores de conexión no disparan el efecto. Las escenas de bloqueo y acceso denegado no muestran el destello; su animación y retorno de diez segundos se conservan.
