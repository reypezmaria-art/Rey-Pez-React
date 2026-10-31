# Editor de nómina integrado

Nómina permite abrir un libro mensual o anual de una empresa y año. La cinta incluye Inicio, Insertar, Disposición de página, Fórmulas, Datos, Revisar, Vista y Ayuda. Se construye con el núcleo abierto de Univer; no utiliza conversión Pro ni servicios de pago adicionales.

La cinta se puede contraer con «Contraer barra» para disponer de más filas visibles. Las pestañas permanecen accesibles y al seleccionarlas se muestran las herramientas. En pantallas estrechas o de poca altura comienza contraída, salvo que exista una preferencia guardada en ese navegador. Las pestañas y los grupos de herramientas se desplazan horizontalmente dentro de la pantalla; la hoja ocupa el espacio restante.

Los avisos superiores se pueden descartar con «Cerrar». Se retiran tanto el recordatorio como el mensaje y la compatibilidad, y la hoja recupera ese espacio. Un aviso nuevo de guardado o error vuelve a mostrarse y se puede cerrar de nuevo.

Los libros guardan el estado completo del editor y una copia del archivo original, comprimidos en versiones privadas de Firestore. El encabezado, metadatos y contenido se escriben juntos; una revisión antigua no sobrescribe una nueva. Guardar confirma únicamente después de persistir. El historial permite recuperar versiones. Cada formato tiene su propio libro: editar el mensual no modifica automáticamente el anual, ni viceversa.

La descarga del libro guardado conserva valores, fórmulas internas, notas, hojas, combinaciones, formato básico, dimensiones, cuadrícula e inmovilización. Los filtros se mantienen en la vista guardada; el Excel descargado incluye todas las filas. La vista de impresión es simplificada. Macros, gráficos, tablas dinámicas y objetos avanzados originales no se editan ni exportan. Las referencias externas se descargan como su último valor con una nota; no se contactan archivos externos. El original permanece dentro del respaldo de cada versión.

## Importación de acumulados

El usuario selecciona el Excel. La hoja ACUM X MES identifica empresa y ejercicio; se presenta un resumen antes de guardar. Se conservan periodos originales, sueldo del periodo y conceptos, sin convertirlos en salario diario. Filas sin importes o con todos los importes en cero se consideran plantilla. Los periodos imposibles se señalan y las hojas de otros ejercicios no se mezclan.

Ambos formatos incluyen Acumulado como primera hoja. El mensual separa meses; el anual separa trabajadores. En las hojas de detalle se conserva el orden de columnas del archivo de origen: nombre, periodo, IMSS, RFC, sueldo, prestaciones, total, subsidios, impuestos, descuentos y neto. Al abrir un libro generado con el orden anterior, el editor mueve sus columnas utilizando el motor de la hoja para conservar las referencias de las fórmulas. María guarda una nueva versión para conservar este ajuste; no hace falta volver a importar ni se reemplazan los cambios por los datos originales. La descarga desde Nómina avisa si todavía falta abrir y guardar esa actualización. Las fórmulas aritméticas locales y SUM se trasladan a las columnas nuevas; las referencias no trasladables conservan su valor y una nota.

El acumulado fiscal original es una fotografía editable del archivo, no una declaración calculada por la aplicación. ISR enterado y exentos requieren revisión del responsable. No se inventan pagos fiscales ni datos de trabajadores que el archivo no contiene.

Una importación posterior conserva periodos de la fuente anterior que no aparezcan en la nueva. Si ya existen libros, se advierte antes de regenerarlos: los ajustes manuales permanecen en las versiones anteriores. Mensual y anual se guardan por separado; si falla el segundo, el aviso indica cuál sí se guardó. La carga comprimida de cada versión se limita antes de escribir, para respetar el tamaño de documento de Firestore. No hay guardado silencioso fuera de línea.

## Permisos y despliegue

María administra las autorizaciones. Se conserva el permiso existente de captura y edición de Nómina de las tres empresas y se añade un permiso separado de consulta y exportación. Una cuenta de consulta no escribe nóminas, libros, permisos ni otras secciones. Baja, bloqueo o revocación impiden leer en Firebase.

La instalación puede usar VITE_NOMINA_CONSULTA_INICIAL para indicar una cuenta autorizada por María. La migración se ejecuta una sola vez, dentro de su sesión administrativa; revocar el permiso después no lo reactiva. El ID concreto se mantiene en la configuración local, fuera del repositorio.

