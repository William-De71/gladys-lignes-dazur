import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRlaClient, USER_AGENT, GTFS_URL, TRIP_UPDATES_URL } from '../src/rla-api.js';
import {
  fakeRla,
  LAST_MODIFIED,
  GTFS_ZIP,
  GTFS_URL as TEST_GTFS_URL,
  TRIP_UPDATES_URL as TEST_TRIP_UPDATES_URL,
} from './helpers/fixtures.js';

const urls = { gtfsUrl: TEST_GTFS_URL, tripUpdatesUrl: TEST_TRIP_UPDATES_URL };

test('the official feeds of Lignes d’Azur by default', () => {
  assert.equal(GTFS_URL, 'https://chouette.enroute.mobi/api/v1/datas/OpendataRLA/gtfs.zip');
  assert.equal(TRIP_UPDATES_URL, 'https://ara-api.enroute.mobi/rla/gtfs/trip-updates');
  assert.match(USER_AGENT, /^gladys-lignes-dazur\//);
});

test('the timetable, then 304 while unchanged; the trip updates decoded', async () => {
  const fetch = fakeRla();
  const api = createRlaClient({ fetch, ...urls });
  const answer = await api.gtfs();
  assert.equal(answer.lastModified, LAST_MODIFIED);
  assert.equal(answer.zip.length, GTFS_ZIP.length);
  assert.equal(await api.gtfs(LAST_MODIFIED), null);
  assert.equal((await api.tripUpdates()).tripUpdates.length, 102);
  assert.deepEqual(api.requests.byEndpoint, { gtfs: 2, trip_updates: 1 });
  assert.equal(api.requests.notModified, 1);
  assert.deepEqual(
    fetch.calls.map((call) => call.path),
    [TEST_GTFS_URL, TEST_GTFS_URL, TEST_TRIP_UPDATES_URL],
  );
});

test('errors: unreachable, busy, invalid', async () => {
  const fetch = fakeRla();
  const api = createRlaClient({ fetch, ...urls });
  fetch.state.fail = 'network';
  await assert.rejects(api.tripUpdates(), { kind: 'unreachable', message: 'ECONNREFUSED' });
  fetch.state.fail = 503;
  await assert.rejects(api.tripUpdates(), { kind: 'busy', status: 503 });
  fetch.state.fail = 404;
  await assert.rejects(api.gtfs(), { kind: 'invalid' });
  fetch.state.fail = null;
  fetch.state.tripUpdates = Buffer.from('<html>oops</html>');
  await assert.rejects(api.tripUpdates(), { kind: 'invalid' });
  assert.equal(api.requests.failed, 4);
});
