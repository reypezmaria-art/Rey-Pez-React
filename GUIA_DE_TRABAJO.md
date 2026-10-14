# Guía de trabajo · Rey Pez

Esta aplicación es la base técnica para continuar el prototipo HTML en React y JavaScript. La esposa de Allan define la lógica y las reglas de la operación. El código actual contiene el comportamiento migrado y las correcciones ya descritas en LEEME.md; las pruebas de ese comportamiento no implican que las reglas estén aprobadas para uso real.

## Abrir el proyecto

Trabaja desde **una sola carpeta**: la entrega del escritorio `Rey-Pez-React`. Ábrela completa en el editor para que detecte las configuraciones y las importaciones. Si utilizas Visual Studio Code, `.vscode/extensions.json` recomienda ESLint y Prettier, y `.vscode/settings.json` activa el formato al guardar cuando están instalados. No son requisitos para ejecutar la aplicación.

Usa Node.js 22.13 o posterior dentro de la rama 22. Si ya tienes nvm:

```bash
nvm use
```

En una computadora nueva o después de cambiar dependencias:

```bash
npm ci
```

Para iniciar:

```bash
npm run iniciar
```

Abre `http://127.0.0.1:5173`. Guarda un archivo y Vite actualizará la pantalla. Si el puerto está ocupado por la misma app, utiliza el servidor que ya está abierto. Si necesitas reiniciarlo, detén ese servidor con `Ctrl+C` en su terminal antes de iniciar otro. No cambies de puerto sin considerar que cambia también el almacenamiento del navegador.

## Dónde hacer cada cambio

| Necesidad                                    | Archivo o carpeta                             |
| -------------------------------------------- | --------------------------------------------- |
| Menú, encabezado y navegación                | `codigo/aplicacion/Aplicacion.jsx`            |
| Pantalla de una sección                      | `codigo/paginas/`                             |
| Campos de un empleado                        | `codigo/componentes/FormularioEmpleado.jsx`   |
| Campos de un horario                         | `codigo/componentes/FormularioHorario.jsx`    |
| Captura de incidencias                       | `codigo/componentes/FormularioIncidencia.jsx` |
| Pantalla de registro del trabajador          | `codigo/componentes/RegistroTrabajador.jsx`   |
| Secuencia y detección de movimientos         | `codigo/dominio/asistencia.js`                |
| Altas, bajas, cambios y registros            | `codigo/dominio/operaciones.js`               |
| Horarios iniciales de prueba                 | `codigo/datos/horariosIniciales.js`           |
| Estado compartido y guardados                | `codigo/aplicacion/ProveedorAplicacion.jsx`   |
| Persistencia y futura conexión de datos      | `codigo/repositorios/`                        |
| Tamaños de letra, colores y adaptación móvil | `codigo/estilos/aplicacion.css`               |
| Logo de todas las pantallas                  | `publico/identidad/logo-rey-pez.png`          |
| Lectura y exportación CSV                    | `codigo/utilidades/archivosCsv.js`            |
| Pruebas de lógica                            | `pruebas/dominio.prueba.js`                   |
| Recorridos de navegador                      | `pruebas/navegador/aplicacion.prueba.js`      |

Editar los horarios iniciales o el catálogo no reemplaza automáticamente los datos que ya están guardados en un navegador. Para cambiar un horario existente de prueba, usa Configuración. Para experimentar con los valores iniciales, utiliza otro perfil de navegador; conserva primero un respaldo si necesitas reiniciar datos.

## Forma de trabajar

1. Describe el cambio y el resultado esperado. Para reglas de operación, registra la decisión en `documentacion/reglas-pendientes.md` y espera la definición de la responsable.
2. Modifica el módulo correspondiente. Las pantallas presentan información; las funciones de `dominio/` contienen las reglas; el repositorio guarda los datos.
3. Ejecuta la app y revisa el caso afectado, incluidos mensajes de error. Para cambios visuales, comprueba escritorio y móvil.
4. Aplica el formato y ejecuta las verificaciones antes de guardar una versión en Git:

```bash
npm run formatear
npm run verificar
```

Si cambias un flujo de formulario, navegación o asistencia, ejecuta también los recorridos reales:

```bash
npx playwright install chromium
npm run probar:navegador
```

Los recorridos usan perfiles aislados y no modifican los datos de tu navegador habitual. Para cambios de reglas, añade o adapta pruebas de casos concretos: movimiento esperado, horario, marcación previa y resultado. No cambies una prueba solo para hacerla pasar sin comprobar qué comportamiento se quiere.

## Convenciones

- Nombres propios de archivos y carpetas en español, sin acentos; componentes en `.jsx` y funciones, datos y utilidades en `.js`.
- `PascalCase` para componentes y `camelCase` para funciones y variables. Los campos importados del prototipo conservan sus nombres originales.
- Utilizar estado y JSX para mostrar información; los componentes no deben consultar `localStorage` directamente.
- Evitar modificar los objetos recibidos por las funciones de dominio. Devolver el estado actualizado.
- Validar antes de guardar y mostrar los fallos; confirmar éxito después de persistir.
- Reutilizar campos, tablas y mensajes ya existentes cuando resuelvan la necesidad.
- Mantener textos visibles en español. Incorporar etiquetas a los campos y conservar la navegación por teclado.
- Añadir dependencias solo cuando resuelvan una necesidad concreta y conservar `package-lock.json` junto con `package.json`.

## GitHub cuando se cree el repositorio

Antes del primer commit, revisa `git status` y los archivos que se van a incluir. El proyecto ya excluye los catálogos originales, las dependencias instaladas, archivos `.env`, compilados y resultados de pruebas. Guarda cambios pequeños con un mensaje que explique qué se hizo.

Ejemplo de rama para una tarea:

```bash
git switch -c codex/mejorar-reporte-asistencia
```

La verificación de `.github/workflows/verificar-aplicacion.yml` ejecuta formato, análisis del código, pruebas y compilación cuando se suban cambios. Esta entrega no crea ni publica un repositorio remoto.

## Firebase

La conexión queda para una etapa posterior. El punto de entrada es `codigo/repositorios/repositorio.js`; consulta `documentacion/arquitectura.md`. `.env.ejemplo` documenta los nombres previstos, pero introducir valores allí no activa una conexión. Antes de implementarla se revisarán autenticación, permisos, operaciones por entidad y migración de datos.
