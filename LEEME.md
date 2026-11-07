# Rey Pez — Control Administrativo

Rey Pez es la aplicación web que usa María para administrar tres empresas: Allan, Edgar y Estuardo Reyes. Es una sola aplicación en React y JavaScript, en la rama principal (`main`) del repositorio `reypezmaria-art/Rey-Pez-React`.

App publicada: https://rey-pez-admin-react.web.app/
Proyecto Firebase: `rey-pez-admin-react`
Servidor de acceso: https://rey-pez-acceso.reypez-admin-oficina.workers.dev

Todo cambio se hace desde `main`, para que se aplique a todos los usuarios. No hay otra rama activa para cambios.

## Qué incluye

Panel, personal y expediente, vacaciones, asistencia de trabajadores y de administración, nómina, bitácoras de salud y EPP, normas de la Secretaría del Trabajo, mantenimiento, reportes, configuración, seguridad y administración de empresas.

- **Personal:** fichas, empresa, puesto, horario, estado e historial. Las bajas conservan el historial.
- **Vacaciones:** se busca a la persona por nombre o ID y se capturan la fecha de salida y la fecha de regreso a trabajar. El regreso no se cuenta como vacaciones.
- **Asistencia:** se llama «Asistencia - Trabajador» y «Asistencia - Administración». El flujo es entrada, salida a comer, regreso de comer y salida final, con 10 minutos de tolerancia. La revisión de incidencias es administrativa.
- **Nómina:** importa PDFs de Lista de Raya de CONTPAQi, verifica empresa, período y conciliación antes de guardar, y no inventa importes ni impuestos. No se puede borrar un período.
- **Bitácoras y mantenimiento:** salud, EPP, temperaturas y cuartos fríos, con adjuntos opcionales de hasta 1 MB.
- **Seguridad:** María asigna contraseñas y permisos. Solo María administra accesos.

## Zona horaria

La zona horaria de Rey Pez es **México, `America/Mexico_City`**. Las fechas y los marcajes se interpretan en esa zona. No es Guatemala.

Pendiente en el código: en `codigo/repositorios/estadoFirebase.js` todavía hay funciones con el nombre Guatemala (`DESFASE_GUATEMALA_MS`, `diaGuatemala`, `fechaLocalGuatemala`) para fechar los marcajes de asistencia. Hoy calculan un desfase de 6 horas, igual que México en noviembre de 2026, así que la hora coincide, pero el nombre está mal y hay que cambiarlo en el código. La regla es México, no Guatemala.

## Vacaciones con saldo excedido

Cuando un período supera el saldo calculado, **no se rechaza automáticamente**. Son vacaciones atrasadas de años atrás: se guarda pidiendo un motivo y queda registrado como incidente, con auditoría.

Esto no confirma por sí solo un derecho a saldo acumulado. Cada caso se revisa con María.

El saldo se calcula con el aniversario que corresponde a la fecha de salida y con los períodos ya registrados. No se inventa saldo histórico ni se descuentan dos veces días ya capturados. Se excluyen domingos y festivos de México. La jornada es de lunes a sábado.

## Cómo se publica

Desde la computadora de María, con la carpeta en `main` y limpia, y con la sesión de Firebase CLI en el proyecto `rey-pez-admin-react`.

```bash
npm ci
npm run iniciar
```

Para revisar antes de publicar:

```bash
npm run verificar
npm run probar:navegador
```

Para publicar, primero el Worker solo si cambió su código, y después las reglas y el sitio:

```bash
npx -y wrangler@4 deploy --config servidor-acceso/wrangler.jsonc
npm run verificar
npx -y firebase-tools@latest deploy --project rey-pez-admin-react --only "firestore:rules,hosting"
```

Espera a ver `Deploy complete!` y actualiza la página con Ctrl+F5.

## Qué se necesita

Node.js 22.13 o superior, y un archivo `.env.local` en la computadora de publicación con estas variables, sin publicar sus valores:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ACCESO_API_URL`

Sin esas variables, la aplicación guarda solo en el navegador. Nunca pongas una cuenta de servicio ni una clave privada en variables `VITE_*`, en GitHub ni en el chat.

El acceso usa Firebase Authentication, con cuentas internas del tipo `{id}@acceso.reypez.app`. La primera cuenta es la de María. Las contraseñas, nóminas, RFC y datos de empleados son privados y no van a GitHub.

## Qué NO está activo

- **Blaze y facturación:** no activar por iniciativa propia. El proyecto está en el plan Spark.
- **Cloud Functions:** el código existe en `firebase/funciones` (`gestionarAcceso`, `autenticarCuenta`, `registrarAccesoDenegado`), pero hay **0 funciones desplegadas**. El acceso real pasa por el Worker de Cloudflare, no por Functions.
- **Storage:** no verificado en el proyecto. El código sí usa Storage — `codigo/firebase/sesion.js` inicia `getStorage`, y `codigo/repositorios/repositorioFirebase.js` sube adjuntos con `uploadString` y los lee con `getDownloadURL`, en las rutas `evidencias/bitacoras/...` y `evidencias/mantenimiento/...` — y las reglas existen en `firebase/storage.rules`, declaradas en `firebase.json`. Pero no hay evidencia en el código de que esas reglas se hayan desplegado en el proyecto, y el comando de publicación de arriba no incluye `storage:rules`. Tampoco se ha comprobado en la consola que el bucket esté creado. Hasta comprobarlo con una prueba real, no des por hecho que subir fotos funciona, ni que Storage no existe. La carga de fotografías queda pendiente de verificar.

## Cómo comprobar la versión publicada

Hoy la app publicada **no muestra versión ni commit**, así que no se puede saber desde la app si lo publicado es el último commit de `main` o una versión anterior. Para comprobarlo, revisa el historial de despliegues en Firebase Console, en Hosting, no solo el código en GitHub.

Última revisión de este LEEME: 7 de noviembre de 2026, con `main` en `7d4aa22a2ff0a76a9e773b45150afc590f7d2a66` (6 de noviembre de 2026).
