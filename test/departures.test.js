import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  directionTerms,
  serviceStart,
  indexTripUpdates,
  applyRealtime,
  buildPassages,
  minutesLeft,
  upcomingPassages,
  cancelledPassages,
  routeOf,
} from '../src/departures.js';
import { decodeFeed } from '../src/gtfs-rt.js';
import { NOW, encodeFeed, paris, passage, fixturePassages } from './helpers/fixtures.js';

const MINUTE = 60 * 1000;
const index = (tripUpdates) => indexTripUpdates(decodeFeed(encodeFeed({ tripUpdates })));

test('GTFS times count from noon minus 12 hours, even when the clocks change', () => {
  assert.equal(serviceStart('20261027'), Date.parse('2026-10-26T23:00:00Z'));
  // 25 October 2026: back to winter time at 03:00. Noon minus 12 hours is
  // 01:00 summer time, not midnight.
  assert.equal(serviceStart('20261025'), Date.parse('2026-10-24T23:00:00Z'));
  assert.deepEqual(directionTerms('Aéroport | Port Lympia'), ['aeroport', 'port lympia']);
  assert.deepEqual(directionTerms(''), []);
});

test('real time: the estimate of the platform, the closest one on a loop line', () => {
  const scheduled = paris('10:50');
  const at = (minutes) => (scheduled + minutes * MINUTE) / 1000;
  const updates = index([
    {
      tripId: 'T_1',
      stops: [
        { stopId: '2522', sequence: 1, time: at(-40), delay: 0 },
        { stopId: '2514', sequence: 2, time: at(-5), delay: 30 },
        { stopId: '2522', sequence: 3, time: at(3), delay: 120 },
      ],
    },
    { tripId: 'T_2', cancelled: true },
    { tripId: 'T_3', stops: [{ stopId: '2522', sequence: 4, skipped: true }] },
    // Lignes d'Azur: times only.
    { tripId: 'T_4', stops: [{ stopId: '2522', sequence: 5, time: at(-4) }] },
  ]);
  assert.deepEqual(applyRealtime(updates.get('T_1'), '2522', scheduled, NOW), {
    at: scheduled + 3 * MINUTE,
    realtime: true,
    cancelled: false,
  });
  // No estimate for this platform: the delay of the platform before it.
  assert.deepEqual(applyRealtime(updates.get('T_1'), '2999', scheduled, NOW), {
    at: scheduled + 30000,
    realtime: true,
    cancelled: false,
  });
  assert.equal(applyRealtime(updates.get('T_2'), '2522', scheduled, NOW).cancelled, true);
  // A cancelled trip of today says nothing of tomorrow.
  assert.equal(
    applyRealtime(updates.get('T_2'), '2522', scheduled + 24 * 60 * MINUTE, NOW).cancelled,
    false,
  );
  assert.equal(applyRealtime(updates.get('T_3'), '2522', scheduled, NOW).cancelled, true);
  // A time without a delay: announced early, the passage keeps its estimate.
  assert.deepEqual(applyRealtime(updates.get('T_4'), '2522', scheduled, NOW), {
    at: scheduled - 4 * MINUTE,
    realtime: true,
    cancelled: false,
  });
  // Without a delay, a platform without its own estimate stays on the timetable.
  assert.equal(applyRealtime(updates.get('T_4'), '2999', scheduled, NOW).realtime, false);
  // No update, or one of another day: the timetable only.
  assert.deepEqual(applyRealtime(undefined, '2522', scheduled, NOW), {
    at: scheduled,
    realtime: false,
    cancelled: false,
  });
  assert.equal(
    applyRealtime(updates.get('T_1'), '2522', scheduled + 24 * 60 * MINUTE, NOW).realtime,
    false,
  );
});

test('the passages of a real stop: timetable, real time, filters', async () => {
  const jean = await fixturePassages('Jean Médecin');
  assert.equal(jean.length, 41);
  assert.ok(jean.every((p, i) => i === 0 || jean[i - 1].at <= p.at));
  // The trams in service are followed; the later ones are the timetable.
  const [first] = jean;
  assert.deepEqual(
    [first.line, first.destination, first.realtime, first.delay, minutesLeft(first, NOW)],
    ['L1', 'Hôpital Pasteur', true, -5, 0],
  );
  assert.ok(jean.some((p) => !p.realtime) && jean.some((p) => p.realtime && p.delay > 0));
  // The trams run to a frequency: many are announced early.
  assert.ok(jean.filter((p) => p.realtime && p.delay < 0).length > 5);
  assert.ok(jean.every((p) => p.at > NOW - 30000 && p.at <= NOW + 24 * 60 * MINUTE));
  // The next three hours, eight per route at most.
  const routes = Map.groupBy(jean, routeOf);
  assert.ok([...routes.values()].every((list) => list.length <= 8));
  const timetable = await fixturePassages('Jean Médecin', { realtime: false });
  assert.ok(timetable.every((p) => !p.realtime && p.delay === 0));
  const l2 = await fixturePassages('Jean Médecin', { lineId: 'L2', direction: 'aeroport' });
  assert.deepEqual(
    l2.map((p) => [p.destination, minutesLeft(p, NOW), p.realtime]),
    [
      ['Aéroport Terminal 2', 3, true],
      ['Aéroport Terminal 2', 13, true],
      ['Aéroport Terminal 2', 26, false],
      ['Aéroport Terminal 2', 36, false],
      ['Aéroport Terminal 2', 46, false],
    ],
  );
  // The tram B has no headsign: its last stop stands for it.
  const airport = await fixturePassages('Aéroport Terminal 2', { lineId: 'B' });
  assert.ok(airport.length > 0);
  assert.ok(airport.every((p) => p.destination === 'CADAM / Centre Administratif'));
  assert.deepEqual(buildPassages({ timetable: null, stop: { ids: [] }, now: NOW }), []);
});

test('waits, the passages to come, the cancelled ones', () => {
  const list = [
    passage({ time: '10:35' }),
    passage({ time: '10:45', cancelled: true }),
    passage({ time: '10:50' }),
  ];
  assert.equal(minutesLeft(list[2], NOW), 12);
  assert.equal(minutesLeft(list[0], NOW), 0);
  assert.deepEqual(
    upcomingPassages(list, NOW).map((p) => p.trip),
    ['L1-10:50'],
  );
  assert.deepEqual(
    cancelledPassages(list, NOW).map((p) => p.trip),
    ['L1-10:45'],
  );
  assert.equal(routeOf(list[0]), 'L1|hopital pasteur');
});
