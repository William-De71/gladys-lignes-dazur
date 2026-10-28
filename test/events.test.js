// Scene triggers fire once per transition, with flat payloads within the
// limits of the core; scene actions return their declared outputs only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detectReminders,
  detectCancellations,
  reminderData,
  cancelledData,
  nextDeparturesOutputs,
  pick,
  tolerance,
  TRIGGERS,
  REMINDER_MINUTES,
  NEXT_DEPARTURES_OUTPUTS,
} from '../src/events.js';
import { LANGUAGES } from '../src/i18n.js';
import { NOW, TZ, passage } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const FOLLOWED = {
  name: 'Masséna (L1 → Hôpital Pasteur)',
  deviceId: 'ext:lignes-dazur:stop:massena_l1_hopital-pasteur',
  stop: { code: 'massena', name: 'Masséna' },
};
const MINUTE = 60 * 1000;

/**
 * @description Assert that event data is flat and within the limits of the core.
 * @param {object} data - The data.
 * @param {string} key - The trigger key.
 */
function assertPayload(data, key) {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  assert.ok(trigger, key);
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key}.${name}`,
    );
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000, `${key}.${name}`);
    }
  }
  // Every variable is in the data, and every field filters a key of it.
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key}: variable ${variable.key}`);
  }
  for (const field of trigger.fields) {
    assert.ok(field.key in data, `${key}: field ${field.key}`);
  }
}

test('reminders: once per passage and mark, never on the first reading', () => {
  // 10:42:14 in Paris: 4 min 40 s after 10:37:34.
  const passages = [passage({ time: '10:42:14', trip: 'T1@20261028' })];
  // First reading of the stop: a baseline.
  const first = detectReminders({ passages, fired: undefined, now: NOW });
  assert.deepEqual(first.due, []);
  assert.equal(first.fired.length, 1);
  // 4 min 40 s before: the 5-minute mark, once.
  const memory = detectReminders({ passages, fired: [], now: NOW });
  assert.deepEqual(
    memory.due.map((entry) => entry.mark),
    [5],
  );
  const again = detectReminders({ passages, fired: memory.fired, now: NOW + 10000 });
  assert.deepEqual(again.due, []);
  // The same trip announced later (a delay) is the same passage: no new 5.
  const later = [passage({ time: '10:42:14', delay: 1, trip: 'T1@20261028' })];
  assert.deepEqual(detectReminders({ passages: later, fired: memory.fired, now: NOW }).due, []);
  // Old reminders are forgotten.
  const forgotten = detectReminders({ passages: [], fired: memory.fired, now: NOW + 20 * MINUTE });
  assert.deepEqual(forgotten.fired, []);
  assert.deepEqual(REMINDER_MINUTES.map(tolerance), [1, 1, 1.5, 3, 3, 3]);
});

test('cancellations: once per trip, within the hour, never on the first reading', () => {
  const passages = [
    passage({ time: '10:48', cancelled: true, trip: 'C1' }),
    passage({ time: '11:53', cancelled: true, trip: 'C2' }),
    passage({ time: '10:54', trip: 'C3' }),
  ];
  assert.deepEqual(detectCancellations({ passages, known: undefined, now: NOW }).due, []);
  const first = detectCancellations({ passages, known: [], now: NOW });
  assert.deepEqual(
    first.due.map((entry) => entry.trip),
    ['C1'],
  );
  assert.deepEqual(detectCancellations({ passages, known: first.known, now: NOW }).due, []);
  for (const language of LANGUAGES) {
    assertPayload(
      cancelledData(FOLLOWED, first.due[0], { language, timeZone: TZ }),
      TRIGGERS.DEPARTURE_CANCELLED,
    );
  }
  assert.equal(
    cancelledData(FOLLOWED, first.due[0], { language: 'fr', timeZone: TZ }).summary,
    'Le L1 de 10:48 vers Hôpital Pasteur à Masséna est supprimé.',
  );
});

test('departure soon: a flat payload, its summary in every language', () => {
  const late = passage({ time: '10:43', delay: 3 });
  for (const language of LANGUAGES) {
    const data = reminderData(FOLLOWED, late, 5, { language, timeZone: TZ });
    assertPayload(data, TRIGGERS.DEPARTURE_SOON);
    assert.equal(data.minutes, '5');
    assert.equal(data.time, '10:46');
    assert.equal(data.delay_minutes, 3);
  }
  assert.equal(
    reminderData(FOLLOWED, late, 5, { language: 'fr', timeZone: TZ }).summary,
    'L1 vers Hôpital Pasteur passe à Masséna dans 5 min (10:46, 3 min de retard).',
  );
  assert.equal(
    reminderData(FOLLOWED, passage({ time: '10:43' }), 5, { language: 'en', timeZone: TZ }).summary,
    'L1 towards Hôpital Pasteur leaves Masséna in 5 min (10:43).',
  );
  // Announced early: no negative delay in the summary.
  const early = reminderData(FOLLOWED, passage({ time: '10:43', delay: -2 }), 3, {
    language: 'en',
    timeZone: TZ,
  });
  assert.equal(early.summary, 'L1 towards Hôpital Pasteur leaves Masséna in 3 min (10:41).');
});

test('only the departure triggers: Lignes d’Azur publishes no traffic', () => {
  assert.deepEqual(Object.values(TRIGGERS), ['departure_soon', 'departure_cancelled']);
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key),
    Object.values(TRIGGERS),
  );
});

test('scene action outputs: declared keys only, flat values', () => {
  const declared = (key) =>
    manifest.scene_actions.find((action) => action.key === key).outputs.map((output) => output.key);
  assert.deepEqual(NEXT_DEPARTURES_OUTPUTS, declared('get_next_departures'));
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key),
    ['get_next_departures'],
  );
  const passages = [
    passage({ time: '10:44', delay: 2 }),
    passage({ time: '11:00', realtime: false }),
  ];
  const next = pick(
    nextDeparturesOutputs({ followed: FOLLOWED, passages, now: NOW, language: 'en', timeZone: TZ }),
    NEXT_DEPARTURES_OUTPUTS,
  );
  assert.deepEqual(
    [
      next.found,
      next.line,
      next.minutes,
      next.time,
      next.realtime,
      next.delay_minutes,
      next.following_minutes,
    ],
    [true, 'L1', 8, '10:46', true, 2, 22],
  );
  assert.equal(
    next.summary,
    'Next passage at Masséna: L1 towards Hôpital Pasteur in 8 min. The following one in 22 min.',
  );
  const none = nextDeparturesOutputs({
    followed: FOLLOWED,
    passages: [],
    now: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assert.deepEqual([none.found, none.minutes, none.time, none.realtime], [false, -1, '', false]);
  assert.equal(none.summary, 'No passage announced at Masséna.');
  for (const value of Object.values(next)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value));
  }
});
