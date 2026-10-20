# Avisos y bloqueo de acceso

**Modalidad elegida: sin plan de pago.** Para publicar en Firebase Spark, seguir [Acceso protegido sin plan de pago](acceso-gratuito.md). El servidor gratuito de Cloudflare sustituye a Cloud Functions. La sección Firebase de este documento describe la alternativa opcional con Cloud Functions; no activar Blaze para el despliegue elegido.

Cuatro contraseñas incorrectas consecutivas bloquean esa cuenta. Un ingreso correcto previo al cuarto fallo reinicia el contador. Los errores de conexión no suman intentos. No existe desbloqueo por tiempo ni al regresar a inicio: María debe habilitar la cuenta o restablecer su contraseña en Seguridad. Los demás trabajadores siguen ingresando en el mismo equipo.

El aviso dura diez segundos y limpia los campos al volver al inicio. Texto de bloqueo: «¡DEMASIADOS INTENTOS! Comunícate con el personal autorizado». Texto de permisos: «¡ACCESO DENEGADO! No tienes acceso a este módulo». Ambos usan capas ilustradas con robot que parpadea, camarones que nadan, burbujas, reflejos y candado con brillo. Por solicitud de María, las escenas comienzan animadas aunque Windows solicite movimiento reducido; no llevan botón de pausa y regresan al inicio a los diez segundos.

Un QR identifica el área y no concede autorización. Los QR de cuartos fríos requieren permiso de temperaturas de la empresa correspondiente. Los usuarios de captura no pueden abrir administración. La denegación no bloquea toda la cuenta. Las alertas registran la cuenta, sección, fecha y hora; son visibles únicamente para administración en Seguridad y en el contador del panel. «Marcar revisada» no desbloquea la cuenta: retira la alerta de pendientes y la conserva, con responsable y fecha de revisión, en «Registro de incidencias», debajo de Admin en Seguridad. Los registros ya revisados aparecen allí automáticamente. En «Acceso del trabajador» se elige primero una empresa; después solo sus empleados. Cambiar de empresa limpia la selección, la acción y ambas contraseñas.

## Firebase

`autenticarCuenta` verifica la contraseña con Firebase Authentication desde el servidor y contabiliza los fallos en una transacción de `controlAccesos/{idEmpleado}`. En el cuarto fallo guarda una alerta en `alertasSeguridad`, desactiva la ficha del trabajador y la cuenta de Auth, y revoca sesiones. Las reglas deniegan los datos de las cuentas bloqueadas incluso si quedara una sesión anterior. El navegador no puede editar contadores ni crear alertas de seguridad. `registrarAccesoDenegado` obtiene la identidad desde la sesión autenticada, comprueba los permisos y agrupa reintentos de la misma sección durante diez segundos.

Antes de desplegar se necesita la variable de servidor `FIREBASE_WEB_API_KEY` en `firebase/funciones/.env.rey-pez-admin-react`, con la API key web del mismo proyecto. No es la contraseña de ningún usuario. La configuración web de compilación sigue usando las variables `VITE_FIREBASE_*` existentes. No publicar una compilación local que carezca de esa configuración.

Con la sesión autorizada del proyecto, publicar las funciones, reglas e índices y después la aplicación:

```bash
npx -y firebase-tools@latest deploy --project rey-pez-admin-react --only functions,firestore,storage
npm run verificar
npx -y firebase-tools@latest deploy --project rey-pez-admin-react --only hosting
```

No se creó otra base ni se cambió su edición. En esta sesión la CLI no permitió consultar la edición ni desplegar porque no tiene cuentas autorizadas. El código usa la base `(default)` ya existente.

Si la única cuenta MARIA llega a bloquearse, una persona con acceso administrativo a la consola Firebase debe habilitarla en Authentication y poner `bloqueado: false` e `intentos: 0` en `controlAccesos/MARIA`. Esto no se ofrece desde una pantalla pública ni exige compartir contraseñas. Las cuentas de trabajadores se desbloquean desde Seguridad.

En modo local el bloqueo se guarda en el almacenamiento de ese navegador; la protección compartida entre dispositivos requiere desplegar las funciones y reglas de Firebase. No se han subido ni alterado empleados al incorporar este cambio.
