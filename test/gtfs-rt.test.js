import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decodeFeed, readVarint } from '../src/gtfs-rt.js';
import { TRIP_UPDATES, NOW, encodeFeed, varint } from './helpers/fixtures.js';

test('varints, negative ones on 64 bits', () => {
  assert.deepEqual(readVarint(varint(300), 0), [300n, 2]);
  assert.equal(BigInt.asIntN(64, readVarint(varint(-44), 0)[0]), -44n);
  assert.throws(() => readVarint(Buffer.from([0x80]), 0), { kind: 'invalid' });
});

test('the real trip updates of Lignes d’Azur', () => {
  const feed = decodeFeed(TRIP_UPDATES);
  assert.equal(feed.timestamp * 1000, NOW);
  assert.equal(feed.tripUpdates.length, 102);
  assert.deepEqual(feed.alerts, []);
  const [first] = feed.tripUpdates;
  assert.equal(first.tripId, '7249254-08_A_50_0805_10:50-PVS2026-27-08-Semaine-37');
  assert.equal(first.routeId, '08');
  // Times only, with a stop_sequence, never a delay.
  const events = feed.tripUpdates.flatMap((update) =>
    update.stops.map((stop) => stop.departure ?? stop.arrival).filter(Boolean),
  );
  assert.ok(events.every((event) => event.delay === null && event.time > 0));
  assert.ok(feed.tripUpdates.every((update) => update.stops.every((s) => s.sequence !== null)));
  // Some stops of the line 8+ are skipped (a diversion), without a time.
  const skipped = feed.tripUpdates.flatMap((update) => update.stops).find((stop) => stop.skipped);
  assert.deepEqual([skipped.departure, skipped.arrival], [null, null]);
});

test('cancelled trips, skipped stops, effects; garbage refused', () => {
  const feed = decodeFeed(
    encodeFeed({
      tripUpdates: [
        { tripId: 'U_1', routeId: '1', cancelled: true },
        {
          tripId: 'U_2',
          routeId: '2',
          directionId: 1,
          stops: [
            { stopId: '41133', time: 1793137800, delay: -30 },
            { stopId: '41135', skipped: true },
          ],
        },
      ],
      alerts: [{ id: 'a', routeIds: ['3'], stopIds: ['41133'], effect: 1, url: 'https://x.fr' }],
    }),
  );
  assert.equal(feed.tripUpdates[0].cancelled, true);
  const [arrival, skipped] = feed.tripUpdates[1].stops;
  assert.deepEqual(arrival.departure, { delay: -30, time: 1793137800 });
  assert.equal(skipped.skipped, true);
  assert.equal(feed.tripUpdates[1].directionId, 1);
  assert.deepEqual(
    [feed.alerts[0].effect, feed.alerts[0].stopIds, feed.alerts[0].url],
    [1, ['41133'], 'https://x.fr'],
  );
  assert.throws(() => decodeFeed(Buffer.from('<html>Bad Gateway</html>')), { kind: 'invalid' });
  assert.throws(() => decodeFeed(Buffer.alloc(0)), { kind: 'invalid' });
});
