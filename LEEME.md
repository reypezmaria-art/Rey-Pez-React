# Sistema de Control Administrativo Rey Pez

Base única React y JavaScript para revisar la planificación de María. La revisión se integró en `main` por autorización de María el 14/10/2026. El trabajo continúa en la rama principal.

## Abrir en Windows

La copia local entregada incluye `Rey_Pez_Revision.html`: ábrelo en Chrome con doble clic. En el primer inicio crea la contraseña de María (mínimo 6 caracteres) (ID `MARIA`). Es una copia de revisión con datos guardados en ese navegador.

Para trabajar con el código, extrae el ZIP completo, instala Node.js 22.13+ o 24+ y abre `Iniciar_Windows.bat`, o ejecuta:

```bash
npm ci
npm run iniciar
```

Abre `http://127.0.0.1:5173` y conserva la terminal abierta. Usa siempre la misma dirección: puertos y perfiles distintos tienen datos independientes.

## Personal real

La copia privada incluye `datos-locales/empleados.json`, recuperado del CSV corregido de 30 empleados. Este archivo está excluido de GitHub. La app carga el catálogo en desarrollo y la vista HTML lo incorpora de manera local. Se sustituyen registros de demostración y se agregan IDs faltantes conservando empleados ya editados e historial. María Guadalupe conserva fecha de ingreso 01/10/2026.

Un clon público sin el archivo privado usa datos ficticios. No publiques empleados, expedientes, contraseñas, respaldos ni el HTML privado en el repositorio.

## Revisar los cambios

- Personal: agregar, modificar, dar de baja, identificación, contacto, funciones e importación CSV opcional.
- Seguridad: asigna la contraseña de cada trabajador antes de registrar; autoriza su empresa y bitácoras. Brenda se limita a Estuardo; selecciona explícitamente qué puede capturar.
- Asistencia: un botón Registrar; cuatro movimientos, 10 minutos de tolerancia, comida desde salida real, rotación semanal de Edgar y excepción fija de Pedro. Las alertas se muestran solo en administración.
- Asistencia 2: revisar ausencias y registrar emergencias o correcciones con responsable y motivo, conservando registros originales.
- Bitácoras de salud: formularios generales, No aplica con motivo, adjuntos opcionales hasta 1 MB y programación editable. Para cerrar un aviso selecciona la revisión programada correspondiente.
- Bitácora de EPP: apartados de proceso/carga y descarga, oficina, barcos de Edgar y revisión de equipo en cuartos fríos donde corresponda.
- Normas de la Secretaría del Trabajo: carpetas separadas por empresa, vacías hasta definir documentos.
- Mantenimiento: reparaciones, piezas, equipo, proveedor, costo y comprobantes.
- Configuración: horarios, excepciones, festivos/cierres, áreas, cuartos, programación, vinculación del navegador y QR por área.
- Reportes: filtros por empresa/fechas, CSV, respaldo completo y restauración. Se conservan hasta siete respaldos diarios locales antes de cambios.

Para una terminal dedicada, vincula ese navegador en Configuración y abre `#asistencia`. La pantalla no muestra administración ni incidencias. La ruta `#captura?area=...` identifica el área y exige ID, contraseña y permisos. El QR abre esta ruta; un archivo local o localhost no es una dirección compartida con teléfonos.

## Alcance local

Sin `.env`, la aplicación guarda en el navegador después de cargar. Contraseñas derivadas con PBKDF2, sal y bloqueo protegen ese flujo. No hay integración de huella. No se presenta esta copia como un sistema listo para operación laboral oficial. Los formatos especializados deben cotejarse con los originales.

## Firebase

Con un proyecto en plan Blaze y `.env` completo, el personal, la asistencia y las bitácoras se guardan en Cloud Firestore y los adjuntos en Cloud Storage. Los pasos:

1. En la consola de Firebase crea el proyecto, una app web, Authentication con correo y contraseña, Firestore y Storage.
2. Copia `.env.ejemplo` a `.env` y pega la configuración web. No pongas la cuenta de servicio en variables `VITE_`.
3. Instala la CLI (`npm install -g firebase-tools`), entra con `firebase login` y elige el proyecto con `firebase use --add`.
4. En `firebase/funciones` ejecuta `npm install`. Luego, desde la raíz, `firebase deploy --only firestore:rules,storage,functions`.
5. `npm run iniciar`, abre `http://127.0.0.1:5173` y crea la contraseña de María. Esa primera cuenta queda como administración.
6. Si este navegador ya tenía `reypez_react_v1`, el catálogo se copia una vez. No se migran las contraseñas locales: vuelve a asignarlas en Seguridad. Los empleados de demostración no se suben.

El correo interno es `{id}@acceso.reypez.app`. Si cambias `VITE_AUTH_EMAIL_DOMAIN`, define el mismo valor en `AUTH_EMAIL_DOMAIN` antes de desplegar la función. Crea la contraseña de María enseguida: una cuenta suelta no puede leer el personal.

Los acuerdos y pendientes concretos están en `documentacion/reglas-pendientes.md`. No se inventaron empleados, cuartos de Edgar, sanciones ni descuentos.

## Verificar

```bash
npm run verificar
npx playwright install chromium
npm run probar:navegador
```

Las pruebas usan perfiles separados. En entornos con navegador preinstalado se puede especificar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Las dependencias, compilados, evidencias de prueba y catálogos privados quedan fuera de Git.

## Generar la vista privada

Después de compilar, ejecuta:

```bash
npm run vista-local
```

El resultado se escribe en `entrega-local/`, excluido de Git. Incluye el catálogo privado si está disponible y los dos logos; conserva la misma clave de almacenamiento de la aplicación.
