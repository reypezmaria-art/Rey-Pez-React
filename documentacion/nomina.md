# Nómina

Disponible únicamente en administración, para María. La carga de un PDF identifica empresa y período sin selectores. Acepta reportes con texto seleccionable del formato de Lista de Raya de CONTPAQi mostrado por María; admite las tres empresas y alias de razón social del directorio. Los PDFs escaneados, protegidos, de otra estructura o que no concilien no se guardan. No hay OCR ni un servicio externo de pago.

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

Se utiliza la base existente `(default)` del proyecto `rey-pez-admin-react`, sin crear otra base ni cambiar el plan. Colección administrativa `nominas`, un documento por período. `registrosJson` es un contenido de intercambio serializado de hasta 240000 bytes; los validadores del cliente comprueban cada recibo al escribir y leer. Las reglas validan los metadatos, los tamaños y el acceso, no interpretan ese JSON. Trabajadores, terminales y visitantes no pueden consultar ni escribir esta colección.

Las reglas de Nómina son un prototipo con acceso exclusivo al UID administrativo ya sellado. La revisión y fechas de creación son protegidas; la actualización exige la siguiente revisión para rechazar clientes desactualizados. Su alcance se verifica en el emulador y debe revisarse antes de ampliar el acceso a otras personas.

El PDF se lee localmente y no se envía a ningún servicio de extracción. Se guardan sus datos, nombre y huella SHA-256, no el PDF binario. No requiere Firebase Storage, Functions, Blaze ni facturación. Los datos están incluidos en los respaldos completos ya existentes y en su restauración local. No se añaden empleados ni se modifican sus accesos desde este módulo.

## Verificación y publicación

Las pruebas usan únicamente nombres e importes ficticios: lectura de PDF real generado en pruebas, tres empresas, conciliación de conceptos informativos, duplicados, reemplazos, conservación de otros períodos, correcciones manuales, persistencia, permisos y XLSX reabierto para verificar hojas y fórmulas. El PDF real adjunto se coteja fuera del repositorio; no se publica información de nómina.

Ejecutar formato, verificación, navegador y emulador como indica la guía de trabajo. Publicar tanto las reglas de Firestore como Hosting. Si solo se publica Hosting, Firestore rechazará las lecturas de Nómina hasta publicar las reglas.

Para Windows, `herramientas/actualizarNomina.ps1` recibe el SHA completo de una versión revisada y la carpeta existente. Descarga esa versión, conserva copia del código anterior fuera del proyecto, mantiene `.env.local` y los datos privados, instala dependencias, valida configuración y pruebas, y publica solo `firestore:rules,hosting`. No despliega Storage ni Functions. Requiere la sesión de Firebase CLI de la computadora de publicación.
