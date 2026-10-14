# Rey Pez · Control Administrativo

Aplicación en **React y JavaScript**, construida con Vite a partir del prototipo `Rey_Pez_Prototipo_v6_Doble_Asistencia_Azul_Dorado.html`. Conserva la distribución, la paleta azul/dorado y los módulos del original. Funciona en escritorio, tableta y móvil.

## Continuar el desarrollo

Abre **la carpeta completa** en tu editor. La guía [GUIA_DE_TRABAJO.md](GUIA_DE_TRABAJO.md) explica cómo trabajar y dónde encontrar cada módulo. Las decisiones de asistencia se registran en [documentacion/reglas-pendientes.md](documentacion/reglas-pendientes.md); la responsable de definirlas es la esposa de Allan.

La carpeta del escritorio `Rey-Pez-React` es la entrega para continuar el desarrollo. El servidor local se ejecuta desde esa carpeta. Si mantienes otra copia, evita editar ambas a la vez; los cambios nuevos no se sincronizan automáticamente entre carpetas.

## Ejecutar en local

El entorno de referencia es **Node.js 22, versión 22.13 o posterior dentro de esa rama**, y npm. `.nvmrc` permite seleccionarlo con `nvm use` si ya tienes nvm instalado. También se admite Node.js 24 o posterior según `package.json`.

```bash
npm ci
npm run iniciar
```

Abrir **http://127.0.0.1:5173**. Mantén la terminal abierta; `Ctrl+C` detiene el servidor. Si las dependencias ya están instaladas, solo necesitas `npm run iniciar`. También puedes abrir `Iniciar Rey Pez.command` desde Finder.

La carpeta entregada incluye las dependencias instaladas. El archivo `package-lock.json` permite reinstalar exactamente las mismas versiones en otra computadora.

Para revisar el resultado compilado:

```bash
npm run compilar
npm run previsualizar
```

## Probar la aplicación

1. En **Personal**, consulta los 30 empleados originales, filtra por empresa y agrega o modifica un empleado.
2. Abre **Asistencia 1 · Trabajador**, escribe `AL-01` y deja la contraseña vacía. Se muestra la bienvenida y se registra el movimiento correspondiente. La pantalla se reinicia a los cinco segundos.
3. En **Asistencia 2 · Administración**, consulta registros, captura una incidencia y revisa alertas.
4. En **Configuración**, crea o modifica horarios. No se permite eliminar horarios utilizados.
5. En **Reportes y CSV**, descarga personal, asistencia o un respaldo JSON.
6. Recarga la página: los cambios permanecen en el mismo navegador y dirección.

Los datos se guardan en `localStorage`, no en Firebase todavía. `localhost` y `127.0.0.1` tienen almacenamientos distintos, al igual que los distintos puertos y perfiles de navegador. Usa siempre la misma dirección para tus pruebas.

## Estructura

```text
codigo/
  aplicacion/       Aplicación, navegación y estado compartido
  componentes/     Formularios, tablas, mensajes y registro del trabajador
  paginas/         Inicio, personal, asistencia, bitácoras, reportes y configuración
  dominio/         Reglas de asistencia y operaciones del negocio
  repositorios/    Persistencia local y futura conexión con Firebase
  datos/           Empresas, horarios iniciales y empleados de demostración
  estilos/         Diseño, tipografía, colores y adaptación móvil
  utilidades/      Fechas, archivos CSV y descargas
publico/identidad/ Logo transparente compartido
datos-locales/     Catálogo original privado (excluido de Git)
pruebas/           Pruebas de lógica y recorridos de navegador
documentacion/     Arquitectura y decisiones de operación
compilado/         Resultado de la compilación (excluido de Git)
.github/workflows/ Verificación automática en GitHub
```

## Alcance conservado

- Alta, edición, búsqueda, filtros, baja e IDs permanentes de personal.
- Importación CSV por nombre y empresa; asignación de IDs faltantes.
- Horarios editables, vigencia y notas.
- Secuencia de entrada, comida, regreso y salida; marcaciones fuera de intervalo permitidas con alertas internas.
- Revisiones administrativas con responsable y motivo.
- Revisión de alertas; exportación de CSV y respaldo JSON con alertas incluidas.
- Seguridad como demostración: no guarda contraseñas ni cambia permisos.
- Bitácoras como estructura inicial, igual que en el prototipo.

