// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake Lignes d'Azur serving real (reduced) open data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, IDLE_INTERVAL_MS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { formatTime } from '../src/time.js';
import {
  fakeRla,
  storePath,
  silent,
  encodeFeed,
  NOW,
  TZ,
  GTFS_URL,
  TRIP_UPDATES_URL,
} from './helpers/fixtures.js';

const CONFIG = {
  stop_1: 'Masséna',
  stop_1_line: 'tram 1',
  stop_1_direction: 'Hôpital Pasteur',
  stop_2: 'gare thiers poste',
  stop_3: 'Le Château',
  interval: '60',
  language: 'fr',
};
const PREFIX = 'ext:test-integration';
const MASSENA_L1 = `${PREFIX}:stop:massena_l1_hopital-pasteur`;
const GARE = `${PREFIX}:stop:gare-thiers-poste`;
const MINUTE = 60 * 1000;
const TRIP_UPDATES = 'trip_updates';

/**
 * @description The integration on a fake Gladys and a fake Lignes d'Azur.
 * @param {object} gladys - The fake Gladys.
 * @param {object} options - `{ api, path, clock, logger }`.
 * @returns {object} The app.
 */
const appOn = (gladys, { api, path, clock, logger = silent }) =>
  createApp(gladys, {
    fetch: api,
    gtfsUrl: GTFS_URL,
    tripUpdatesUrl: TRIP_UPDATES_URL,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });

