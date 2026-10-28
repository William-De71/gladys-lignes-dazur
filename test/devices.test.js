// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  stopKey,
  followedName,
  idsOf,
  parseExternalId,
  buildStopDevice,
  buildStopStates,
  DEVICE_TYPES,
} from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, NOW, TZ, passage } from './helpers/fixtures.js';

const MASSENA_L1 = {
  stop: { code: 'massena', name: 'Masséna' },
  line: { id: 'L1', name: 'L1', mode: 'tram' },
  direction: 'Hôpital Pasteur',
};
MASSENA_L1.key = stopKey(MASSENA_L1.stop, MASSENA_L1.line, MASSENA_L1.direction);
MASSENA_L1.name = followedName(MASSENA_L1);
const GARE = {
  stop: { code: 'gare-thiers-poste', name: 'Gare Thiers / Poste' },
  line: null,
  direction: '',
};
GARE.key = stopKey(GARE.stop, null, '');
GARE.name = followedName(GARE);
const BUS_8 = {
  stop: { code: 'le-chateau-2', name: 'Le Château' },
  line: { id: '08', name: '8+', mode: 'bus' },
  direction: '',
};
BUS_8.key = stopKey(BUS_8.stop, BUS_8.line, '');
BUS_8.name = followedName(BUS_8);
const PASSAGES = [
  passage({ time: '10:50', delay: 1 }),
  passage({ time: '11:05', delay: 0 }),
  passage({ time: '10:45', line: 'L2', destination: 'Aéroport Terminal 2' }),
];
const forStop = (list) => list.filter((entry) => entry.lineId === 'L1').sort((a, b) => a.at - b.at);

const devices = (language) => [
  buildStopDevice(fakeGladys, MASSENA_L1, language),
  buildStopDevice(fakeGladys, GARE, language),
  buildStopDevice(fakeGladys, BUS_8, language),
];

// Pairs with an icon and a label in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
  [
    DEVICE_FEATURE_CATEGORIES.DURATION,
    DEVICE_FEATURE_TYPES.DURATION.INTEGER,
    DEVICE_FEATURE_UNITS.MINUTES,
  ],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
      const names = new Set(device.features.map((feature) => feature.name));
      assert.equal(names.size, device.features.length, 'every feature has its own name');
    }
  }
});

test('category / type / unit pairs known to the Gladys front, from the SDK constants', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(
        ([category, type, unit]) =>
          feature.category === category && feature.type === type && feature.unit === unit,
      ),
      `${feature.external_id}: ${feature.category}/${feature.type}/${feature.unit}`,
    );
  }
});

test('ids from the code of the stop, the route id and the direction; read back', () => {
  const [massena, gare, bus] = devices('fr');
  assert.equal(massena.external_id, 'ext:lignes-dazur:stop:massena_l1_hopital-pasteur');
  assert.equal(massena.name, 'Lignes d’Azur Masséna (L1 → Hôpital Pasteur)');
  assert.equal(massena.model, "Lignes d'Azur");
  assert.equal(gare.external_id, 'ext:lignes-dazur:stop:gare-thiers-poste');
  assert.equal(gare.name, 'Lignes d’Azur Gare Thiers / Poste');
  assert.deepEqual(
    [bus.external_id, bus.name],
    ['ext:lignes-dazur:stop:le-chateau-2_08', 'Lignes d’Azur Le Château (8+)'],
  );
  assert.deepEqual(parseExternalId('ext:lignes-dazur:stop:gare-thiers-poste:wait'), {
    type: 'stop',
    key: 'gare-thiers-poste',
  });
  assert.deepEqual(parseExternalId('ext:lignes-dazur:stop:massena_l1'), {
    type: 'stop',
    key: 'massena_l1',
  });
  // No line device any more.
  assert.equal(parseExternalId('ext:lignes-dazur:line:L1'), null);
  assert.equal(parseExternalId('something'), null);
  // Other accents or case in the direction: the same device.
  assert.equal(stopKey(MASSENA_L1.stop, MASSENA_L1.line, 'HOPITAL PASTEUR'), MASSENA_L1.key);
  assert.deepEqual(
    massena.params.map((param) => [param.name, param.value]),
    [
      ['RLA_STOP', 'Masséna'],
      ['RLA_LINE', 'L1'],
      ['RLA_DIRECTION', 'Hôpital Pasteur'],
    ],
  );
});

test('stop states: the next passage, the two waits and the delay', () => {
  const states = buildStopStates(fakeGladys, MASSENA_L1, forStop(PASSAGES), {
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  // 10:37:34: the L1 of 10:50, 1 min late (10:51), then the one of 11:05.
  assert.equal(byKey.wait, 13);
  assert.equal(byKey.following, 27);
  assert.equal(byKey.delay, 1);
  assert.equal(byKey.next, 'L1 → Hôpital Pasteur · 13 min (+1 min de retard)');
  // Announced early (the trams run to a frequency): no negative delay.
  const early = buildStopStates(fakeGladys, MASSENA_L1, [passage({ time: '10:50', delay: -4 })], {
    language: 'en',
    now: NOW,
    timeZone: TZ,
  });
  assert.equal(early.find((s) => s.device_feature_external_id.endsWith(':delay')).state, 0);
  assert.equal(early[0].text, 'L1 → Hôpital Pasteur · 8 min');
  // The timetable only: no delay published, the text says it.
  const scheduled = buildStopStates(
    fakeGladys,
    MASSENA_L1,
    [passage({ time: '10:45', realtime: false })],
    { language: 'en', now: NOW, timeZone: TZ },
  );
  assert.deepEqual(
    scheduled.map((s) => s.device_feature_external_id.split(':').pop()),
    ['next', 'wait'],
  );
  assert.equal(scheduled[0].text, 'L1 → Hôpital Pasteur · 7 min (timetable)');
  // Nothing announced: the waits are left untouched.
  const empty = buildStopStates(fakeGladys, GARE, [], { language: 'es', now: NOW });
  assert.deepEqual(
    empty.map((s) => s.text),
    ['Ningún paso anunciado'],
  );
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildStopDevice(gladys, MASSENA_L1, language),
      buildStopDevice(gladys, GARE, language),
    ]);
  }
  const [stop] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(stop);
  await gladys.publishStates(
    buildStopStates(gladys, MASSENA_L1, forStop(PASSAGES), { language: 'en', now: NOW }),
  );
  assert.equal(idsOf(gladys, DEVICE_TYPES.STOP, MASSENA_L1.key).device, stop.external_id);
  assert.equal(gladys.fake.lastState(`${stop.external_id}:wait`), 13);
});
