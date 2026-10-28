import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  fold,
  slug,
  lineOf,
  byLine,
  distance,
  groupStops,
  findLine,
  findStop,
  searchStops,
  gtfsDate,
  createNetwork,
  MODES,
} from '../src/network.js';
import { readGtfs } from '../src/gtfs.js';
import { createRlaClient } from '../src/rla-api.js';
import { createStore } from '../src/store.js';
import { newDaySince } from '../src/time.js';
import {
  GTFS_ZIP,
  NOW,
  TZ,
  LAST_MODIFIED,
  GTFS_URL,
  TRIP_UPDATES_URL,
  fakeRla,
  storePath,
  silent,
} from './helpers/fixtures.js';

const reference = await readGtfs(GTFS_ZIP);
const lines = reference.routes.map(lineOf).sort(byLine);
const stops = groupStops(reference.stops, reference.linesByStop);

test('names folded for comparisons, slugs for the ids', () => {
  assert.equal(fold('Gare Thiers / Poste'), 'gare thiers poste');
  assert.equal(fold('Carlone/Madeleine'), fold('Carlone / Madeleine'));
  assert.equal(slug('Garibaldi / Le Château'), 'garibaldi-le-chateau');
  assert.equal(gtfsDate(NOW, TZ), '20261028');
});

test('lines: route id, public name, mode and colour, trams first', () => {
  assert.deepEqual(
    lines.find((line) => line.id === 'L1'),
    {
      id: 'L1',
      name: 'L1',
      longName: 'Hôpital Pasteur - Henri Sappia',
      mode: MODES.TRAM,
      color: '#D20A11',
    },
  );
  // "08" reads "8+" (its short name), "05" would read "5".
  assert.equal(lines.find((line) => line.id === '08').name, '8+');
  assert.equal(lineOf({ id: '05', shortName: '05', type: 3 }).name, '5');
  assert.equal(lines.length, 17);
  assert.deepEqual(
    lines.slice(0, 6).map((line) => [line.id, line.mode]),
    [
      ['B', 'tram'],
      ['L1', 'tram'],
      ['L2', 'tram'],
      ['L3', 'tram'],
      ['08', 'bus'],
      ['12', 'bus'],
    ],
  );
});

test('a line is typed the way users read it', () => {
  const id = (typed) => findLine(lines, typed)?.id ?? null;
  assert.equal(id('L1'), 'L1');
  assert.equal(id('l2'), 'L2');
  assert.equal(id('tram 1'), 'L1');
  assert.equal(id('Tramway 3'), 'L3');
  assert.equal(id('T2'), 'L2');
  assert.equal(id('1'), 'L1');
  assert.equal(id('tram b'), 'B');
  assert.equal(id('ligne 15'), '15');
  assert.equal(id('bus 99'), '99');
  // The plus of "8+" and "12+" is not needed.
  assert.equal(id('8'), '08');
  assert.equal(id('8+'), '08');
  assert.equal(id('ligne 08'), '08');
  assert.equal(id('12'), '12');
  assert.equal(id('Z9'), null);
  assert.equal(id('tram 15'), null);
  assert.equal(id(''), null);
  // "5" and "ligne 05" are the bus 05, displayed "5".
  const five = [lineOf({ id: '05', shortName: '05', type: 3 }), ...lines];
  assert.equal(findLine(five, '5')?.id, '05');
  assert.equal(findLine(five, 'ligne 05')?.id, '05');
});

test('stops: the platforms of one name in one place, their codes and lines', () => {
  assert.equal(stops.length, 343);
  const massena = stops.find((stop) => stop.name === 'Masséna');
  assert.deepEqual(massena, {
    code: 'massena',
    name: 'Masséna',
    ids: ['2522', '2523', '10543'],
    platforms: ['MASSE0', 'MASSE2', 'MASSV7'],
    lines: ['L1', '12', '08'],
    lat: massena.lat,
    lon: massena.lon,
  });
  assert.ok(Math.abs(massena.lat - 43.698) < 0.01 && Math.abs(massena.lon - 7.27) < 0.01);
  // Le Château of Cagnes and Le Château of Nice: two places, two stops.
  assert.deepEqual(
    stops.filter((stop) => stop.name === 'Le Château').map((stop) => [stop.code, stop.platforms]),
    [
      ['le-chateau', ['CACHT1']],
      ['le-chateau-2', ['LACHT1', 'LACHT2']],
    ],
  );
  // Every code is unique.
  assert.equal(new Set(stops.map((stop) => stop.code)).size, stops.length);
});

test('places: one name close by is one stop, far apart two; spellings merged', () => {
  const at = (id, name, lat, lon) => ({ id, code: id, name, lat, lon });
  const grouped = groupStops(
    [
      at('A1', 'Carlone / Madeleine', 43.7, 7.24),
      at('A2', 'Carlone/Madeleine', 43.7, 7.241),
      at('A3', 'Carlone / Madeleine', 43.7, 7.2415),
      // A platform between two places joins them (chained within 500 m).
      at('B1', 'Château', 43.65, 7.1),
      at('B3', 'Château', 43.65, 7.11),
      at('B2', 'Château', 43.65, 7.105),
      at('C1', 'Chateau', 43.75, 7.3),
    ],
    { A2: ['10'], B1: ['20'] },
  );
  assert.deepEqual(
    grouped.map((stop) => [stop.code, stop.name, stop.ids, stop.lines]),
    [
      ['carlone-madeleine', 'Carlone / Madeleine', ['A1', 'A2', 'A3'], ['10']],
      // Sorted by name, the plain spelling first.
      ['chateau-2', 'Chateau', ['C1'], []],
      ['chateau', 'Château', ['B1', 'B2', 'B3'], ['20']],
    ],
  );
  // 0.005° of longitude at 43.65° N: about 400 m.
  assert.ok(Math.abs(distance(at('', '', 43.65, 7.1), at('', '', 43.65, 7.105)) - 402) < 5);
});