La compilación principal genera los recursos estáticos del editor automáticamente. Publicar únicamente firestore:rules y hosting; no requiere activar Storage. El actualizador conserva la configuración local y comprueba el proyecto antes de publicar. Nunca publicar una compilación sin las variables de Firebase.

Las reglas nuevas son un prototipo que exige revisión antes de ampliar el acceso. Las pruebas usan exclusivamente archivos y cuentas ficticios: consulta autorizada y revocada, aislamiento de administración, historial inmutable, escritura incompleta, revisiones y esquemas inválidos, edición/reapertura/exportación y conflicto entre ventanas.

En Autorizaciones, Bitácoras y Secciones son desplegables independientes. Secciones permite Personal, Nómina, Mantenimiento y compras, y Reportes y CSV. Personal, mantenimiento y reportes son consultas de la empresa seleccionada; solo Nómina ofrece alcance de las tres empresas y nivel de captura opcional. Las demás acciones de administración continúan restringidas. Los reportes autorizados incluyen asistencia, incidencias y personal, con búsqueda y descarga CSV de las filas visibles.

## PDF incorporados después del Excel

Los registros PDF y los libros editables son fuentes distintas. El editor incorpora ahora los PDF pendientes de la misma empresa y ejercicio en ambos formatos. Inserta los periodos en la hoja del mes o del trabajador; conserva las demás celdas, fórmulas y ediciones. Nombre, salario del periodo, conceptos y neto vienen del recibo validado. Salario diario, días pagados, total de deducciones y conceptos adicionales aparecen después de las columnas originales. Si falta el NSS en un PDF guardado, solo se recupera de un registro del mismo trabajador cuando existe.

Cada libro conserva las firmas de los PDF que ya incorporó. Reabrir no duplica periodos. Un PDF corregido actualiza sus filas identificadas y retira solo sus trabajadores ausentes; los demás periodos se conservan. Si un recibo ya estaba en el Excel importado, se mantiene esa fila para respetar sus ajustes. Los dos formatos se guardan por separado y una descarga pendiente pide abrir y guardar el libro correspondiente. El guardado conserva el historial; no se regenera el libro desde cero.

El resumen actualiza conceptos identificables a partir del detalle cuando el valor anterior coincide con ese detalle o con una fórmula administrada por la integración. Conserva ajustes manuales distintos y no calcula exentos, subsidios fiscales ni ISR enterado. Una hoja con estructura personalizada no se interpreta automáticamente como tabla de nómina. Si la incorporación falla, el editor restaura su copia previa sin guardar cambios parciales.

### Presentación, reparación de Acumulado e identificación

Todas las hojas de detalle, procedan de Excel o PDF, utilizan el tema fijo de Acumulado: encabezados y totales azul marino con texto blanco, subtítulo dorado y filas alternadas en azul claro y blanco con texto oscuro. No se copian colores de hojas existentes, porque pueden contener estilos heredados del encabezado. Este ajuste también se aplica a libros ya guardados y a su descarga, sin alterar valores, fórmulas ni marcas de los recibos.

Al abrir se revisan los meses que tienen PDF aunque ya estén incorporados. Se completan los resúmenes vacíos o en cero desde el detalle, se enlazan los totales anuales que coinciden con los meses previos y se conservan ajustes manuales distintos. ISR retenido utiliza ISR más ISR a compensar, como el archivo de referencia; el número mensual de trabajadores cuenta personas distintas, no recibos. Subsidio causado/entregado, exentos e ISR enterado no se deducen de campos con otro significado.

El lector guarda el NSS del PDF como texto de once dígitos. Para registros importados con el lector anterior hay que seleccionar de nuevo los PDF originales en la carga normal: si son el mismo archivo, o sus importes coinciden, se completa únicamente el NSS ausente y se mantiene el periodo, su auditoría y sus correcciones. Al incorporar esa identificación al libro, no se reemplazan sus importes editados. Una corrección económica posterior deja de ser una actualización exclusiva de identificación.

La presentación fija utiliza Calibri de 11 puntos en datos y encabezados de tabla, títulos de 16 y subtítulos de 13. Mantiene azul marino, dorado, azul claro y blanco en editor, libros existentes, nuevas cargas y descargas. Las fuentes se normalizan sin modificar valores ni identificadores; títulos, nombres y totales se destacan en negrita. El resto de los datos usa texto normal. Se neutralizan colores heredados en filas, columnas y texto enriquecido. Los nombres ajustan sus líneas, con columna amplia y altura suficiente para mostrarse completos.
