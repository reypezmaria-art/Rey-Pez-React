# Nómina

María la usa desde administración. También puede autorizar a un trabajador, en Seguridad → Autorizaciones, para que vea, cargue y corrija la nómina de las tres empresas. La carga de un PDF identifica empresa y período sin selectores. Acepta reportes con texto seleccionable del formato de Lista de Raya de CONTPAQi mostrado por María; admite las tres empresas y alias de razón social del directorio. Los PDFs escaneados, protegidos, de otra estructura o que no concilien no se guardan. No hay OCR ni un servicio externo de pago.

## Subir una carpeta

Seleccionar carpeta de nóminas permite elegir una carpeta local con sus subcarpetas. Se procesan únicamente los PDF, hasta 100 y 200 MB en total por selección. Cada archivo identifica su empresa y período de manera independiente; pueden mezclarse las tres empresas y distintos meses/años. Se conserva el nombre del PDF, no la ruta local de la carpeta.

Los archivos se leen y guardan uno a uno. El resultado informa Guardado, Ya cargado o No guardado, con su motivo; los archivos no PDF se omiten sin leerlos. Un PDF ilegible o un fallo de guardado no impide procesar los demás. Los períodos existentes con datos diferentes se conservan y requieren Volver a subir archivo en Modificar un mes. Se puede repetir la carpeta tras un corte: las nóminas idénticas ya guardadas no se duplican. La carpeta no se sube como ZIP ni se almacena su contenido binario.

## Importar y corregir

- Se extraen nombre, identificador de nómina, salario diario, días pagados, percepciones y deducciones con código, concepto, valor e importe, y los tres totales del recibo. El RFC, cuando aparece, se usa como identidad privada estable para agrupar al trabajador, sin publicarlo en el directorio operativo.
- Se comprueban todos los recibos, sus conceptos y totales antes de persistir el período. Un error conserva la nómina anterior completa. Se requiere un solo período dentro de un mes por archivo; un documento que cruza meses o contiene empresas/períodos mezclados se rechaza.
- En este formato, los códigos 32 y 41 son informativos cuando existe el ISR 45; se conservan con esa marca. El código 179 se marca informativo solo si coincide con un préstamo Infonavit ya incluido. Los descuentos aplicados deben sumar exactamente el Total Deducciones impreso. No se calculan impuestos ni se inventan importes.
- La clave de cada período combina empresa, fecha inicial y final. Repetir el mismo archivo o sus mismos datos no duplica la carga. Un período diferente se acumula. Si se intenta cargar otro contenido sobre un período existente desde la carga inicial, se indica usar la corrección.
- Modificar un mes ofrece edición manual o Volver a subir archivo. En la segunda opción solo se selecciona el PDF: identifica empresa y fechas, localiza el período cargado y lo sustituye automáticamente, sin confirmaciones ni selectores. No permite agregar un período inexistente por esa vía ni cruzarse con otra nómina. Se conservan las otras quincenas, meses y empresas.
- La edición manual selecciona período y trabajador, conserva conceptos e identidad y exige motivo. Los totales se recalculan a partir de los importes aplicados. Las correcciones guardan el período anterior en auditoría, con fecha, revisión y responsable.
- Archivos cargados comienza cerrado y se despliega con una flecha. Permite abrir el resumen por trabajador y su desglose de conceptos.

## Excel

Solo dos exportaciones, ambas piden empresa y año:

1. Generar mensual: un archivo acumulado, una hoja por mes cargado, de enero a diciembre en orden. Dentro de cada mes se separan los trabajadores y sus períodos. No crea meses sin carga.
2. Generar anual: una hoja por trabajador, con todas sus quincenas cargadas del año ordenadas y sus totales. No mezcla empresas.

Incluyen salario diario, días, cada concepto de percepción y deducción, informativos identificados y los totales/neto. Los acumulados incluyen fórmulas con resultados guardados. El salario diario no se suma. Se conservan importes negativos de ajustes y subsidios. Los nombres de hojas se adaptan al límite de 31 caracteres y evitan colisiones.

