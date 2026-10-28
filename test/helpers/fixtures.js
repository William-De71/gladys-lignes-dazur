// A fake Lignes d'Azur for the tests, served through the `fetch` option of
// the integration. Its answers are real ones, read on 2026-10-28 at 10:37
// (Paris): the GTFS of that week reduced to the trips of the 28th leaving
// Masséna, Garibaldi, Gare Thiers / Poste, Jean Médecin, Le Château (two
// places of that name) or Aéroport Terminal 2 between 10:25 and 11:25 (every
// stop of those trips kept), and the GTFS-RT trip updates of those trips at
// that minute (times only, as Lignes d'Azur sends them). Open data of Lignes
// d'Azur (Métropole Nice Côte d'Azur), Licence Ouverte 2.0. Tests never touch
// the network: the zip is built here, and feeds of other moments are written
// by `encodeFeed()`.

import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { readGtfs } from '../../src/gtfs.js';
import { groupStops, lineOf } from '../../src/network.js';
import { decodeFeed } from '../../src/gtfs-rt.js';
import { buildPassages, indexTripUpdates } from '../../src/departures.js';

const FIXTURES = new URL('../fixtures/', import.meta.url);
// The time of the trip updates of the fixture: 2026-10-28 10:37:34 in Paris.
const NOW = 1793180254 * 1000;
const TZ = 'Europe/Paris';
const LAST_MODIFIED = 'Fri, 23 Oct 2026 12:48:56 GMT';
const GTFS_URL = 'https://gtfs.test/gtfs.zip';
const TRIP_UPDATES_URL = 'https://ara.test/rla/gtfs/trip-updates';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'lignes-dazur-')), 'lignes-dazur.json');

// --- Zip ------------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

/**
 * @description The CRC-32 of some bytes.
 * @param {Buffer} buf - The bytes.
 * @returns {number} The CRC.
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @description A zip archive.
 * @param {object} files - `{ name: text | Buffer }`.
 * @param {object} [options] - `{ store }`: no compression.
 * @returns {Buffer} The archive.
 */
