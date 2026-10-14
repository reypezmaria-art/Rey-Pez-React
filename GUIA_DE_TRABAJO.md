# Guía de trabajo · Rey Pez

Trabajar en `codex/revision-local`. No modificar ni fusionar `main` sin instrucción de María. La revisión local y el código provienen de la misma base; evitar mantener variantes independientes.

Lee `LEEME.md` para iniciar y `documentacion/reglas-pendientes.md` para los acuerdos aprobados. No completar nombres, conteos, equipos o reglas desconocidas por suposición. El catálogo de 30 empleados se recupera en la copia privada y queda excluido del repositorio público.

| Cambio                                  | Ubicación                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Navegación y vistas por tipo de equipo  | `codigo/aplicacion/Aplicacion.jsx`                                         |
| Sesión y operaciones autorizadas        | `codigo/aplicacion/ProveedorAplicacion.jsx`                                |
| Personal y expediente                   | `codigo/paginas/Personal.jsx`, `codigo/componentes/FormularioEmpleado.jsx` |
| Asistencia, rotación y ausencias        | `codigo/dominio/asistencia.js`, `codigo/dominio/operaciones.js`            |
| Formularios de bitácoras y temperaturas | `codigo/paginas/Bitacoras.jsx`, `codigo/dominio/bitacoras.js`              |
| Mantenimiento                           | `codigo/paginas/Mantenimiento.jsx`                                         |
| Contraseñas y permisos                  | `codigo/paginas/Seguridad.jsx`, `codigo/dominio/seguridad.js`              |
| Equipos, QR, programación y excepciones | `codigo/paginas/OperacionConfiguracion.jsx`                                |
| Persistencia, migración y respaldos     | `codigo/repositorios/repositorioLocal.js`                                  |
| Vista local privada                     | `herramientas/generarVistaLocal.js`                                        |

Nombres en español, textos de interfaz en español, componentes PascalCase y archivos JS/JSX. Las operaciones devuelven objetos nuevos, validan antes de guardar y no confirman éxito antes de persistir. Conservar registros originales y responsable/motivo de ajustes.

Después de modificar:

```bash
npm run formatear
npm run verificar
npm run probar:navegador
```

Los recorridos de navegador usan perfiles aislados. Comprueba escritorio, móvil, administración y captura restringida cuando cambien flujos o permisos. No añadas datos laborales ni contraseñas a las pruebas ni al repositorio. Los horarios iniciales no reemplazan automáticamente las decisiones ya guardadas: modifica Configuración o usa un perfil de prueba aislado.
