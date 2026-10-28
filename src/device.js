// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// "Lignes d'Azur <stop> (<line> → <direction>)": one per followed stop.
// Read-only features:
//   - `next`        text: the next passage, "L2 → Aéroport · 3 min (+2)";
//   - `wait`        duration (minutes): the wait of the next passage;
//   - `following`   duration (minutes): the wait of the one after;
//   - `delay`       duration (minutes): the delay of the next passage, when
//                   it is followed in real time (an early one counts 0).
//
// The network publishes no traffic alerts: there is no line device.
//
// External ids: the code of the stop (the slug of its name, `massena`), then
// the route id and the direction
// (`ext:lignes-dazur:stop:massena_l1_hopital`).
// `should_poll` stays false: the integration reads on its own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { t, passageText } from './i18n.js';
import { slug } from './network.js';
import { minutesLeft, upcomingPassages } from './departures.js';

const DEVICE_TYPES = { STOP: 'stop' };
const FEATURE_KEYS = {
  NEXT: 'next',
  WAIT: 'wait',
  FOLLOWING: 'following',
  DELAY: 'delay',
};
const MAX_WAIT = 180;
const MAX_DELAY = 120;
const TEXT_MAX = 250;

/**
 * @description A code as a part of an external id.
 * @param {string} code - "massena", "L1", "Exp2".
 * @returns {string} "massena", "l1", "exp2".
 */
const codeKey = (code) =>
  String(code)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * @description The identifier of a followed stop.
 * @param {{ code: string }} stop - The resolved stop.
 * @param {{ id: string }|null} line - The resolved line, when set.
 * @param {string} direction - The direction typed, '' when none.
 * @returns {string} "massena_l1_hopital".
 * @example
 * stopKey({ code: 'massena' }, { id: 'L1' }, ''); // 'massena_l1'
 */
function stopKey(stop, line, direction) {
  const parts = [codeKey(stop.code)];
  if (line) {
    parts.push(codeKey(line.id));
  }
  const words = slug(direction, 24);
  if (words) {
    parts.push(words);
  }
  return parts.join('_');
}

/**
 * @description The name of a followed stop: "Masséna (L1 → Hôpital)".
 * @param {object} followed - `{ stop, line, direction }`.
 * @returns {string} The name.
 */
function followedName({ stop, line, direction }) {
  const detail = [line?.name, direction && `→ ${direction}`].filter(Boolean).join(' ');
  return detail ? `${stop.name} (${detail})` : stop.name;
}

/**
 * @description The external ids of a followed stop.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} type - DEVICE_TYPES.
 * @param {string} key - The stop key.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, type, key) => gladys.externalIds(type, String(key).toLowerCase());

/**
 * @description What a device external id stands for.
 * @param {unknown} externalId - A device (or feature) external id.
 * @returns {{ type: string, key: string }|null} The type and key.
 * @example
 * parseExternalId('ext:lignes-dazur:stop:massena_l1'); // -> { type: 'stop', key: 'massena_l1' }
 */
function parseExternalId(externalId) {
  // A feature id ends with ":<feature key>": the device key stops before it.
  const match = /:(stop):([a-z0-9_-]+)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? { type: match[1], key: match[2] } : null;
}

/**
 * @description A read-only feature.
 * @param {object} feature - Its fields.
 * @returns {object} The feature.
 */
const sensor = (feature) => ({
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...feature,
});

const textShape = {
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  keep_history: false,
  min: 0,
  max: 0,
};
const minutesShape = {
  category: DEVICE_FEATURE_CATEGORIES.DURATION,
  type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
  unit: DEVICE_FEATURE_UNITS.MINUTES,
  keep_history: false,
  min: 0,
  max: MAX_WAIT,
};
const delayShape = {
  category: DEVICE_FEATURE_CATEGORIES.DURATION,
  type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
  unit: DEVICE_FEATURE_UNITS.MINUTES,
  keep_history: true,
  min: 0,
  max: MAX_DELAY,
};

/**
 * @description Build the device of a followed stop.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} followed - The followed stop (`key`, `name`, `stop`, `line`).
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildStopDevice(gladys, followed, language = 'en') {
  const ids = idsOf(gladys, DEVICE_TYPES.STOP, followed.key);
  const params = [{ name: 'RLA_STOP', value: followed.stop.name }];
  if (followed.line) {
    params.push({ name: 'RLA_LINE', value: followed.line.name });
  }
  if (followed.direction) {
    params.push({ name: 'RLA_DIRECTION', value: followed.direction });
  }
  return {
    name: t('stopDeviceName', language, { stop: followed.name }),
    external_id: ids.device,
    model: "Lignes d'Azur",
    should_poll: false,
    params,
    features: [
      sensor({
        name: t('featureNext', language),
        external_id: ids.feature(FEATURE_KEYS.NEXT),
        ...textShape,
      }),
      sensor({
        name: t('featureWait', language),
        external_id: ids.feature(FEATURE_KEYS.WAIT),
        ...minutesShape,
      }),
      sensor({
        name: t('featureFollowing', language),
        external_id: ids.feature(FEATURE_KEYS.FOLLOWING),
        ...minutesShape,
      }),
      sensor({
        name: t('featureDelay', language),
        external_id: ids.feature(FEATURE_KEYS.DELAY),
        ...delayShape,
      }),
    ],
  };
}

/**
 * @description The states of a followed stop. Without a passage (the night),
 * the waits are left untouched: a 0 would fake a bus now; the delay too
 * when the next passage is the timetable only.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} followed - The followed stop.
 * @param {object[]} passages - Its passages (buildPassages).
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {object[]} The states.
 */
function buildStopStates(gladys, followed, passages, { language, now, timeZone }) {
  const ids = idsOf(gladys, DEVICE_TYPES.STOP, followed.key);
  const upcoming = upcomingPassages(passages, now);
  const states = [
    {
      device_feature_external_id: ids.feature(FEATURE_KEYS.NEXT),
      text: (upcoming[0]
        ? passageText(upcoming[0], { language, now, timeZone })
        : t('noPassage', language)
      ).slice(0, TEXT_MAX),
    },
  ];
  [FEATURE_KEYS.WAIT, FEATURE_KEYS.FOLLOWING].forEach((key, index) => {
    if (upcoming[index]) {
      states.push({
        device_feature_external_id: ids.feature(key),
        state: Math.min(MAX_WAIT, minutesLeft(upcoming[index], now)),
      });
    }
  });
  if (upcoming[0]?.realtime) {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_KEYS.DELAY),
      state: Math.min(MAX_DELAY, Math.max(0, upcoming[0].delay)),
    });
  }
  return states;
}

export {
  DEVICE_TYPES,
  FEATURE_KEYS,
  MAX_WAIT,
  MAX_DELAY,
  codeKey,
  stopKey,
  followedName,
  idsOf,
  parseExternalId,
  buildStopDevice,
  buildStopStates,
};
