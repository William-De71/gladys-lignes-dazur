// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface
// (appareil / Gerät / dispositivo, scène / Szene / escena) and of Lignes
// d'Azur (arrêt, ligne, passage). The names of stops and lines and the
// destinations stay as Lignes d'Azur writes them, in French.
// -----------------------------------------------------------------------------

import { minutesLeft } from './departures.js';
import { formatTime } from './time.js';

const LANGUAGES = ['en', 'fr', 'de', 'es'];
// The brand of the network, in device names and summaries.
const BRAND = 'Lignes d’Azur';

const TEXTS = {
  // devices
  stopDeviceName: {
    en: 'Lignes d’Azur {stop}',
    fr: 'Lignes d’Azur {stop}',
    de: 'Lignes d’Azur {stop}',
    es: 'Lignes d’Azur {stop}',
  },
  featureNext: {
    en: 'Next passage',
    fr: 'Prochain passage',
    de: 'Nächste Abfahrt',
    es: 'Próximo paso',
  },
  featureWait: {
    en: 'Wait',
    fr: 'Attente',
    de: 'Wartezeit',
    es: 'Espera',
  },
  featureFollowing: {
    en: 'Wait for the following one',
    fr: 'Attente du suivant',
    de: 'Wartezeit der folgenden',
    es: 'Espera del siguiente',
  },
  featureDelay: {
    en: 'Delay of the next passage',
    fr: 'Retard du prochain passage',
    de: 'Verspätung der nächsten Abfahrt',
    es: 'Retraso del próximo paso',
  },

  // passages
  noPassage: {
    en: 'No passage announced',
    fr: 'Aucun passage annoncé',
    de: 'Keine Abfahrt angekündigt',
    es: 'Ningún paso anunciado',
  },
  minutesValue: {
    en: '{n} min',
    fr: '{n} min',
    de: '{n} Min.',
    es: '{n} min',
  },
  approaching: {
    en: 'Approaching',
    fr: 'À l’approche',
    de: 'Fährt ein',
    es: 'Llegando',
  },
  inMinutes: {
    en: 'in {n} min',
    fr: 'dans {n} min',
    de: 'in {n} Min.',
    es: 'dentro de {n} min',
  },
  atTime: {
    en: 'at {time}',
    fr: 'à {time}',
    de: 'um {time}',
    es: 'a las {time}',
  },
  scheduledMark: {
    en: '(timetable)',
    fr: '(théorique)',
    de: '(Fahrplan)',
    es: '(teórico)',
  },
  lateMark: {
    en: '(+{n} min late)',
    fr: '(+{n} min de retard)',
    de: '(+{n} Min. Verspätung)',
    es: '(+{n} min de retraso)',
  },
  cancelledShort: {
    en: 'cancelled {time}',
    fr: 'supprimé {time}',
    de: 'entfällt {time}',
    es: 'suprimido {time}',
  },

  // scene summaries
  summarySoon: {
    en: '{line} towards {destination} leaves {stop} in {minutes} min ({time}).',
    fr: '{line} vers {destination} passe à {stop} dans {minutes} min ({time}).',
    de: '{line} Richtung {destination} fährt an {stop} in {minutes} Min. ab ({time}).',
    es: '{line} hacia {destination} pasa por {stop} dentro de {minutes} min ({time}).',
  },
  summarySoonLate: {
    en: '{line} towards {destination} leaves {stop} in {minutes} min ({time}, {delay} min late).',
    fr: '{line} vers {destination} passe à {stop} dans {minutes} min ({time}, {delay} min de retard).',
    de: '{line} Richtung {destination} fährt an {stop} in {minutes} Min. ab ({time}, {delay} Min. Verspätung).',
    es: '{line} hacia {destination} pasa por {stop} dentro de {minutes} min ({time}, {delay} min de retraso).',
  },
  summaryCancelled: {
    en: 'The {time} {line} towards {destination} at {stop} is cancelled.',
    fr: 'Le {line} de {time} vers {destination} à {stop} est supprimé.',
    de: 'Die {line} um {time} Richtung {destination} an {stop} entfällt.',
    es: 'El {line} de las {time} hacia {destination} en {stop} está suprimido.',
  },
  outputNext: {
    en: 'Next passage at {stop}: {line} towards {destination} {when}.',
    fr: 'Prochain passage à {stop} : {line} vers {destination} {when}.',
    de: 'Nächste Abfahrt an {stop}: {line} Richtung {destination} {when}.',
    es: 'Próximo paso en {stop}: {line} hacia {destination} {when}.',
  },
  outputFollowing: {
    en: 'The following one {when}.',
    fr: 'Le suivant {when}.',
    de: 'Die folgende {when}.',
    es: 'El siguiente {when}.',
  },
  outputNone: {
    en: 'No passage announced at {stop}.',
    fr: 'Aucun passage annoncé à {stop}.',
    de: 'Keine Abfahrt an {stop} angekündigt.',
    es: 'Ningún paso anunciado en {stop}.',
  },

  // widgets
  readAt: {
    en: 'read at {time}',
    fr: 'lu à {time}',
    de: 'gelesen um {time}',
    es: 'leído a las {time}',
  },
  updatedAt: {
    en: 'Lignes d’Azur · updated at {time}',
    fr: 'Lignes d’Azur · mis à jour à {time}',
    de: 'Lignes d’Azur · aktualisiert um {time}',
    es: 'Lignes d’Azur · actualizado a las {time}',
  },
  minutesShort: {
    en: 'min',
    fr: 'min',
    de: 'Min.',
    es: 'min',
  },
  widgetNoStop: {
    en: 'No stop is followed: add one on the Configuration screen of the integration, or type one in the widget settings.',
    fr: 'Aucun arrêt n’est suivi : ajoutez-en un dans l’écran Configuration de l’intégration, ou saisissez-en un dans les réglages du widget.',
    de: 'Keine Haltestelle wird verfolgt: Füge eine im Konfigurationsbildschirm der Integration hinzu oder gib eine in den Widget-Einstellungen ein.',
    es: 'No se sigue ninguna parada: añade una en la pantalla Configuración de la integración, o escribe una en los ajustes del widget.',
  },

  // configuration and status
  statusUnreachable: {
    en: 'The open data of Lignes d’Azur do not answer ({detail}). Next try in {minutes} min.',
    fr: 'L’open data de Lignes d’Azur ne répond pas ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Die Open Data von Lignes d’Azur antworten nicht ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'Los datos abiertos de Lignes d’Azur no responden ({detail}). Nuevo intento dentro de {minutes} min.',
  },
  statusConnected: {
    en: 'Connected to Lignes d’Azur: {stops} stop(s), real time read every {interval} s.',
    fr: 'Connecté à Lignes d’Azur : {stops} arrêt(s), temps réel lu toutes les {interval} s.',
    de: 'Mit Lignes d’Azur verbunden: {stops} Haltestelle(n), Echtzeit alle {interval} s gelesen.',
    es: 'Conectado a Lignes d’Azur: {stops} parada(s), tiempo real leído cada {interval} s.',
  },
  statusNotFound: {
    en: 'Unknown or ambiguous: {names}.',
    fr: 'Inconnu ou ambigu : {names}.',
    de: 'Unbekannt oder mehrdeutig: {names}.',
    es: 'Desconocido o ambiguo: {names}.',
  },
  statusNothing: {
    en: 'Connected to Lignes d’Azur. Add a stop on the Configuration screen.',
    fr: 'Connecté à Lignes d’Azur. Ajoutez un arrêt dans l’écran Configuration.',
    de: 'Mit Lignes d’Azur verbunden. Füge im Konfigurationsbildschirm eine Haltestelle hinzu.',
    es: 'Conectado a Lignes d’Azur. Añade una parada en la pantalla Configuración.',
  },
  testNetworkOk: {
    en: 'Lignes d’Azur open data reached: {lines} lines, {stops} stops',
    fr: 'Open data Lignes d’Azur joint : {lines} lignes, {stops} arrêts',
    de: 'Lignes d’Azur Open Data erreicht: {lines} Linien, {stops} Haltestellen',
    es: 'Datos abiertos de Lignes d’Azur alcanzados: {lines} líneas, {stops} paradas',
  },
  testStop: {
    en: '{stop}: {count} passage(s), next {next}',
    fr: '{stop} : {count} passage(s), prochain {next}',
    de: '{stop}: {count} Abfahrt(en), nächste {next}',
    es: '{stop}: {count} paso(s), próximo {next}',
  },
  testStopError: {
    en: '{stop}: {error}',
    fr: '{stop} : {error}',
    de: '{stop}: {error}',
    es: '{stop}: {error}',
  },
  testNetworkError: {
    en: 'Lignes d’Azur: {error}',
    fr: 'Lignes d’Azur : {error}',
    de: 'Lignes d’Azur: {error}',
    es: 'Lignes d’Azur: {error}',
  },
  unknownEntry: {
    en: 'unknown or ambiguous: {name}',
    fr: 'inconnu ou ambigu : {name}',
    de: 'unbekannt oder mehrdeutig: {name}',
    es: 'desconocido o ambiguo: {name}',
  },
  errorUnreachable: {
    en: 'the open data of Lignes d’Azur do not answer',
    fr: 'l’open data de Lignes d’Azur ne répond pas',
    de: 'die Open Data von Lignes d’Azur antworten nicht',
    es: 'los datos abiertos de Lignes d’Azur no responden',
  },
  errorBusy: {
    en: 'the open data server of Lignes d’Azur is busy, try again in a moment',
    fr: 'le serveur open data de Lignes d’Azur est occupé, réessayez dans un instant',
    de: 'der Open-Data-Server von Lignes d’Azur ist ausgelastet, versuche es gleich noch einmal',
    es: 'el servidor de datos abiertos de Lignes d’Azur está ocupado, inténtalo de nuevo en un momento',
  },
  searchTooShort: {
    en: 'Type at least two letters of the stop name.',
    fr: 'Saisissez au moins deux lettres du nom de l’arrêt.',
    de: 'Gib mindestens zwei Buchstaben des Haltestellennamens ein.',
    es: 'Escribe al menos dos letras del nombre de la parada.',
  },
  searchNone: {
    en: 'No stop matches "{query}".',
    fr: 'Aucun arrêt ne correspond à « {query} ».',
    de: 'Keine Haltestelle passt zu „{query}“.',
    es: 'Ninguna parada coincide con «{query}».',
  },
  searchFound: {
    en: 'Type the name as written (codes of its platforms in brackets, its lines after the arrow):\n{list}',
    fr: 'Saisissez le nom tel qu’écrit (codes de ses quais entre crochets, ses lignes après la flèche) :\n{list}',
    de: 'Gib den Namen so ein, wie er geschrieben ist (Codes der Bahnsteige in Klammern, Linien nach dem Pfeil):\n{list}',
    es: 'Escribe el nombre tal como aparece (códigos de sus andenes entre corchetes, sus líneas tras la flecha):\n{list}',
  },

  // stops added with the configuration buttons
  stopAdded: {
    en: 'Stop added: {name}. {count} stop(s) followed. Its device is offered in the Discover tab.',
    fr: 'Arrêt ajouté : {name}. {count} arrêt(s) suivi(s). Son appareil est proposé dans l’onglet Découvrir.',
    de: 'Haltestelle hinzugefügt: {name}. {count} Haltestelle(n) verfolgt. Ihr Gerät wird im Tab Entdecken angeboten.',
    es: 'Parada añadida: {name}. {count} parada(s) seguida(s). Su dispositivo se ofrece en la pestaña Descubrir.',
  },
  stopAlreadyFollowed: {
    en: '{name} is already followed.',
    fr: '{name} est déjà suivi.',
    de: '{name} wird bereits verfolgt.',
    es: '{name} ya se sigue.',
  },
  stopsFull: {
    en: 'Already {max} stops added: remove one first.',
    fr: 'Déjà {max} arrêts ajoutés : retirez-en un d’abord.',
    de: 'Bereits {max} Haltestellen hinzugefügt: entferne zuerst eine.',
    es: 'Ya hay {max} paradas añadidas: quita una primero.',
  },
  stopRemoved: {
    en: 'Stop removed: {name}. Delete its device in Gladys if you no longer want it.',
    fr: 'Arrêt retiré : {name}. Supprimez son appareil dans Gladys si vous n’en voulez plus.',
    de: 'Haltestelle entfernt: {name}. Lösche ihr Gerät in Gladys, wenn du es nicht mehr brauchst.',
    es: 'Parada quitada: {name}. Borra su dispositivo en Gladys si ya no lo quieres.',
  },
  stopRemoveUnknown: {
    en: 'No added stop matches "{query}": type its number given by "List the stops".',
    fr: 'Aucun arrêt ajouté ne correspond à « {query} » : saisissez son numéro donné par « Lister les arrêts ».',
    de: 'Keine hinzugefügte Haltestelle passt zu „{query}“: gib ihre Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Ninguna parada añadida coincide con «{query}»: escribe su número dado por «Listar las paradas».',
  },
  stopRemoveAmbiguous: {
    en: 'Several added stops match "{query}": type the number given by "List the stops".',
    fr: 'Plusieurs arrêts ajoutés correspondent à « {query} » : saisissez le numéro donné par « Lister les arrêts ».',
    de: 'Mehrere hinzugefügte Haltestellen passen zu „{query}“: gib die Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Varias paradas añadidas coinciden con «{query}»: escribe el número dado por «Listar las paradas».',
  },
  stopInForm: {
    en: '{name} is stop {slot} of the form: empty its field, then save the configuration.',
    fr: '{name} est l’arrêt {slot} du formulaire : videz son champ, puis enregistrez la configuration.',
    de: '{name} ist Haltestelle {slot} des Formulars: leere ihr Feld und speichere dann die Konfiguration.',
    es: '{name} es la parada {slot} del formulario: vacía su campo y guarda la configuración.',
  },
  stopsNone: {
    en: 'No stop followed yet: fill in a stop of the form or press "Add a stop".',
    fr: 'Aucun arrêt suivi pour l’instant : remplissez un arrêt du formulaire ou appuyez sur « Ajouter un arrêt ».',
    de: 'Noch keine Haltestelle verfolgt: fülle eine Haltestelle im Formular aus oder drücke „Haltestelle hinzufügen“.',
    es: 'Aún no se sigue ninguna parada: rellena una parada del formulario o pulsa «Añadir una parada».',
  },
  stopsList: {
    en: '{count} stop(s) followed:\n{list}',
    fr: '{count} arrêt(s) suivi(s) :\n{list}',
    de: '{count} Haltestelle(n) verfolgt:\n{list}',
    es: '{count} parada(s) seguida(s):\n{list}',
  },
  stopFromForm: {
    en: 'form, stop {slot}',
    fr: 'formulaire, arrêt {slot}',
    de: 'Formular, Haltestelle {slot}',
    es: 'formulario, parada {slot}',
  },
  stopUnknownMark: {
    en: 'unknown or ambiguous',
    fr: 'inconnu ou ambigu',
    de: 'unbekannt oder mehrdeutig',
    es: 'desconocido o ambiguo',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({count} line(s) starting with "Lignes d’Azur diagnostic").',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({count} ligne(s) commençant par « Lignes d’Azur diagnostic »).',
    de: 'Diagnose in den Tab Protokolle geschrieben ({count} Zeile(n), beginnend mit „Lignes d’Azur diagnostic“).',
    es: 'Diagnóstico escrito en la pestaña Registros ({count} línea(s) que empiezan por «Lignes d’Azur diagnostic»).',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('inMinutes', 'fr', { n: 3 }); // -> 'dans 3 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description When a passage comes, in a sentence: "in 3 min", "at 10:32".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The words.
 */
function passageWhen(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return t('atTime', language, { time: formatTime(passage.at, timeZone) });
  }
  return minutes === 0
    ? t('approaching', language).toLowerCase()
    : t('inMinutes', language, { n: minutes });
}

/**
 * @description The short time of a passage, as on the screens of the stops:
 * "3 min", "10:32", "Approaching".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The time.
 */
function passageShort(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return formatTime(passage.at, timeZone);
  }
  return minutes === 0 ? t('approaching', language) : t('minutesValue', language, { n: minutes });
}

/**
 * @description One line for a passage: "L2 → Aéroport · 3 min (+2 min de retard)".
 * @param {object|null} passage - The passage, null when none.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The text.
 */
function passageText(passage, options) {
  if (!passage) {
    return t('noPassage', options.language);
  }
  const head = passage.destination ? `${passage.line} → ${passage.destination}` : passage.line;
  let mark = '';
  if (!passage.realtime) {
    mark = ` ${t('scheduledMark', options.language)}`;
  } else if (passage.delay > 0) {
    mark = ` ${t('lateMark', options.language, { n: passage.delay })}`;
  }
  return `${head} · ${passageShort(passage, options)}${mark}`;
}

export { LANGUAGES, BRAND, TEXTS, isLanguage, t, all, passageWhen, passageShort, passageText };
