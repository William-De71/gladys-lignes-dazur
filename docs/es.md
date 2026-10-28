# Lignes d'Azur Nice

## Presentación

Esta integración trae **Lignes d’Azur**, los tranvías y autobuses de la Métropole Nice Côte d’Azur, a Gladys. Da las **próximas salidas, corregidas en tiempo real, con su retraso**, en las paradas que elijas (tres en el formulario, hasta 10 más con un botón), filtradas por línea y dirección. Cada parada se convierte en un dispositivo para mostrar en un panel y usar en escenas, y se avisa de los **viajes suprimidos**.

Los datos proceden de los **datos abiertos oficiales de Lignes d’Azur**, publicados en `transport.data.gouv.fr` bajo la Licence Ouverte 2.0 (Etalab): sin cuenta ni clave. El **horario** (GTFS) se descarga una vez al día si cambió, y la integración lo guarda. El **tiempo real** (GTFS-RT) de toda la red se lee en **una sola petición para todas las paradas seguidas**, cada minuto por defecto (cada 10 minutos mientras ninguna parada anuncie nada en la próxima media hora, de noche).

Una salida se **sigue en tiempo real** poco antes de dejar su cabecera: se dan su hora estimada y su retraso. Antes es el **horario**, marcado «(teórico)». Los tranvías circulan por frecuencia: el tiempo real los anuncia a menudo unos minutos antes del horario, y entonces no da retraso.

Lignes d’Azur no publica **ningún aviso de tráfico** en datos abiertos (ninguna alerta en el GTFS-RT, ninguna en su flujo SIRI): la integración no muestra el tráfico de las líneas.

Es una integración **en la nube**: contacta con `chouette.enroute.mobi` (horario) y `ara-api.enroute.mobi` (tiempo real), los servidores de datos abiertos de la red. Nada más sale de tu red.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Nada más: los datos abiertos de Lignes d’Azur no piden cuenta ni clave.

## Configuración

| Campo                   | Qué escribir                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Parada 1, 2, 3          | El nombre de la parada tal como aparece en ella («Masséna», «Gare Thiers / Poste») o el código de un andén («MASSE2»).    |
| Línea                   | Solo esta línea: «L1», «tram 2», «5», «Exp2». Vacío: todas las líneas de la parada.                                       |
| Dirección               | Solo los destinos que contienen estas palabras: «Hôpital Pasteur», «Aéroport \| Port Lympia». Vacío: los dos sentidos.    |
| Lectura del tiempo real | Cada 30 segundos, minuto, 2 minutos o 5 minutos.                                                                          |
| Idioma de los textos    | Nombres de los dispositivos, resúmenes y salidas de las escenas. Los nombres de paradas y los destinos quedan en francés. |

Una parada reúne los andenes de un mismo nombre en un mismo lugar, tranvías y autobuses: «Jean Médecin» da los dos sentidos de los tranvías L1, L2 y L3 y los autobuses que pasan por allí. El mismo nombre en dos lugares (como «Le Château» en Niza y en Cagnes-sur-Mer) forma dos paradas: escribe entonces el código de uno de sus andenes. El botón **Buscar una parada** da las paradas que contienen unas palabras, con los códigos de sus andenes y sus líneas («Masséna [MASSE0, MASSE2, MASSV7] → L1, 8+, 12+, Exp3»). Bastan unas palabras cuando una sola parada las contiene. **Probar la conexión** vuelve a pedir el horario y lee cada parada al momento.

Una línea se escribe como en el vehículo: «L1», «L2», «L3» y «B» para los tranvías («tram 1» o «T1» también valen), «5», «8+», «Exp2», «C»…

Más paradas que las tres del formulario (casa, trabajo, colegio…): **Añadir una parada** toma los mismos tres campos — parada, línea, dirección — y sigue hasta 10 paradas más. **Listar las paradas** muestra todas las paradas seguidas, numeradas; **Quitar una parada** toma ese número (o el nombre). Las paradas añadidas se guardan en la configuración de Gladys y siguen así sus copias de seguridad.

