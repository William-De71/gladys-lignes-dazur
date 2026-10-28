// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildDeparturesWidget,
  messageContent,
  readCount,
  routeValue,
  WIDGETS,
  BOARD_COUNT,
} from '../src/widgets.js';
import { LANGUAGES } from '../src/i18n.js';
import { NOW, TZ, passage, fixturePassages } from './helpers/fixtures.js';

const JEAN = await fixturePassages('Jean Médecin');

/**
 * @description Assert that the core would keep the content whole.
 * @param {object} content - The content.
 * @param {string} label - For the message.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
}

test('departures widget: one compact row per route, soonest first, in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildDeparturesWidget({
      title: 'Jean Médecin',
      passages: JEAN,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    });
    assertValid(content, language);
    const [heading, caption, status] = content.components;
    assert.equal(heading.text, 'Jean Médecin');
    assert.match(caption.text, /^Lignes d’Azur · .*10:37/);
    assert.equal(status.items.length, 6);
  }
  const fr = buildDeparturesWidget({
    title: 'Jean Médecin',
    passages: JEAN,
    readAt: NOW,
    count: 4,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assert.deepEqual(
    fr.components[2].items.map((item) => [item.label, item.value]),
    [
      ['L1 → Hôpital Pasteur', 'À l’approche · 4 · 9 min'],
      ['L1 → Henri Sappia', 'À l’approche · 5 · 10 min'],
      ['L2 → Port Lympia', '1 · 4 · 21 · 31 · 41 · 51 min'],
      ['L2 → Aéroport Terminal 2', '3 · 13 · 26 · 36 min'],
    ],
  );
});

test('departures widget: a cancelled trip and a late one colour their row', () => {
  const passages = [
    passage({ time: '10:42', cancelled: true, trip: 'C1' }),
    passage({ time: '10:49', trip: 'C2' }),
    passage({ time: '10:39', line: '15', destination: 'Lycée Masséna', delay: 6 }),
    passage({ time: '10:43', line: 'L2', destination: 'Aéroport Terminal 2' }),
  ].sort((a, b) => a.at - b.at);
  const content = buildDeparturesWidget({
    title: 'Masséna',
    passages,
    readAt: NOW,
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'troubled');
  assert.deepEqual(
    content.components[2].items.map((item) => [item.label, item.value, item.color]),
    [
      ['L2 → Aéroport Terminal 2', '5 min', 'success'],
      ['15 → Lycée Masséna', '7 min', 'warning'],
      ['L1 → Hôpital Pasteur', 'supprimé 10:42 · 11 min', 'warning'],
    ],
  );
});

test('departures widget: times beyond an hour, nothing announced', () => {
  const options = { language: 'en', now: NOW, timeZone: TZ };
  const late = [passage({ time: '10:43' }), passage({ time: '24:10', realtime: false })];
  assert.equal(routeValue(late, options), '5 min · 00:10');
  const empty = buildDeparturesWidget({
    title: 'Le Château',
    passages: [],
    readAt: NOW,
    count: 6,
    language: 'de',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(empty, 'empty');
  assert.equal(
    empty.components[1].text,
    'Keine Abfahrt angekündigt. Lignes d’Azur · aktualisiert um 10:37.',
  );
  assert.equal(empty.ttl_seconds, 300);
});

test('departures widget: several stops in one list, a row per stop then its routes', () => {
  const content = buildDeparturesWidget({
    boards: [
      { title: 'Jean Médecin', label: 'Jean Médecin', passages: JEAN, readAt: NOW },
      { title: 'Le Château', label: 'Le Château', passages: [], readAt: NOW - 60000 },
    ],
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'several');
  const [heading, caption, status] = content.components;
  assert.equal(heading.text, 'Jean Médecin · Le Château');
  assert.equal(caption.text, 'Lignes d’Azur');
  assert.equal(status.items[0].icon, 'map-pin');
  assert.equal(status.items[0].value, 'lu à 10:37');
  assert.equal(status.items.at(-1).value, 'Aucun passage annoncé');
  assert.ok(status.items.length <= 10);
});

test('messages and settings; the departures widget only', () => {
  assert.deepEqual(WIDGETS, { DEPARTURES: 'departures' });
  assertValid(messageContent('Hello'), 'message');
  assert.equal(readCount(undefined, BOARD_COUNT), BOARD_COUNT.default);
  assert.equal(readCount('99', BOARD_COUNT), BOARD_COUNT.max);
  assert.equal(readCount(0, BOARD_COUNT), BOARD_COUNT.min);
});
