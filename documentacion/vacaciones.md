# Vacaciones en Personal

Personal → Vacaciones permite buscar al trabajador escribiendo su nombre o ID, seleccionar la coincidencia e ingresar únicamente la fecha de salida y la fecha de regreso a trabajar. El regreso no se cuenta como vacaciones. Las fechas elegidas se conservan exactamente; el saldo no adelanta ni retrasa el regreso.

La aplicación calcula automáticamente antigüedad, aniversario al que se aplica, días anuales, días laborables del período, domingos y festivos excluidos y saldo después del período. El aniversario se determina en la fecha de salida. Al editar un registro cuya salida no cambia, se conserva el aniversario que tenía asignado. No se escriben manualmente el año, el número de días ni el motivo; la descripción administrativa se genera al guardar.

Ejemplo ficticio: ingreso 27/01/2025; salida 14/02/2026; regreso a trabajar 26/02/2026. Se cuentan diez días laborables, se excluyen los domingos 15 y 22, el último día del período es el 25 y el regreso se conserva el 26. La referencia anual es doce días y quedan dos según el historial registrado.

El saldo resta los demás períodos vigentes del mismo aniversario y cualquier total anterior sin fechas que ya estuviera guardado. No se crea automáticamente un dato histórico de cero cuando ese total se desconoce: se informa «Saldo según los períodos registrados». Las vacaciones no registradas no se pueden deducir de la fecha de ingreso. Los totales antiguos se conservan. Solo cuando hay días antiguos suficientes aparece una opción para indicar que las fechas capturadas ya estaban incluidas en ese total; si María la selecciona, se descuenta del total sin fechas el número exacto de días que ahora tienen fechas. La auditoría conserva ambos valores. Nunca se hace esta conversión sin selección expresa.

Se rechazan fechas inválidas, regreso anterior o igual a salida, intervalos mayores de un año, regreso en un día de descanso, cruces con otros períodos y períodos que exceden el saldo. Cancelaciones y modificaciones conservan versión anterior, responsable, fecha y descripción administrativa. La cancelación mantiene un motivo específico. Los períodos se guardan en la ficha del empleado en persistencia local y Firestore; solo administración puede guardar.

La consulta mensual muestra períodos que se cruzan con el mes elegido, incluidos los iniciados el mes anterior. «Días de vacaciones por revisar» inicia contraído y se abre con su flecha; las otras consultas de antigüedad e historial también se pueden desplegar. El mes inicial usa Ciudad de México. Las cuentas llamadas exactamente «prueba» y los registros con `vacaciones_excluir: true` se excluyen del apartado, sin borrarse del directorio.

Con la jornada acordada de lunes a sábado se excluyen domingos, descansos del artículo 74 (1 de enero; primer lunes de febrero; tercer lunes de marzo; 1 de mayo; 16 de septiembre; tercer lunes de noviembre; 25 de diciembre y 1 de octubre de transmisión federal cada seis años desde 2024) y descansos adicionales de Configuración, incluidas jornadas electorales aplicables. No se agrega el 2 de noviembre automáticamente. Las fechas y el calendario usado quedan guardados; cambios de festivos posteriores requieren revisar los períodos afectados. No se generan marcajes ni se modifica Asistencia 1. Las vacaciones guardadas evitan ausencias pendientes en Asistencia 2 hasta el día anterior al regreso.

La referencia de la LFT para relaciones continuas es de 12 días al primer aniversario; 14, 16, 18 y 20 hasta el quinto; 22 de seis a diez años, y dos más por cada bloque posterior de cinco años. El plazo de seis meses se muestra como referencia de revisión. La antigüedad reconocida debe revisarse en reingresos. Para relaciones discontinuas o de temporada debe revisarse el cálculo proporcional del artículo 77; no se presume que un PDF de nómina confirma antigüedad ni vacaciones disfrutadas.

Fuentes consultadas el 05/11/2026:

- https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf (artículos 74 y 76–81).
- https://www.profedet.gob.mx/micrositio/index.php/vacaciones
- https://www.gob.mx/profedet/articulos/sabes-cuales-son-los-dias-de-descanso-obligatorio-para-este-2026?facet=app&mode=light