test('a stop is typed by its name, a few of its words or a platform code', () => {
  const code = (typed) => findStop(stops, typed)?.code ?? null;
  assert.equal(code('massena'), 'massena');
  assert.equal(code('Gare Thiers / Poste'), 'gare-thiers-poste');
  assert.equal(code('gare thiers poste'), 'gare-thiers-poste');
  assert.equal(code('JEAN MEDECIN'), 'jean-medecin');
  assert.equal(code('aeroport terminal 2'), 'aeroport-terminal-2');
  // A platform code, in any case.
  assert.equal(code('MASSE2'), 'massena');
  assert.equal(code('garib3'), 'garibaldi');
  // Two places named Le Château: their codes say which.
  assert.equal(code('Le Château'), null);
  assert.equal(code('le-chateau-2'), 'le-chateau-2');
  assert.equal(code('LACHT1'), 'le-chateau-2');
  // Several stops hold "gare": the user says which.
  assert.equal(code('gare'), null);
  assert.equal(code('Nulle part'), null);
  assert.equal(code(''), null);
  assert.deepEqual(
    searchStops(stops, 'massena').map((stop) => stop.name),
    ['Masséna', 'Masséna / Guitry', 'Lycée Masséna'],
  );
  assert.deepEqual(searchStops(stops, '  '), []);
});

/**
 * @description A network on the fake Lignes d'Azur, with its store.
 * @param {object} [options] - `{ path, clock }`.
 * @returns {Promise<object>} `{ network, api, fetch, store, clock, path }`.
 */
async function network({ path = storePath(), clock = { now: NOW } } = {}) {
  const fetch = fakeRla();
  const api = createRlaClient({
    fetch,
    now: () => clock.now,
    gtfsUrl: GTFS_URL,
    tripUpdatesUrl: TRIP_UPDATES_URL,
  });
  const store = createStore({ path });
  await store.load();
  return {
    network: createNetwork({
      api,
      store,
      zipPath: join(dirname(path), 'lignes-dazur-gtfs.zip'),
      now: () => clock.now,
      isNewDay: (since) => newDaySince(since, clock.now, TZ),
      timeZone: TZ,
      logger: silent,
    }),
    api,
    fetch,
    store,
    clock,
    path,
  };
}

test('the timetable is read once, kept with the zip, asked again daily (304)', async () => {
  const first = await network();
  assert.equal((await first.network.lines()).length, 17);
  assert.equal((await first.network.stops()).length, 343);
  await first.network.resolveStop('massena');
  assert.equal(first.fetch.calls.length, 1);
  assert.equal(first.store.data.network.lastModified, LAST_MODIFIED);
  assert.ok(existsSync(join(dirname(first.path), 'lignes-dazur-gtfs.zip')));
  // A restart: the store and the zip, nothing downloaded.
  const restart = await network({ path: first.path });
  assert.equal((await restart.network.resolveLine('tram 2')).id, 'L2');
  assert.equal(restart.fetch.calls.length, 0);
  // The next day: asked again with If-Modified-Since, unchanged.
  restart.clock.now = NOW + 24 * 3600 * 1000;
  await restart.network.lines();
  assert.deepEqual(restart.fetch.calls, [{ path: GTFS_URL, since: LAST_MODIFIED }]);
  assert.equal(restart.api.requests.notModified, 1);
  // A failure keeps what is known.
  restart.fetch.state.fail = 503;
  assert.equal((await restart.network.lines(true)).length, 17);
});

test('without anything kept, a failure is an error', async () => {
  const { network: net, fetch } = await network();
  fetch.state.fail = 'network';
  await assert.rejects(net.lines(), { kind: 'unreachable' });
});

test('the timetable of the stops: built from the zip, kept while it holds them', async () => {
  const { network: net } = await network();
  const massena = await net.resolveStop('massena');
  const gare = await net.resolveStop('gare thiers poste');
  const first = await net.timetable([massena]);
  assert.deepEqual(first.codes, ['massena']);
  assert.equal(first.from, '20261027');
  assert.equal(first.to, '20261103');
  assert.ok(first.rows.length > 20);
  assert.ok(first.rows.every(([, stopId]) => massena.ids.includes(stopId)));
  // Kept as is for the same stop.
  assert.equal(await net.timetable([massena]), first);
  // Another stop: both.
  const both = await net.timetable([gare]);
  assert.deepEqual(both.codes, ['massena', 'gare-thiers-poste']);
  assert.equal(net.describeTimetable().stops.length, 2);
  // The lines of the whole stop of a platform.
  assert.deepEqual(net.linesOfPlatform('2608'), ['L1', '99', '38', 'L2', 'L3']);
  assert.equal(net.peekLine('08').name, '8+');
});
