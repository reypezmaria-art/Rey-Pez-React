# Editor de nómina integrado

Nómina permite abrir un libro mensual o anual de una empresa y año. La cinta incluye Inicio, Insertar, Disposición de página, Fórmulas, Datos, Revisar, Vista y Ayuda. Se construye con el núcleo abierto de Univer; no utiliza conversión Pro ni servicios de pago adicionales.

Los libros guardan el estado completo del editor y una copia del archivo original, comprimidos en versiones privadas de Firestore. El encabezado, metadatos y contenido se escriben juntos; una revisión antigua no sobrescribe una nueva. Guardar confirma únicamente después de persistir. El historial permite recuperar versiones. Cada formato tiene su propio libro: editar el mensual no modifica automáticamente el anual, ni viceversa.

La descarga del libro guardado conserva valores, fórmulas internas, notas, hojas, combinaciones, formato básico, dimensiones, cuadrícula e inmovilización. Los filtros se mantienen en la vista guardada; el Excel descargado incluye todas las filas. La vista de impresión es simplificada. Macros, gráficos, tablas dinámicas y objetos avanzados originales no se editan ni exportan. Las referencias externas se descargan como su último valor con una nota; no se contactan archivos externos. El original permanece dentro del respaldo de cada versión.

## Importación de acumulados

El usuario selecciona el Excel. La hoja ACUM X MES identifica empresa y ejercicio; se presenta un resumen antes de guardar. Se conservan periodos originales, sueldo del periodo y conceptos, sin convertirlos en salario diario. Filas sin importes o con todos los importes en cero se consideran plantilla. Los periodos imposibles se señalan y las hojas de otros ejercicios no se mezclan.

Ambos formatos incluyen Acumulado como primera hoja. El mensual separa meses; el anual separa trabajadores. En los detalles aparecen primero nombre, periodo, sueldo, percepciones, descuentos y neto; las demás columnas e identificaciones se conservan a la derecha. Las fórmulas aritméticas locales y SUM se trasladan a las columnas nuevas; las referencias no trasladables conservan su valor y una nota.

El acumulado fiscal original es una fotografía editable del archivo, no una declaración calculada por la aplicación. ISR enterado y exentos requieren revisión del responsable. No se inventan pagos fiscales ni datos de trabajadores que el archivo no contiene.

Una importación posterior conserva periodos de la fuente anterior que no aparezcan en la nueva. Si ya existen libros, se advierte antes de regenerarlos: los ajustes manuales permanecen en las versiones anteriores. Mensual y anual se guardan por separado; si falla el segundo, el aviso indica cuál sí se guardó. La carga comprimida de cada versión se limita antes de escribir, para respetar el tamaño de documento de Firestore. No hay guardado silencioso fuera de línea.

## Permisos y despliegue

María administra las autorizaciones. Se conserva el permiso existente de captura y edición de Nómina de las tres empresas y se añade un permiso separado de consulta y exportación. Una cuenta de consulta no escribe nóminas, libros, permisos ni otras secciones. Baja, bloqueo o revocación impiden leer en Firebase.

La instalación puede usar VITE_NOMINA_CONSULTA_INICIAL para indicar una cuenta autorizada por María. La migración se ejecuta una sola vez, dentro de su sesión administrativa; revocar el permiso después no lo reactiva. El ID concreto se mantiene en la configuración local, fuera del repositorio.

La compilación principal genera los recursos estáticos del editor automáticamente. Publicar únicamente firestore:rules y hosting; no requiere activar Storage. El actualizador conserva la configuración local y comprueba el proyecto antes de publicar. Nunca publicar una compilación sin las variables de Firebase.

Las reglas nuevas son un prototipo que exige revisión antes de ampliar el acceso. Las pruebas usan exclusivamente archivos y cuentas ficticios: consulta autorizada y revocada, aislamiento de administración, historial inmutable, escritura incompleta, revisiones y esquemas inválidos, edición/reapertura/exportación y conflicto entre ventanas.

En Autorizaciones, Bitácoras y Secciones son desplegables independientes. Secciones permite Personal, Nómina, Mantenimiento y compras, y Reportes y CSV. Personal, mantenimiento y reportes son consultas de la empresa seleccionada; solo Nómina ofrece alcance de las tres empresas y nivel de captura opcional. Las demás acciones de administración continúan restringidas. Los reportes autorizados incluyen asistencia, incidencias y personal, con búsqueda y descarga CSV de las filas visibles.