/**
 * @description The integration, connected to a fake Gladys and a fake Lignes d'Azur.
 * @param {object} [options] - `{ config, path, start, logger }`: `start` the
 * time of the clock (ms).
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({ config = CONFIG, path = storePath(), start = NOW, logger } = {}) {
  const clock = { now: start };
  const api = fakeRla();
  const gladys = createFakeGladys({ config });
  const app = appOn(gladys, { api, path, clock, logger });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const realtimeReads = (app) => app.api.requests.byEndpoint[TRIP_UPDATES] ?? 0;
const tripOf = (passage) => passage.trip.split('@')[0];

test('two stops become two devices; an ambiguous name is reported', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [MASSENA_L1, 'Lignes d’Azur Masséna (L1 → Hôpital Pasteur)'],
      [GARE, 'Lignes d’Azur Gare Thiers / Poste'],
    ],
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Connecté à Lignes d’Azur : 2 arrêt(s), temps réel lu toutes les 60 s. Inconnu ou ambigu : Le Château.',
  );
  // The timetable once, the real time of both stops in one request.
  assert.deepEqual(
    api.calls.map((call) => call.path),
    [GTFS_URL, TRIP_UPDATES_URL],
  );
  // The first readings are a baseline: nothing fires.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get their states, sent again after the creation', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, MASSENA_L1);
  await created(gladys, GARE);
  const [next] = app.getSnapshot('massena_l1_hopital-pasteur').passages;
  assert.equal(next.destination, 'Hôpital Pasteur');
  assert.equal(gladys.fake.lastState(`${MASSENA_L1}:wait`), Math.floor((next.at - NOW) / MINUTE));
  assert.match(gladys.fake.lastState(`${MASSENA_L1}:next`), /^L1 → Hôpital Pasteur · /);
  assert.equal(gladys.fake.lastState(`${GARE}:next`), '57 → LAS PLANAS / SAPPIA · 1 min');
  assert.equal(gladys.fake.lastState(`${GARE}:following`), 3);
  // The tram gets four minutes late.
  api.state.tripUpdates = encodeFeed({
    timestamp: (NOW + MINUTE) / 1000,
    tripUpdates: [
      {
        tripId: tripOf(next),
        routeId: 'L1',
        stops: [{ stopId: next.platform, sequence: 9, time: (next.scheduled + 4 * MINUTE) / 1000 }],
      },
    ],
  });
  clock.now += MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${MASSENA_L1}:delay`), 4);
  assert.match(gladys.fake.lastState(`${MASSENA_L1}:next`), /\(\+4 min de retard\)$/);
});

test('departure soon: fired close to its mark, once, between two readings too', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: {
      stop_1: 'Jean Médecin',
      stop_1_line: 'L2',
      stop_1_direction: 'aeroport',
      language: 'en',
    },
  });
  t.after(() => gladys.fake.shutdown());
  const passage = app
    .getSnapshot('jean-medecin_l2_aeroport')
    .passages.find((entry) => entry.scheduled > NOW + 20 * MINUTE);
  clock.now += MINUTE;
  const at = clock.now + 12 * MINUTE;
  api.state.tripUpdates = encodeFeed({
    timestamp: clock.now / 1000,
    tripUpdates: [
      {
        tripId: tripOf(passage),
        routeId: 'L2',
        stops: [{ stopId: passage.platform, sequence: 5, time: at / 1000 }],
      },
    ],
  });
  await app.readStops({ force: true });
  const ours = () =>
    eventsOf(gladys, TRIGGERS.DEPARTURE_SOON).filter(
      (event) => event.data.time === formatTime(at, TZ),
    );
  assert.deepEqual(ours(), []);
  // Seven minutes later, without a reading: the 5-minute mark (between readings).
  clock.now += 7 * MINUTE + 10000;
  await app.checkReminders();
  assert.deepEqual(
    ours().map((event) => [event.data.minutes, event.data.line, event.data.destination]),
    [['5', 'L2', 'Aéroport Terminal 2']],
  );
  assert.equal(ours()[0].data.stop, `${PREFIX}:stop:jean-medecin_l2_aeroport`);
  assert.match(
    ours()[0].data.summary,
    new RegExp(
      `^L2 towards Aéroport Terminal 2 leaves Jean Médecin in 5 min \\(${formatTime(at, TZ)}`,
    ),
  );
  await app.checkReminders();
  await app.readStops({ force: true });
  assert.equal(ours().length, 1);
});

test('departure cancelled: fired once per trip, never again after a restart', async (t) => {
  const path = storePath();
  const config = { stop_1: 'Gare Thiers / Poste', language: 'fr' };
  const { gladys, app, api, clock } = await startApp({ config, path });
  t.after(() => gladys.fake.shutdown());
  const passage = app
    .getSnapshot('gare-thiers-poste')
    .passages.find(
      (entry) =>
        entry.lineId === '57' &&
        entry.destination === 'LAS PLANAS / SAPPIA' &&
        entry.scheduled > NOW + 10 * MINUTE,
    );
  api.state.tripUpdates = encodeFeed({
    tripUpdates: [{ tripId: tripOf(passage), routeId: '57', cancelled: true }],
  });
  await app.readStops({ force: true });
  await app.readStops({ force: true });
  const time = formatTime(passage.scheduled, TZ);
  const cancelled = eventsOf(gladys, TRIGGERS.DEPARTURE_CANCELLED);
  assert.deepEqual(
    cancelled.map((event) => [event.data.line, event.data.time, event.data.stop]),
    [['57', time, GARE]],
  );
  assert.equal(
    cancelled[0].data.summary,
    `Le 57 de ${time} vers ${passage.destination} à Gare Thiers / Poste est supprimé.`,
  );
  // Shown in the widget, left out of the waits.
  const widget = await gladys.fake.widgetGet(WIDGETS.DEPARTURES, { settings: {}, language: 'fr' });
  assert.ok(
    widget.data.content.components[2].items.some((item) => item.value.includes(`supprimé ${time}`)),
  );
  // A restart on the same /data: nothing replayed, nothing downloaded again.
  const second = createFakeGladys({ config });
  t.after(() => second.fake.shutdown());
  const calls = api.calls.length;
  const restarted = appOn(second, { api, path, clock });
  await second.connect();
  await restarted.whenReady();
  assert.deepEqual(second.fake.sceneEvents, []);
  assert.ok(!api.calls.slice(calls).some((call) => call.path === GTFS_URL));
});

test('one request for every stop; quiet stops every 10 minutes', async (t) => {
  const { gladys, app, clock } = await startApp({
    config: {
      stop_1: 'Gare Thiers / Poste',
      stop_2: 'Masséna',
      stop_2_line: '12',
      interval: '30',
      added_stops: [
        { stop: 'jean-medecin', line: '', direction: '' },
        { stop: 'garibaldi', line: '15', direction: '' },
      ],
    },
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(app.getStops().length, 4);
  const before = realtimeReads(app);
  clock.now += 31 * 1000;
  await app.readStops();
  assert.equal(realtimeReads(app), before + 1, 'four devices, one request');
  // In the afternoon the fixture announces nothing before the next morning:
  // the stop is read every 10 minutes.
  const quiet = await startApp({ config: { stop_1: 'Masséna' }, start: NOW + 3 * 60 * MINUTE });
  t.after(() => quiet.gladys.fake.shutdown());
  const reads = realtimeReads(quiet.app);
  quiet.clock.now += 2 * MINUTE;
  await quiet.app.readStops();
  assert.equal(realtimeReads(quiet.app), reads);
  quiet.clock.now += IDLE_INTERVAL_MS;
  await quiet.app.readStops();
  assert.equal(realtimeReads(quiet.app), reads + 1);
});

test('the open data down: a clear status; without real time, the timetable', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, GARE);
  api.state.fail = 503;
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /do not answer \(trip_updates: HTTP 503\)/);
  // The timetable kept in memory still gives the departures.
  assert.match(gladys.fake.lastState(`${GARE}:next`), /\(théorique\)$/);
  api.state.fail = null;
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.doesNotMatch(gladys.fake.lastState(`${GARE}:next`), /théorique/);
  // The real time alone failing: the timetable meanwhile, and the status says it.
  api.state.failRealtime = 502;
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.lastState(`${GARE}:next`), /\(théorique\)$/);
});

test('widgets: followed stops, a typed stop; valid in every language', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const answers = [
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, { settings: {}, language }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stops: [MASSENA_L1, GARE] },
        language,
      }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stop_name: 'Garibaldi', line: '15' },
        language,
      }),
    ];
    for (const answer of answers) {
      assert.equal(answer.success, true);
      assert.deepEqual(validateWidgetContent(answer.data.content), [], language);
    }
  }
  const typed = await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
    settings: { stop_name: 'Garibaldi', line: '15' },
    language: 'fr',
  });
  const [heading, , status] = typed.data.content.components;
  assert.equal(heading.text, 'Garibaldi (15)');
  assert.ok(status.items.length > 0);
  assert.ok(status.items.every((item) => item.label.startsWith('15 → ')));
  const unknown = await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
    settings: { stop_name: 'Le Château' },
    language: 'en',
  });
  assert.equal(unknown.data.content.components[0].text, 'Unknown or ambiguous: Le Château.');
});

test('scene action: the next departures of a stop', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const next = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, { stop: GARE });
  assert.equal(next.success, true);
  const { outputs } = next.data;
  assert.deepEqual(
    [outputs.found, outputs.line, outputs.destination, outputs.minutes, outputs.realtime],
    [true, '57', 'LAS PLANAS / SAPPIA', 1, true],
  );
  assert.equal(outputs.following_minutes, 3);
  assert.equal(
    outputs.summary,
    'Prochain passage à Gare Thiers / Poste : 57 vers LAS PLANAS / SAPPIA dans 1 min. Le suivant dans 3 min.',
  );
  // Without a stop: the first one followed.
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, {});
  assert.equal(first.data.outputs.stop_name, 'Masséna (L1 → Hôpital Pasteur)');
  const lonely = await startApp({ config: {} });
  t.after(() => lonely.gladys.fake.shutdown());
  const none = await lonely.gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, {});
  assert.equal(none.success, false);
});

test('configuration actions: test, find a stop, diagnostic', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const tested = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.equal(tested.success, true);
  const fr = tested.data.message.fr;
  assert.match(fr, /^Open data Lignes d’Azur joint : 17 lignes, 343 arrêts/);
  assert.match(fr, /Gare Thiers \/ Poste : 21 passage\(s\), prochain 57 dans 1 min/);
  assert.match(fr, /inconnu ou ambigu : Le Château/);
  // The timetable asked again, unchanged.
  assert.notEqual(api.calls.filter((call) => call.path === GTFS_URL).at(-1).since, '');
  const found = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'massena' });
  const text = found.data.message.fr;
  assert.match(text, /^Saisissez le nom/);
  assert.match(text, /\n• Masséna \[MASSE0, MASSE2, MASSV7\] → L1, 8\+, 12\+\n/);
  // Two places named Le Château: their platform codes tell them apart.
  const chateau = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'le chateau' });
  assert.match(chateau.data.message.fr, /• Le Château \[CACHT1\] → 44/);
  assert.match(chateau.data.message.fr, /• Le Château \[LACHT1, LACHT2\]/);
  const short = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'r' });
  assert.match(short.data.message.en, /at least two letters/);
  const none = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'zzz' });
  assert.equal(none.data.message.en, 'No stop matches "zzz".');
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /Lignes d’Azur diagnostic/);
});

test('add, list and remove stops with the buttons, beyond the three of the form', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const added = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'garibaldi', line: 'tram 1' });
  assert.match(added.data.message.en, /^Stop added: Garibaldi \(L1\)\. 3 stop\(s\)/);
  assert.deepEqual(gladys.fake.config.added_stops, [
    { stop: 'garibaldi', line: 'L1', direction: '' },
  ]);
  assert.ok(
    gladys.fake.discoveredDevices.some(
      (device) => device.external_id === `${PREFIX}:stop:garibaldi_l1`,
    ),
  );
  const snapshot = app.getSnapshot('garibaldi_l1');
  assert.ok(snapshot.passages.length > 0);
  assert.ok(snapshot.passages.every((p) => p.lineId === 'L1'));
  const again = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'Garibaldi', line: 'L1' });
  assert.match(again.data.message.en, /already followed/);
  const unknown = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'Nowhere' });
  assert.equal(unknown.data.message.en, 'Unknown or ambiguous: Nowhere.');
  // The second Le Château, by its code.
  const chateau = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'LACHT1' });
  assert.match(chateau.data.message.en, /^Stop added: Le Château\. 4 stop\(s\)/);
  assert.equal(gladys.fake.config.added_stops[1].stop, 'le-chateau-2');
  const list = await gladys.fake.action(ACTIONS.LIST_STOPS);
  assert.equal(
    list.data.message.fr,
    '5 arrêt(s) suivi(s) :\n' +
      '1. Masséna (L1 → Hôpital Pasteur) (formulaire, arrêt 1)\n' +
      '2. Gare Thiers / Poste (formulaire, arrêt 2)\n' +
      '3. Le Château (formulaire, arrêt 3, inconnu ou ambigu)\n' +
      '4. Garibaldi (L1)\n' +
      '5. Le Château',
  );
  const inForm = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '2' });
  assert.match(inForm.data.message.en, /is stop 2 of the form/);
  const removed = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '4' });
  assert.match(removed.data.message.en, /^Stop removed: Garibaldi \(L1\)/);
  assert.deepEqual(gladys.fake.config.added_stops, [
    { stop: 'le-chateau-2', line: '', direction: '' },
  ]);
  assert.equal(app.getStops().length, 3);
});