## Uso

### Dispositivos

En la pestaña **Descubrir**, crea los dispositivos que quieras. **Lignes d’Azur \<parada\>** da la próxima salida en texto («L1 → Hôpital Pasteur · 3 min (+2 min de retraso)»), la espera de la próxima salida y de la siguiente (minutos) y el retraso de la próxima (minutos, publicado solo si se sigue en tiempo real; una salida anunciada antes cuenta 0).

De noche, sin salida en las tres horas siguientes, el dispositivo muestra la primera salida de la mañana.

### Widget del panel

![El widget de salidas Lignes d’Azur en Jean Médecin y en varias paradas (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-lignes-dazur/main/docs/assets/widgets.es.png)

**Salidas Lignes d’Azur** muestra las próximas salidas de una parada, en compacto. Una fila por línea y destino, con sus próximas salidas seguidas («2 · 17 min»). Un viaje suprimido se muestra («suprimido 10:48») y pone la fila en naranja, como un retraso de 5 minutos o más. El ajuste **Trayectos mostrados** fija el número de filas. Elige una parada seguida, o escribe cualquier parada (y una línea) en los ajustes del widget. Con **Varias paradas**, un widget muestra varios dispositivos de parada: los de una misma parada se reúnen bajo su nombre; para paradas distintas, cada parada empieza con una fila propia.

### Escenas

Disparadores, una vez por cambio (la primera lectura solo sirve de referencia):

- **Lignes d’Azur: salida en breve**: una salida en una parada seguida sale dentro de 2, 3, 5, 10, 15 o 20 minutos, contados sobre su estimación en tiempo real.
- **Lignes d’Azur: salida suprimida**: un viaje de la próxima hora en una parada seguida está suprimido, o no da servicio a la parada.

Cada uno da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (línea, destino, hora, retraso…). La acción **Lignes d’Azur: próximas salidas** devuelve el mismo tipo de valores, para ponerlos en un mensaje o probarlos en una condición.

Ejemplos:

- Cuando el tranvía L1 hacia Hôpital Pasteur sale de Masséna dentro de 5 minutos → poner en verde la lámpara de la entrada.
- Cuando se suprime una salida de tu parada → enviar el resumen a tu teléfono antes de salir.
- Cada día laborable a las 7:30 → leer las próximas salidas de tu parada y hacer que las anuncie el altavoz de la cocina.

### Transporte

Solo nube: los datos vienen de internet. El horario una vez al día, el tiempo real de toda la red en una petición.

## Solución de problemas

- **«Desconocido o ambiguo»**: usa **Buscar una parada** y copia el nombre exacto o un código de andén (un nombre presente en dos lugares pide un código de andén); para una línea, su nombre como en el vehículo («L1», «5», «Exp2»).
- **«(teórico)» en una salida**: el viaje aún no se sigue en tiempo real (no ha dejado su cabecera), o Lignes d’Azur no lo sigue; la hora es la del horario.
- **Un tranvía antes que el horario**: los tranvías circulan por frecuencia, y el tiempo real da la hora del tranvía que llega de verdad; el retraso queda entonces en 0.
- **Ninguna salida en la dirección escrita**: los destinos son los escritos en los vehículos («Hôpital Pasteur», «Henri Sappia», «CADAM / Centre Administratif»); vacía la dirección para verlos todos.
- **Sin tráfico de las líneas**: Lignes d’Azur no publica avisos de tráfico en datos abiertos; consulta lignesdazur.com.
- **«Los datos abiertos de Lignes d’Azur no responden»**: la integración vuelve a intentarlo en cada lectura; mientras tanto, las salidas vienen del horario guardado.
- **Para avisar de un problema**: pulsa **Diagnóstico** y copia las líneas que empiezan por «Lignes d’Azur diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
