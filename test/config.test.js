import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readLanguage,
  readInterval,
  parseAddedStops,
  DEFAULT_INTERVAL,
  MAX_ADDED_STOPS,
} from '../src/config.js';

test('stops, interval and language from the raw config', () => {
  const config = normalizeConfig({
    stop_1: ' Masséna ',
    stop_1_line: 'L1',
    stop_1_direction: 'Hôpital Pasteur',
    stop_2: '',
    stop_3: 'garibaldi',
    interval: '30',
    language: 'de',
  });
  assert.deepEqual(config, {
    stops: [
      { slot: 1, stop: 'Masséna', line: 'L1', direction: 'Hôpital Pasteur' },
      { slot: 3, stop: 'garibaldi', line: '', direction: '' },
    ],
    addedStops: [],
    interval: 30,
    language: 'de',
  });
  assert.deepEqual(normalizeConfig(null), {
    stops: [],
    addedStops: [],
    interval: DEFAULT_INTERVAL,
    language: 'auto',
  });
});

test('bounds: the intervals offered, the stored language', () => {
  assert.equal(readInterval(45), DEFAULT_INTERVAL);
  assert.equal(readInterval(300), 300);
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'fr'), 'fr');
  assert.equal(readLanguage(undefined, 'en'), 'en');
});

test('the stops added with the buttons follow the three of the form', () => {
  const added = [
    { stop: 'massena', line: 'L2', direction: '' },
    { stop: ' Garibaldi ', line: '', direction: 'Aéroport' },
    { stop: '', line: 'B' },
    'Garibaldi',
  ];
  const config = normalizeConfig({ stop_2: 'Jean Médecin', added_stops: added });
  assert.deepEqual(config.stops, [
    { slot: 2, stop: 'Jean Médecin', line: '', direction: '' },
    { slot: null, added: 1, stop: 'massena', line: 'L2', direction: '' },
    { slot: null, added: 2, stop: 'Garibaldi', line: '', direction: 'Aéroport' },
  ]);
  assert.equal(config.addedStops.length, 2);
  // Stored as JSON text by an older core: read the same.
  assert.deepEqual(parseAddedStops(JSON.stringify(added)), config.addedStops);
  assert.deepEqual(parseAddedStops('not json'), []);
  assert.deepEqual(parseAddedStops(undefined), []);
  const many = Array.from({ length: 20 }, (_, n) => ({ stop: `S${n}` }));
  assert.equal(parseAddedStops(many).length, MAX_ADDED_STOPS);
});