function makeZip(files, { store = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const packed = store ? data : deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * @description The files of the GTFS fixture.
 * @returns {object} `{ "stops.txt": text, … }`.
 */
function gtfsFiles() {
  const dir = new URL('gtfs/', FIXTURES);
  return Object.fromEntries(
    readdirSync(dir).map((name) => [name, readFileSync(new URL(name, dir), 'utf8')]),
  );
}

const GTFS_ZIP = makeZip(gtfsFiles());

// --- Protocol Buffers -----------------------------------------------------------------

/**
 * @description A varint.
 * @param {number|bigint} value - The value (negative: 64-bit two's complement).
 * @returns {Buffer} The bytes.
 */
function varint(value) {
  let rest = BigInt.asUintN(64, BigInt(value));
  const bytes = [];
  do {
    let byte = Number(rest & 0x7fn);
    rest >>= 7n;
    if (rest > 0n) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (rest > 0n);
  return Buffer.from(bytes);
}

const tag = (field, wire) => varint(field * 8 + wire);
const num = (field, value) =>
  value === undefined || value === null ? [] : [tag(field, 0), varint(value)];
const len = (field, bytes) => {
  if (bytes === undefined || bytes === null) {
    return [];
  }
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  return [tag(field, 2), varint(data.length), data];
};
const msg = (parts) => Buffer.concat(parts.flat());
const translated = (text) =>
  text === undefined ? null : msg([len(1, msg([len(1, text), len(2, 'fr')]))]);

/**
 * @description A GTFS-RT feed, written like Lignes d'Azur writes it.
 * @param {object} feed - `{ timestamp (s), tripUpdates: [{ tripId, routeId,
 * directionId, cancelled, stops: [{ stopId, sequence, time, delay, skipped }]
 * }], alerts: [{ id, periods: [{ start, end }], routeIds, stopIds, effect,
 * header, description, url }] }` (Lignes d'Azur sends no alert: the decoder
 * still reads them).
 * @returns {Buffer} The FeedMessage.
 */
function encodeFeed({ timestamp = NOW / 1000, tripUpdates = [], alerts = [] } = {}) {
  const header = msg([len(1, '2.0'), num(2, 0), num(3, timestamp)]);
  const entities = [
    ...tripUpdates.map((update, index) => {
      const trip = msg([
        len(1, update.tripId),
        num(4, update.cancelled ? 3 : 0),
        len(5, update.routeId),
        num(6, update.directionId),
      ]);
      const stops = (update.stops ?? []).map((stop) => {
        const event = msg([num(1, stop.delay), num(2, stop.time)]);
        return len(
          2,
          msg([
            num(1, stop.sequence),
            stop.skipped ? [] : len(2, event),
            stop.skipped ? [] : len(3, event),
            len(4, stop.stopId),
            num(5, stop.skipped ? 1 : 0),
          ]),
        );
      });
      return len(
        2,
        msg([len(1, `tu-${index}`), len(3, msg([len(1, trip), ...stops, num(4, timestamp)]))]),
      );
    }),
    ...alerts.map((alert) =>
      len(
        2,
        msg([
          len(1, alert.id),
          len(
            5,
            msg([
              ...(alert.periods ?? []).map((period) =>
                len(1, msg([num(1, period.start), num(2, period.end)])),
              ),
              ...(alert.routeIds ?? []).map((routeId) => len(5, msg([len(2, routeId)]))),
              ...(alert.stopIds ?? []).map((stopId) => len(5, msg([len(5, stopId)]))),
              num(7, alert.effect),
              len(8, translated(alert.url)),
              len(10, translated(alert.header)),
              len(11, translated(alert.description)),
            ]),
          ),
        ]),
      ),
    ),
  ];
  return msg([len(1, header), ...entities]);
}

const TRIP_UPDATES = readFileSync(new URL('trip-updates.pb', FIXTURES));

/**
 * @description An instant of the day of the fixtures, in Paris.
 * @param {string} time - "10:50", "10:50:30", "24:10" (after midnight).
 * @returns {number} The instant (ms).
 */
function paris(time) {
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  // 2026-10-28 in Paris is UTC+1.
  return Date.parse('2026-10-28T00:00:00+01:00') + ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

/**
 * @description A passage, as buildPassages() writes it.
 * @param {object} [fields] - What differs from a tram L1 towards Hôpital
 * Pasteur, scheduled at 10:50, followed in real time and on time. `time` the
 * scheduled Paris time, `delay` minutes.
 * @returns {object} The passage.
 */
function passage({
  time = '10:50',
  delay = 0,
  line = 'L1',
  destination = 'Hôpital Pasteur',
  realtime = true,
  cancelled = false,
  trip,
} = {}) {
  const scheduled = paris(time);
  return {
    lineId: line,
    line,
    destination,
    terminus: destination,
    at: scheduled + (realtime ? delay : 0) * 60000,
    scheduled,
    realtime,
    delay: realtime ? delay : 0,
    cancelled,
    occupancy: null,
    trip: trip ?? `${line}-${time}`,
    platform: '1186',
  };
}

/**
 * @description The passages of a stop of the fixtures, at the time of the
 * fixtures: the reduced GTFS corrected by the real trip updates.
 * @param {string} name - The stop name ("Masséna").
 * @param {object} [filter] - `{ lineId, direction, realtime }`: `realtime`
 * false for the timetable only.
 * @returns {Promise<object[]>} The passages.
 */
async function fixturePassages(name, { lineId = '', direction = '', realtime = true } = {}) {
  const reference = await readGtfs(GTFS_ZIP);
  const stop = groupStops(reference.stops, reference.linesByStop).find((s) => s.name === name);
  const lines = new Map(reference.routes.map((route) => [route.id, lineOf(route)]));
  const { timetable } = await readGtfs(GTFS_ZIP, {
    stopIds: new Set(stop.ids),
    from: '20261027',
    to: '20261103',
  });
  return buildPassages({
    timetable,
    stop,
    realtime: realtime ? indexTripUpdates(decodeFeed(TRIP_UPDATES)) : null,
    now: NOW,
    lineId,
    direction,
    lineName: (id) => lines.get(id)?.name ?? id,
  });
}

/**
 * @description The fake Lignes d'Azur.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeRla() {
  const state = {
    zip: GTFS_ZIP,
    lastModified: LAST_MODIFIED,
    tripUpdates: TRIP_UPDATES,
    // 'network', or an HTTP status, for every request; `failRealtime` for
    // the trip updates alone.
    fail: null,
    failRealtime: null,
  };
  const calls = [];

  /**
   * @description The fetch function.
   * @param {string} url - The URL.
   * @param {object} [init] - The request options.
   * @returns {Promise<Response>} The answer.
   */
  async function fetchFn(url, init = {}) {
    const path = url;
    const since = init.headers?.['if-modified-since'] ?? '';
    calls.push({ path, since });
    if (state.fail === 'network') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }
    if (typeof state.fail === 'number') {
      return new Response('Service Unavailable', { status: state.fail });
    }
    const binary = (body) =>
      new Response(body, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
    switch (path) {
      case GTFS_URL:
        if (since && since === state.lastModified) {
          return new Response(null, { status: 304 });
        }
        return new Response(state.zip, {
          status: 200,
          headers: { 'content-type': 'application/zip', 'last-modified': state.lastModified },
        });
      case TRIP_UPDATES_URL:
        if (state.failRealtime) {
          return new Response('Bad Gateway', { status: state.failRealtime });
        }
        return binary(state.tripUpdates);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
  fetchFn.calls = calls;
  fetchFn.state = state;
  return fetchFn;
}

/**
 * @description A minimal Gladys client for the pure builders.
 */
const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:lignes-dazur:${type}:${id}`,
    feature: (key) => `ext:lignes-dazur:${type}:${id}:${key}`,
  }),
};

export {
  NOW,
  TZ,
  LAST_MODIFIED,
  GTFS_URL,
  TRIP_UPDATES_URL,
  GTFS_ZIP,
  TRIP_UPDATES,
  silent,
  storePath,
  crc32,
  makeZip,
  gtfsFiles,
  varint,
  encodeFeed,
  paris,
  passage,
  fixturePassages,
  fakeRla,
  fakeGladys,
};