La rotación semanal de Edgar, la aplicación automática de vigencias, turnos nocturnos, huella digital, autenticación real y sincronización siguen pendientes de definición e implementación. Las horas se interpretan en la zona horaria del navegador, como en el original.

## Correcciones durante la migración

- Se corrige la expresión regular que impedía interpretar las horas y la referencia a una función `close` que no estaba definida en el prototipo.
- Las revisiones administrativas ya no interrumpen la secuencia de marcaciones.
- Cambiar un ID actualiza las referencias de asistencia y alertas; cambiar un código de horario actualiza sus asignaciones.
- Se evita eliminar horarios que también están asignados implícitamente por empresa/puesto.
- Se validan duplicados en importaciones. Un archivo inválido no modifica parcialmente el catálogo.
- Se admiten CSV con BOM, comillas y saltos de línea. Se exportan todas las columnas, aunque aparezcan solo en registros posteriores.
- Los errores de persistencia se muestran sin confirmar falsamente un guardado.

## Calidad

```bash
npm run verificar          # Formato + ESLint + pruebas unitarias + compilación
npx playwright install chromium
npm run probar:navegador       # Recorridos reales en tamaños escritorio y móvil
npm run formatear        # Aplicar formato uniforme
npm run comprobar-formato  # Revisar formato sin modificar archivos
```

Las pruebas E2E usan perfiles de navegador independientes, sin modificar tus datos de prueba cotidianos.

## GitHub y datos originales

`datos-locales/empleados.json` conserva los 30 registros del HTML suministrado y está excluido por `.gitignore`. Vite lo sirve exclusivamente en desarrollo mediante `/__local/empleados`; nunca lo copia al directorio `compilado`. Si falta, se utilizan 30 empleados ficticios. Los datos ya guardados en el navegador tienen prioridad sobre el catálogo inicial.

También están excluidos `node_modules`, `compilado`, `.env`, resultados de pruebas y respaldos locales. No añadas registros laborales ni contraseñas al repositorio. No se ha creado ni publicado un repositorio remoto.

Para iniciar el repositorio desde la carpeta del escritorio cuando lo decidas:

```bash
git init
git add .
git status
# Revisa los archivos antes de crear tu primer commit.
git commit -m "Aplicación inicial Rey Pez en React"
```

## Próxima etapa: Firebase

Lee [documentacion/arquitectura.md](documentacion/arquitectura.md). La capa de repositorios concentra el acceso a los datos; los componentes no acceden directamente a `localStorage`. `.env.ejemplo` reserva los nombres de configuración, pero no conecta servicios ni simula una integración activa.

Referencias de herramientas: [React](https://react.dev/learn/creating-a-react-app) y [Vite](https://vite.dev/guide/).

## Nombres de archivos y comandos

Los archivos y carpetas propios utilizan nombres en español, sin acentos ni espacios (salvo el archivo de inicio para Finder). Los componentes utilizan `PascalCase` y las utilidades `camelCase`. Las configuraciones también tienen nombres en español y los comandos de npm indican a cada herramienta dónde encontrarlas.

Se conservan los nombres reconocidos automáticamente por npm, Git, Vite y el editor: `package.json`, `package-lock.json`, `index.html`, `jsconfig.json`, `.gitignore`, `.editorconfig`, `.prettierignore`, `.nvmrc` y los archivos obligatorios dentro de `.vscode` y `.github/workflows`. Las dependencias instaladas conservan sus nombres originales.

- `npm run iniciar`: abrir el servidor de desarrollo.
- `npm run compilar`: generar la carpeta `compilado`.
- `npm run previsualizar`: revisar la aplicación compilada.
- `npm run formatear`: aplicar formato uniforme.
- `npm run verificar`: comprobar formato, código, pruebas y compilación.
- `npm run probar:navegador`: comprobar escritorio y móvil en un servidor de pruebas separado, en el puerto 5174.
