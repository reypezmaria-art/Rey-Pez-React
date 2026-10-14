# Acuerdos integrados · 14 de octubre de 2026

María es la administradora de las tres empresas. Los cambios se realizan en `codex/revision-local`; `main` se conserva. La usuaria autorizó integrar la planificación y recuperar los 30 registros del CSV corregido, sin bajas ni altas inventadas por diferencias en los conteos.

| Acuerdo                                                              | Estado en esta rama                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Alta, edición, baja y expediente personal                            | Implementado; conserva historial e IDs                                                                                         |
| Cuatro marcajes, un botón Registrar, bienvenida y retorno            | Implementado; terminal separada sin incidencias                                                                                |
| Tolerancia de 10 minutos entrada, regreso y salida                   | Implementado; solo revisión administrativa                                                                                     |
| Salida a comida flexible sin aviso                                   | Implementado; regreso medido desde salida real                                                                                 |
| Edgar 06–14, 09–17, 12–20 por semana desde 28/09/2026                | Implementado; comida 30 minutos; Pedro conserva 09–18 y comida 13–14                                                           |
| Ausencia pendiente de revisión                                       | Implementado; María decide falta, permiso, incapacidad, vacaciones o emergencia                                                |
| Domingos y festivos                                                  | Domingos automáticos; fechas de festivos/cierres configurables por María                                                       |
| Emergencias / registro anticipado / correcciones                     | Marcación administrativa opcional con responsable y motivo, sin borrar el original                                             |
| Excepciones autorizadas de turno                                     | Por empleado, fecha y horario; motivo obligatorio                                                                              |
| Cloro y limpieza lunes mañana/tarde                                  | Programación editable con referencias iniciales 09:00 y 17:00; las horas exactas de ambos períodos se revisan en Configuración |
| Temperaturas 09:00, 13:00, 17:00                                     | Programación y avisos por cuarto, con cierre explícito de revisión                                                             |
| Cuartos fríos Allan 4 y Estuardo 2                                   | Implementado; Edgar permanece sin inventar cuartos                                                                             |
| Temperatura óptimo ≤−25, observación −25 < T < −19, atención ≥−19 °C | Implementado como parámetro interno                                                                                            |
| Bitácoras, EPP, evidencias, No aplica con motivo                     | Formularios generales implementados; falta cotejar formatos originales y campos especializados                                 |
| Mantenimiento, reparaciones, compras, técnico, costo y comprobantes  | Implementado como módulo separado                                                                                              |
| Contraseñas y permisos solo María                                    | Control local implementado con PBKDF2, sal y bloqueo; falta seguridad centralizada de servidor                                 |
| Brenda solo Estuardo y bitácoras autorizadas                         | Implementado por asignación explícita de María; no se conceden permisos automáticamente                                        |
| QR por área más ID y contraseña                                      | Implementado en la copia local; escaneo remoto necesita una dirección accesible                                                |
| María autoriza el equipo de asistencia                               | Vinculación por navegador local implementada; control central entre equipos pendiente                                          |
| Respaldo manual, automático y restauración                           | JSON completo y siete copias diarias locales anteriores a cambios; CSV opcional                                                |
| Dos logos, azul claro, azul marino y dorado                          | Conservado; logo oficial en terminal y captura                                                                                 |

## Pendientes que requieren datos o infraestructura

- Firebase u otro servidor no está conectado: no hay sincronización entre la PC y teléfonos/tabletas ni control de permisos de servidor.
- Huella digital: falta lector y conexión compatible. No se simula una captura biométrica.
- Catálogo laboral: se recuperan los 30 empleados del CSV corregido autorizado, no se publican en GitHub. Las cantidades del CSV (Allan 9, Edgar 14, Estuardo 7) difieren de conteos posteriores; María pidió conservar los 30 para revisión.
- Cuartos fríos de Edgar: cantidad pendiente. María puede agregar los confirmados en Configuración.
- Turnos nocturnos y formatos especializados no definidos: esta implementación controla los turnos diurnos acordados.
- Los permisos locales organizan el flujo de revisión; el contenido de un HTML local y su almacenamiento no son una barrera de confidencialidad de producción.

## Corrección de carpetas · 14 de octubre de 2026

María pidió tres entradas separadas en el menú: **Bitácoras de salud**, **Bitácora de EPP** y **Normas de la Secretaría del Trabajo**. Cada carpeta se organiza por empresa y apartados propios. Temperaturas/cuarto frío se registra únicamente dentro de Salud; se retira el acceso duplicado del menú. EPP en cuartos fríos es una revisión de equipo, no otra bitácora de temperaturas. Las carpetas de Normas permanecen vacías por empresa hasta definir sus documentos.

Se reutiliza el logo PNG transparente ya existente en todas las vistas para quitar el recuadro negro, conservando la imagen. Las contraseñas nuevas admiten un mínimo de seis caracteres, tanto para María como trabajadores; las contraseñas y datos existentes se conservan.
