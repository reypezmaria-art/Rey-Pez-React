# Vacaciones en Personal

Personal → Vacaciones muestra salidas y regresos del mes (también períodos iniciados en el mes anterior), empresa, días laborables y descansos. El mes inicial usa la fecha de Ciudad de México. Las cuentas llamadas exactamente «prueba» y los registros con `vacaciones_excluir: true` se excluyen de este apartado; no se borran del directorio.

La tabla de referencia aplica los artículos 76 y 81 de la LFT para relaciones continuas: 12 días al primer aniversario; 14, 16, 18 y 20 hasta el quinto; 22 de seis a diez años y dos más por cada bloque posterior de cinco años. Es una referencia anual, no una afirmación del saldo histórico. El plazo se muestra desde el aniversario hasta seis meses después. La aplicación no inventa fechas de salida.

Para programar se selecciona trabajador, año del aniversario (desde 2023), primer día y días laborables. Antes de guardar, María confirma antigüedad reconocida, relación continua, fechas acordadas y días usados fuera del apartado para ese aniversario (cero debe capturarse explícitamente si corresponde). El sistema resta los períodos vigentes ya registrados y rechaza excesos y cruces. Para personal de temporada o discontinuo se requiere revisar el cálculo proporcional del artículo 77; no usar el cálculo continuo sin esa revisión.

Con la jornada acordada de lunes a sábado, se excluyen domingos y descansos del artículo 74: 1 de enero, primer lunes de febrero, tercer lunes de marzo, 1 de mayo, 16 de septiembre, tercer lunes de noviembre, 25 de diciembre y transmisión federal del 1 de octubre cada seis años desde 2024. Las jornadas electorales y descansos adicionales se agregan en Configuración. El 16/11/2026 es obligatorio; el 02/11/2026 no se añade automáticamente.

El último día y el regreso se calculan antes de guardar. Se conserva el calendario usado en cada registro; cambiar festivos después exige revisar y volver a guardar las vacaciones afectadas. No se modifica asistencia 1 ni se generan marcajes; las vacaciones guardadas evitan ausencias pendientes en Asistencia 2 hasta el día anterior al regreso.

Los períodos se guardan en la ficha del empleado, tanto en persistencia local como en Firestore. Modificaciones y cancelaciones conservan la versión anterior, responsable y motivo en auditoría. Solo administración puede guardar. No se cargan ejemplos con trabajadores reales ni se asignan vacaciones a partir de un PDF de nómina. Un campo «Fecha Reing» no confirma por sí solo la antigüedad reconocida.

Fuentes consultadas el 05/11/2026:

- https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf (artículos 74 y 76–81).
- https://www.gob.mx/profedet/articulos/persona-trabajadora-las-vacaciones-son-tu-derecho?idiom=es
- https://www.gob.mx/profedet/articulos/sabes-cuales-son-los-dias-de-descanso-obligatorio-para-este-2026?facet=app&mode=light
