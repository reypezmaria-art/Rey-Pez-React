# Registro de decisiones de operación

**Responsable de definir y confirmar las reglas: esposa de Allan.** Este documento sirve para trasladar sus decisiones al código. No establece políticas nuevas. El funcionamiento actual se encuentra descrito en `arquitectura.md` y las correcciones realizadas en `../LEEME.md`.

## Temas por revisar

| Tema                                                 | Estado                  | Punto de implementación actual                                             |
| ---------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| Secuencia de entrada, comida, regreso y salida       | Pendiente de revisión   | `codigo/dominio/asistencia.js`                                             |
| Tolerancias y alertas fuera de intervalo             | Pendiente de revisión   | `codigo/dominio/asistencia.js`, `codigo/dominio/operaciones.js`            |
| Rotación semanal de Edgar                            | Pendiente de definición | Notas en `codigo/datos/horariosIniciales.js`                               |
| Vigencia de horarios y cambios de jornada            | Pendiente de definición | `codigo/componentes/FormularioHorario.jsx`, `codigo/dominio/asistencia.js` |
| Turnos nocturnos, descansos y cambios de día         | Pendiente de definición | `codigo/dominio/asistencia.js`                                             |
| Marcaciones repetidas y correcciones administrativas | Pendiente de revisión   | `codigo/dominio/operaciones.js`                                            |
| Usuarios y permisos de trabajador/administración     | Pendiente de definición | Pantallas de demostración; integración futura                              |

## Plantilla para cada decisión

Copia este bloque por cada tema que se vaya a definir. Describe ejemplos reales con nombres ficticios.

```text
Tema:
Estado: pendiente / definida / implementada / verificada
Definida por:
Fecha:

Comportamiento esperado:

Ejemplo normal:
- Horario:
- Marcaciones anteriores:
- Momento de la nueva marca:
- Resultado esperado:

Excepciones y cómo debe responder la app:

Pantallas afectadas:
Pruebas que demuestran el resultado:
```

Cuando una decisión cambie, documenta la nueva definición antes de modificar código y pruebas. Conserva el contexto de qué regla sustituye, para que los reportes y el historial se puedan interpretar correctamente.
