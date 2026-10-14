# Arquitectura y futura integración con Firebase

## Flujo actual

```text
Pantallas y formularios (React)
            ↓
ProveedorAplicacion: carga, suscripción y estado de guardado
            ↓
Operaciones puras de dominio/ (validan y generan el nuevo estado)
            ↓
Repositorio: load(), transact(update), subscribe(listener)
            ↓
localStorage: reypez_react_v1
```

La interfaz se renderiza con JSX y estado de React. No hay HTML inyectado, manejadores globales ni manipulación de tablas mediante `innerHTML`. Los formularios son controlados y los efectos gestionan suscripciones y temporizadores con limpieza.

El estado local contiene `version`, `employees`, `attendance`, `schedules` y `alerts`. Se guarda de forma conjunta para evitar actualizaciones parciales. Web Locks serializa las modificaciones entre pestañas en navegadores compatibles y el evento `storage` actualiza las demás pestañas del mismo origen. Esto no equivale a sincronización entre computadoras ni a seguridad multiusuario.

Las claves antiguas `reypez_employees_v1`, `reypez_attendance_v1`, `reypez_schedules_v1` y `reypez_admin_alerts_v1` se leen únicamente si no existe el nuevo estado y están disponibles en el mismo origen. El navegador no permite leer automáticamente el almacenamiento de un HTML abierto con `file://` desde una aplicación HTTP. Para trasladar personal desde allí, exporta su CSV e impórtalo en Personal; el traslado del historial antiguo necesitaría una herramienta de restauración adicional.

## Preparación para Firebase

No se incluye una conexión ficticia ni una base de datos creada sin configuración. `codigo/repositorios/repositorio.js` es el punto de composición que seleccionará un repositorio real cuando se implemente la integración. Las funciones de dominio se pueden reutilizar en un backend, pero **no deben considerarse una barrera de autorización** cuando se ejecutan en el navegador.

La interfaz actual opera sobre un documento local completo. En la siguiente etapa, el repositorio deberá evolucionar hacia operaciones específicas por entidad y consultas paginadas; no se recomienda descargar ni sobrescribir toda la base en cada cambio. Mantener la capa de acceso separada limita ese cambio al proveedor/repositorio y a sus acciones.

Propuesta inicial para revisar en esa etapa:

| Colección    | Propósito                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| `companies`  | Empresas y alcance de acceso                                               |
| `employees`  | Identidad interna inmutable, ID laboral visible, empresa, estado y horario |
| `schedules`  | Horarios y versiones con vigencias                                         |
| `attendance` | Eventos con ID único, empleado, movimiento y fecha autorizada              |
| `incidents`  | Revisión administrativa, responsable y evidencia                           |
| `alerts`     | Alertas pendientes/revisadas y trazabilidad de revisión                    |
| `users`      | Perfil y vínculo con Firebase Authentication, sin contraseñas              |

Antes de habilitar ese backend:

1. Definir autenticación del trabajador y de administración, roles y separación por empresa.
2. Implementar Firebase Authentication para credenciales; no guardar contraseñas en Firestore ni en el frontend.
3. Diseñar y comprobar reglas de acceso con el emulador. El kiosco debe poder ejecutar solo las acciones autorizadas.
4. Mover la validación autoritativa y los cambios de acceso a operaciones confiables del servidor. Definir tiempo del servidor, zona horaria y política para dispositivos sin conexión.
5. Usar transacciones/idempotencia para marcaciones, IDs y cambios relacionados. Separar identidad inmutable del ID laboral editable.
6. Definir retención y acceso a CURP/NSS, auditoría, copias de respaldo y proceso de migración.
7. Especificar los turnos semanales, nocturnos, descansos y vigencias; actualmente solo se conservan notas de rotación.

Los valores `VITE_FIREBASE_*` serán configuración pública del cliente; una cuenta de servicio o clave privada nunca debe estar allí. Las variables por sí solas no activan Firebase en esta entrega.

## Comportamiento de asistencia

- La primera marca del día registra entrada.
- Desde entrada, se reconoce comida cercana al intervalo configurado o salida al aproximarse el final del turno.
- Después de salida a comer se registra regreso; después de regreso, salida final.
- Una marca tras salida final inicia entrada nuevamente y genera alerta si repite un movimiento del día.
- Las marcas fuera de intervalo se aceptan y generan alertas internas.
- Las revisiones administrativas se registran aparte y no cambian esta secuencia.

Se mantienen las tolerancias del prototipo: 90 minutos para entrada y 30 minutos para comida, regreso y salida. Son reglas de prueba, no una política laboral validada.
