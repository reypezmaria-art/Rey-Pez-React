# Conectar Firebase

La aplicación sigue guardando en este navegador si las variables
`VITE_FIREBASE_*` están vacías. Cuando el archivo `.env` está completo, el mismo
repositorio pasa a Firestore y el acceso pasa a Firebase Authentication con
correo y contraseña. No hace falta crear el proyecto para seguir probando en
local.

## 1. Crear el proyecto

1. Entra a [Firebase console](https://console.firebase.google.com/) y crea un
   proyecto. Puede llamarse `rey-pez`.
2. Agrega una aplicación web. Copia la configuración `firebaseConfig`.
3. Activa **Authentication → Correo electrónico/contraseña**. No actives el
   enlace por correo ni exijas verificación: los identificadores de la app se
   convierten en correos sintéticos `{id}@usuarios.reypez.local` (o el dominio
   de `VITE_FIREBASE_AUTH_EMAIL_DOMAIN`). No son buzones.
4. Crea **Cloud Firestore** en modo de producción.
5. Crea **Storage**.
6. En Authentication → Settings → Authorized domains, agrega el dominio desde
   el que abrirás la app (localhost ya suele estar).

## 2. Variables

Copia `.env.ejemplo` a `.env` y pega los valores de la app web. No pongas ahí
la cuenta de servicio ni ninguna clave privada: todo lo que empieza por
`VITE_` viaja en el JavaScript del navegador. La clave de la app web es
pública; la protección está en `firestore.rules` y `storage.rules`.

Si falta una sola variable, la app no mezcla los dos modos: muestra el nombre
de la variable que falta.

Reinicia `npm run iniciar` después de editar `.env`.

## 3. Publicar reglas e índices

Instala la herramienta una vez y, desde esta carpeta:

```bash
npx -y firebase-tools@13 login
npx -y firebase-tools@13 use --add
npx -y firebase-tools@13 deploy --only firestore,storage
```

`firebase.json` apunta a `firestore.rules`, `firestore.indexes.json` y
`storage.rules`.

## 4. Primer encendido

Hazlo en la **PC de la oficina**, que es donde ya están los datos.

1. Abre la app con el `.env` completo.
2. Crea la contraseña de María. Ese paso crea la cuenta `maria@…` y, si este
   navegador tenía datos, los sube una sola vez.
3. Las contraseñas anteriores no se pueden convertir: eran un hash PBKDF2. En
   Seguridad vuelve a asignar la de cada trabajador. Los permisos de empresa y
   bitácora sí se conservan.
4. Después abre la misma dirección en el teléfono e ingresa con el ID y la
   contraseña nueva.

Si el teléfono se configuró primero y solo cargó la semilla de demostración,
la PC todavía puede reemplazarla mientras en la nube no haya asistencia,
bitácoras ni mantenimiento. También está el botón **Subir datos de este
navegador** en Configuración. Si ambos lados ya tienen operación, no se
sobrescribe nada: descarga un respaldo JSON y decide con calma.

La marca local `reypez_firebase_migracion_v1` evita repetir la subida.

## 5. Reglas de acceso

| Quién                | Qué puede                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| María (`rol: admin`) | Leer y escribir toda la operación, las cuentas y las reglas de permisos. Su `uid` tiene que coincidir con `indiceCuentas/MARIA`           |
| Trabajador           | Leer su empresa y crear bitácoras solo de los tipos autorizados; crear su propia asistencia en el paso que sigue del turno                |
| Terminal vinculada   | Leer catálogo, horarios y asistencia; crear marcajes y alertas. No lee bitácoras, mantenimiento, auditoría, cuentas ni fotos de evidencia |

El permiso vive en `cuentas/{uid}` (`empresa`, `bitacoras`, `activo`). La
interfaz sigue comprobando antes de guardar; si alguien modifica el JavaScript,
Firestore rechaza el documento. Bloquear en Seguridad pone `activo: false` y
las reglas niegan la siguiente lectura o escritura.

La primera cuenta de María y `indiceCuentas/MARIA` se crean en el **mismo lote**.
Hasta ese momento nadie puede darse de alta como admin: hace falta el correo
`maria@…` y que el índice no exista. Una cuenta suelta, sin ese índice, no
administra. Un usuario autenticado con otro correo tampoco puede escribir
`cuentas/{su uid}` como admin.

Los marcajes de trabajador y terminal tienen que seguir la secuencia del día:
entrada, salida a comer, regreso y salida. Después de la entrada también se
acepta la salida final, porque las reglas no recalculan el horario rotativo:
el atajo de la última hora del turno sigue decidiéndolo la pantalla. La fecha
del marcaje tiene que caer en las últimas 20 horas (y no más de 15 minutos en
el futuro), para que un registro sin red siga subiendo y no se pueda fechar un
día viejo. Una corrección anterior la hace María; la revisión administrativa
no la puede crear el trabajador ni la terminal. El cursor
`secuenciaAsistencia/{id}` se actualiza en el mismo lote que el marcaje.

Un trabajador solo ve en memoria la empresa y las bitácoras que las reglas le
dejan consultar. Por eso una captura hecha en otro equipo no se borra al
guardar desde un perfil limitado: el cliente no elimina documentos que nunca
cargó.

## 6. Contraseñas

La primera asignación se hace desde el navegador de María con una segunda
instancia de Auth, sin cerrar su sesión. Cambiar la contraseña de alguien que
ya tiene cuenta exige el Admin SDK. El archivo `funciones/index.js` expone
`restablecerContrasena`.

```bash
cd funciones
npm init -y
npm install firebase-admin firebase-functions
cd ..
npx -y firebase-tools@13 deploy --only functions
```

Copia la URL HTTPS de la función en `VITE_FIREBASE_FUNCION_CONTRASENA`. Sin
esa variable, la app avisa el límite y no finge haber cambiado la contraseña.
María sí puede cambiar la suya desde Seguridad, porque es la sesión activa.

La función responde 401 solo si falta el token o no es válido, 403 si no es
María, 400 si la contraseña no cumple, 404 si el trabajador no tiene cuenta y
500 si Firestore o el Admin SDK fallan. Un fallo interno no se disfraza de
sesión inválida.

El plan Blaze es necesario para desplegar Cloud Functions. Hasta entonces se
puede restablecer la contraseña del usuario en Authentication → Users, buscando
el correo `al-01@usuarios.reypez.local`.

## 7. Terminal de asistencia

En la tableta, entra María a Configuración y pulsa **Vincular este navegador**.
Eso crea una cuenta `terminal-…` e inicia su sesión en ese navegador. La
contraseña no se guarda: Firebase Auth conserva el refresh token en su almacén
(IndexedDB), igual que la sesión de María. En `localStorage` solo queda el
correo y el uid, para saber qué equipo está vinculado. Al abrir `#asistencia`,
la tableta reutiliza esa sesión. Desvincular pone `activo: false` y cierra la
sesión de la terminal.

Si se borran los datos del sitio, hay que vincular otra vez. Como la contraseña
ya no está en el navegador, ese segundo vínculo rota la clave con la función
`restablecerContrasena` (o, si no está desplegada, desde Authentication →
Users). La primera vinculación no necesita la función.

La terminal ve el catálogo porque tiene que reconocer cualquier ID. No puede
leer bitácoras, comprobantes ni las fotos de evidencia de ninguna empresa.

## 8. Fotos y el límite de 1 MB

Un documento de Firestore no puede pasar de 1 MB **entero**. Una foto que la
app aceptaba a 1 MB crece a ~1,3 MB en base64 y además comparte el documento
con la bitácora, así que no cabe. Por eso el archivo va a **Cloud Storage** en
`evidencias/{empresa}/{id}/{archivo}` y el documento solo guarda nombre, tipo
y ruta.

Antes de subir, las fotos se reducen a un lado máximo de 1600 px y a JPEG.
Eso baja una foto de teléfono a unos pocos cientos de KB, que es lo que aguanta
la red de planta. Los PDF no se recomprimen y siguen limitados a 1 MB. Storage
rechaza archivos de más de 2 MB.

La descarga usa el SDK (`getBlob`), así que las reglas de Storage se aplican.
No se guarda una URL pública permanente. Si no hay red, la foto recién elegida
queda en este navegador y se reintenta; el registro de la bitácora sí entra a
la cola de Firestore.

## 9. Sin conexión

Firestore usa caché persistente en el navegador, incluida la coordinación entre
pestañas. Los guardados viajan en lotes y se reintentan al volver la red. No
se usan transacciones porque `runTransaction` falla sin conexión: si dos
personas editan el mismo documento a la vez, queda la última escritura. Los
altos diarios de Reportes siguen siendo copias de este navegador, además del
JSON descargado.

## 10. Teléfonos

Hace falta una dirección HTTPS, no un archivo local.

```bash
npm run compilar
npx -y firebase-tools@13 deploy --only hosting
```

El hosting publica la carpeta `compilado`. Agrega ese dominio a los dominios
autorizados de Authentication.

## 11. Emulador

Las pruebas automáticas usan un cliente en memoria y no levantan Java. Para
probar contra los emuladores:

```bash
npx -y firebase-tools@13 emulators:start --only auth,firestore,storage
```

En `.env`:

```bash
VITE_FIREBASE_EMULADOR=true
```

Las demás variables pueden ser valores de prueba si apuntan al emulador. No
dejes `VITE_FIREBASE_EMULADOR` activo contra el proyecto real.

## Decisiones y límites

- La sesión de Firebase permanece al recargar y se borra con **Cerrar sesión**.
  En el modo local, recargar sigue pidiendo la contraseña. La terminal usa otra
  sesión persistida, sin copiar su contraseña a `localStorage`.
- El alta de María es un solo lote (cuenta + índice). Las reglas exigen que el
  correo sea `maria@…` y que el índice apunte a ese uid. Así un usuario cualquiera
  no puede nombrarse admin mientras el índice no exista.
- La secuencia de cuatro marcajes se exige en `firestore.rules`. El horario
  rotativo y la ventana de la última hora no caben en las reglas sin duplicar
  el cálculo de turnos: por eso, tras la entrada, la salida final también está
  permitida. La pantalla sigue proponiendo el paso que toca según el horario.
- No hay custom claims: harían falta el Admin SDK en cada alta. Las reglas
  leen `cuentas/{uid}`. Un usuario creado a mano, sin ese documento, no lee
  datos.
- Cualquiera con la clave web puede intentar `createUser`. Sin documento
  `cuentas` no entra a la operación. Conviene activar App Check antes de
  exponer el hosting.
- La función de contraseñas es el único componente con privilegio de
  administrador. El resto corre en el navegador.
- La huella digital sigue fuera de alcance.
