# Acceso protegido sin plan de pago

La aplicación y los datos permanecen en el proyecto Firebase Spark `rey-pez-admin-react`. Un Worker de Cloudflare Free verifica las contraseñas con Firebase Authentication, aplica el contador compartido y administra accesos. No requiere Cloud Functions, Blaze, una base D1 ni una suscripción de pago. No se activa facturación. Las cuotas gratuitas de ambos proveedores se siguen aplicando; si se agotan, el acceso falla de forma cerrada y no cambia automáticamente de plan.

## Preparación incluida

- `servidor-acceso/index.js`: inicio de sesión, gestión de contraseñas y terminales, y alertas por secciones sin permiso.
- `servidor-acceso/google.js`: autenticación de servicio, validación de tokens firmados y escrituras condicionales atómicas en Firestore. No guarda las contraseñas de los trabajadores.
- El bloqueo usa la lógica compartida de cuatro fallos. Se guarda en `controlAccesos/{idEmpleado}` y se aplica con reglas de Firestore y Storage, además del servidor. En esta modalidad el bloqueo automático no deshabilita Firebase Authentication: niega la entrada a Rey Pez y sus datos, hasta que María habilite la cuenta o restablezca la contraseña.
- El servidor emite la marca firmada `accesoControlado`; los trabajadores no pueden saltarse el control iniciando sesión directamente contra Firebase. Las reglas siguen comprobando la empresa, los permisos y el estado activo.
- Las alertas solo son visibles para administración. El navegador no puede crear alertas falsas de seguridad ni cambiar los contadores.
- Las animaciones y el regreso a inicio a los diez segundos se conservan.

## Autorizaciones pendientes antes de publicar

Se necesita una cuenta Cloudflare Free del usuario. El inicio de sesión o registro y la aceptación de los términos los completa el usuario mediante el acceso seguro. No usar una cuenta temporal para alojar credenciales de producción.

El Worker necesita una credencial técnica **dedicada** del proyecto Firebase, con los roles `roles/datastore.user` y `roles/firebaseauth.admin`. No asignar Editor ni Owner. La creación de esa credencial y su almacenamiento en Cloudflare requieren autorización explícita del usuario. No usar ni compartir la contraseña personal de Google. No poner claves privadas en GitHub, archivos de entrega, variables `VITE_*`, conversaciones o registros.

Guardar el JSON como secreto `FIREBASE_SERVICE_ACCOUNT` del Worker. Guardar también `FIREBASE_WEB_API_KEY` (API key web del mismo proyecto). `FIREBASE_PROJECT_ID`, `AUTH_EMAIL_DOMAIN` y los orígenes permitidos ya figuran en `servidor-acceso/wrangler.jsonc`.

Con las cuentas autorizadas, publicar en este orden:

```bash
npx -y wrangler@latest deploy --config servidor-acceso/wrangler.jsonc
```

Configurar los dos secretos desde Cloudflare o mediante el mecanismo seguro de secretos de Wrangler; nunca pegarlos en comandos que queden registrados. Comprobar que `/salud` responde `listo: true` y verificar permisos del servicio en un entorno de pruebas.

Copiar la URL HTTPS definitiva del Worker a `VITE_ACCESO_API_URL` en la configuración de compilación de la aplicación, junto a las variables `VITE_FIREBASE_*` existentes. La URL no contiene credenciales. Compilar y publicar las reglas y el sitio después de que el servidor esté operativo:

```bash
npm run verificar
npm run probar:reglas
npm run probar:navegador
npx -y firebase-tools@latest deploy --project rey-pez-admin-react --only "firestore:rules,hosting"
```

El 20/10/2026 se publicó el Worker `https://rey-pez-acceso.reypez-admin-oficina.workers.dev`, se conectaron sus secretos desde la computadora de María y se publicaron Hosting y reglas de Firestore. Storage no está configurado: no intentar inicializarlo ni activar facturación. La carga de fotos queda pendiente. `/salud` solo confirma presencia de configuración; se comprobó además un inicio real de MARIA y se observaron bloqueo y alertas con una cuenta de prueba.

Antes de compilar, comprobar que Vite lee las cuatro variables obligatorias: API key, project ID, app ID y URL del Worker. La existencia de `.env.local` no garantiza que sus valores se hayan cargado. Nunca publicar un compilado sin estas variables.

**No desplegar las reglas nuevas antes de configurar el Worker y la aplicación.** Los trabajadores con sesiones anteriores deben cerrar sesión e ingresar nuevamente para obtener la marca firmada. El despliegue no incorpora ni reemplaza el catálogo de empleados.

La única cuenta MARIA se recupera desde Firebase Console si se bloquea: habilitarla en Authentication, si corresponde, y establecer `controlAccesos/MARIA.bloqueado` en `false` e `intentos` en `0`. No se añade un desbloqueo público ni una clave maestra.

El modo local continúa disponible para pruebas; no sustituye al Worker en una instalación compartida. Cloud Functions queda como alternativa opcional para proyectos que decidan usar Blaze; el cliente usa el Worker cuando `VITE_ACCESO_API_URL` está configurada.

Documentación oficial utilizada: [Cloudflare Workers y Firestore](https://blog.cloudflare.com/api-at-the-edge-workers-and-firestore/), [secrets de Workers](https://developers.cloudflare.com/workers/configuration/secrets/), [API REST de Firestore](https://firebase.google.com/docs/firestore/use-rest-api), [tokens personalizados de Firebase](https://firebase.google.com/docs/auth/admin/create-custom-tokens) y [límites de Workers Free](https://developers.cloudflare.com/workers/platform/limits/).