## Persistencia y privacidad

Se utiliza la base existente `(default)` del proyecto `rey-pez-admin-react`, sin crear otra base ni cambiar el plan. Colección `nominas`, un documento por período. `registrosJson` es un contenido de intercambio serializado de hasta 240000 bytes; los validadores del cliente comprueban cada recibo al escribir y leer. Las reglas validan los metadatos, los tamaños y el acceso, no interpretan ese JSON. Nadie puede borrar un período.

## Quién puede entrar

María siempre. Un trabajador solo si su ficha en `operacion/config` tiene `permissions[idEmpleado].nomina` en `true`. Esa configuración la escribe únicamente María; el trabajador puede leerla, como ya leía sus bitácoras, pero no modificarla.

Con el permiso, en la captura aparece el botón **Nómina**, además de sus bitácoras. Abre la misma sección: ver, cargar y corregir períodos de Allan, Edgar y Estuardo. No ve Personal, Asistencia administrativa, Reportes, Configuración, Seguridad, Mantenimiento ni el resto del panel. Sin el permiso, el botón no aparece y la ruta `#nomina` sigue denegada: el trabajador queda como hoy, solo con sus bitácoras.

`actualizadoPor` y la auditoría guardan quién escribió: `MARIA`, o el ID del trabajador. La revisión y las fechas de creación siguen protegidas; una corrección exige la revisión siguiente. Las reglas rechazan a un trabajador sin el permiso, el borrado de cualquiera y el acceso de ese trabajador a empresas, horarios, mantenimiento, revisiones, respaldos, alertas de seguridad y empleados de otra empresa. Los nombres de empresa que usa la página salen del directorio que ya está en `operacion/config` y de los tres nombres fijos; no se abre la colección `empresas` ni el catálogo completo de personal. Los recibos viajan dentro de la propia nómina.

## Activar a Claudia

1. Entra María y abre Seguridad → Autorizaciones.
2. Empresa autorizada: la de Claudia, ESTUARDO.
3. Usuario activo: Claudia.
4. Marca **Nómina de las tres empresas**. Las bitácoras se eligen aparte y siguen limitadas a Estuardo.
5. Guardar permisos.
6. Claudia entra en captura, pulsa Nómina y trabaja Allan, Edgar y Estuardo. El resto de la administración no se abre.

El PDF se lee localmente y no se envía a ningún servicio de extracción. Se guardan sus datos, nombre y huella SHA-256, no el PDF binario. No requiere Firebase Storage, Functions, Blaze ni facturación. Los datos están incluidos en los respaldos completos ya existentes y en su restauración local. No se añaden empleados ni se modifican sus accesos desde este módulo.

## Verificación y publicación

Las pruebas usan únicamente nombres e importes ficticios: lectura de PDF real generado en pruebas, tres empresas, conciliación de conceptos informativos, duplicados, reemplazos, conservación de otros períodos, correcciones manuales, persistencia, permisos y XLSX reabierto para verificar hojas y fórmulas. El PDF real adjunto se coteja fuera del repositorio; no se publica información de nómina.

Ejecutar formato, verificación, navegador y emulador como indica la guía de trabajo. Para que Claudia pueda usar Nómina hay que publicar **Hosting y las reglas de Firestore** (`hosting` y `firestore:rules`). Si solo se publica Hosting, Firestore rechazará sus lecturas y escrituras hasta publicar las reglas. No hace falta Storage ni Functions para este permiso. El aviso de acceso denegado del servidor de acceso también reconoce la sección cuando ese servicio se vuelve a publicar; el permiso efectivo lo imponen las reglas.

Para Windows, `herramientas/actualizarNomina.ps1` recibe el SHA completo de una versión revisada y la carpeta existente. Descarga esa versión, conserva copia del código anterior fuera del proyecto, mantiene `.env.local` y los datos privados, instala dependencias, valida configuración y pruebas, y publica solo `firestore:rules,hosting`. No despliega Storage ni Functions. Requiere la sesión de Firebase CLI de la computadora de publicación.
