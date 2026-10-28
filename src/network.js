// -----------------------------------------------------------------------------
// The reference data of Lignes d'Azur, from its GTFS (gtfs.js):
//
//   - the GTFS zip (10 MB) is kept in /data and asked again once a day, after
//     04:00, with If-Modified-Since (304 when unchanged);
//   - lines: the routes, typed the way the user reads them: "L1", "tram 1",
//     "T2", "5" or "ligne 05", "Exp2", "C";
//   - stops: the parent stations of the GTFS are not reliable (one place
//     split in two stations a few metres apart, a station named after another
//     street than its platforms), so the platforms (2 832) are grouped by name
//     and by place: platforms of one folded name within 500 m of another one
//     of the group make a stop ("Masséna" gathers the platforms of the trams
//     and of the buses). The same name elsewhere ("Le Château" in Nice and in
//     Cagnes) is another stop: its code takes "-2", "-3"… in the order of the
//     smallest platform code. A stop is typed by name ("Garibaldi", "gare
//     thiers") or by the code of one of its platforms ("GARIB1"). A name typed
//     with other words resolves when one stop only holds them all;
//   - the timetable of the followed stops: their departures over eight
//     service days (yesterday to six days ahead), extracted from the zip
//     kept, in memory only, rebuilt each day and when a stop is added.
//
// Names are compared folded: no case, no accent, no punctuation.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readGtfs } from './gtfs.js';
import { localClock } from './time.js';

const DAY_MS = 24 * 3600 * 1000;
const MODES = { TRAM: 'tram', BUS: 'bus' };
// GTFS route types: 0 tram (L1, L2, L3, B), 3 bus, 715 on demand.
const TRAM_TYPES = new Set([0, 900]);
// Platforms of one name further apart than this are two stops.
const GROUP_RADIUS_M = 500;

/**
 * @description Fold a text for comparisons.
 * @param {unknown} value - The text.
 * @returns {string} Lower case, no accent, words separated by one space.
 * @example
 * fold("Gare Thiers / Poste"); // -> 'gare thiers poste'
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @description A slug for an external id.
 * @param {unknown} value - The text.
 * @param {number} [max] - Its longest length.
 * @returns {string} "gare-thiers-poste".
 */
function slug(value, max = 40) {
  return fold(value).replace(/ /g, '-').slice(0, max).replace(/-$/, '');
}

/**
 * @description What is kept of a line.
 * @param {object} route - A route of the GTFS.
 * @returns {object} `{ id, name, longName, mode, color }`.
 */
const lineOf = (route) => ({
  id: String(route.id),
  // "05" reads "5" on the buses and the stops.
  name: String(route.shortName || route.id).replace(/^0+(?=\d)/, ''),
  longName: String(route.longName ?? ''),
  mode: TRAM_TYPES.has(route.type) ? MODES.TRAM : MODES.BUS,
  color: /^[0-9a-f]{6}$/i.test(route.color ?? '') ? `#${route.color.toUpperCase()}` : '',
});

/**
 * @description The order of lines: trams first, then by name.
 * @param {object} a - A line.
 * @param {object} b - Another one.
 * @returns {number} The order.
 */
const byLine = (a, b) =>
  Number(a.mode !== MODES.TRAM) - Number(b.mode !== MODES.TRAM) ||
  a.name.localeCompare(b.name, 'fr', { numeric: true });

/**
 * @description The distance between two points, in metres.
 * @param {object} a - `{ lat, lon }`.
 * @param {object} b - `{ lat, lon }`.
 * @returns {number} Metres (equirectangular: the stops are close).
 */
function distance(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/**
 * @description The places of the platforms of one name: platforms within
 * GROUP_RADIUS_M of another one of the place are together.
 * @param {object[]} list - The platforms of one name.
 * @returns {object[][]} The places, each sorted by platform code, ordered by
 * their smallest platform code.
 */
function placesOf(list) {
  const code = (item) => item.code || item.id;
  const sorted = [...list].sort((a, b) => code(a).localeCompare(code(b), 'fr', { numeric: true }));
  const places = [];
  for (const platform of sorted) {
    const near = places.filter((place) =>
      place.some((other) => distance(platform, other) <= GROUP_RADIUS_M),
    );
    if (near.length === 0) {
      places.push([platform]);
      continue;
    }
    // A platform between two places joins them.
    const [first, ...others] = near;
    first.push(platform, ...others.flat());
    others.forEach((place) => places.splice(places.indexOf(place), 1));
  }
  return places
    .map((place) => place.sort((a, b) => code(a).localeCompare(code(b), 'fr', { numeric: true })))
    .sort((a, b) => code(a[0]).localeCompare(code(b[0]), 'fr', { numeric: true }));
}

/**
 * @description The stops: the platforms of one name in one place.
 * @param {object[]} platforms - The stops of the GTFS.
 * @param {object} linesByStop - `{ platform id: [route id] }`.
 * @returns {object[]} `[{ code, name, ids, platforms, lines, lat, lon }]`,
 * `code` the slug of the name (another place of the same slug gets "-2"),
 * `platforms` the public codes of the platforms.
 */
function groupStops(platforms, linesByStop) {
  const byName = new Map();
  for (const platform of platforms) {
    // "Carlone / Madeleine" and "Carlone/Madeleine" are one name.
    const key = fold(platform.name);
    const list = byName.get(key) ?? [];
    list.push(platform);
    byName.set(key, list);
  }
  const keys = [...byName.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  const used = new Set();
  const stops = [];
  for (const key of keys) {
    for (const list of placesOf(byName.get(key))) {
      // The most common spelling of the place.
      const counts = new Map();
      list.forEach((item) => counts.set(item.name, (counts.get(item.name) ?? 0) + 1));
      const name = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0][0];
      let code = slug(name, 60) || slug(list[0].id);
      for (let index = 2; used.has(code); index += 1) {
        code = `${slug(name, 56)}-${index}`;
      }
      used.add(code);
      const average = (field) =>
        Math.round((list.reduce((sum, item) => sum + item[field], 0) / list.length) * 1e5) / 1e5;
      stops.push({
        code,
        name,
        ids: list.map((item) => item.id),
        platforms: [...new Set(list.map((item) => item.code || item.id))],
        lines: [...new Set(list.flatMap((item) => linesByStop[item.id] ?? []))],
        lat: average('lat'),
        lon: average('lon'),
      });
    }
  }
  return stops.sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.code.localeCompare(b.code));
}

/**
 * @description Find a line among the known ones.
 * @param {object[]} lines - The known lines.
 * @param {string} typed - "L1", "tram 1", "T2", "5", "ligne 05", "Exp2".
 * @returns {object|null} The line.
 * @example
 * findLine(lines, 'tram 1'); // -> { id: 'L1', name: 'L1', mode: 'tram', … }
 */
function findLine(lines, typed) {
  const raw = String(typed ?? '').trim();
  if (!raw) {
    return null;
  }
  const byId = lines.find((line) => line.id.toLowerCase() === raw.toLowerCase());
  if (byId) {
    return byId;
  }
  const compact = (value) => fold(value).replace(/ /g, '');
  const tram = /^\s*(tram(way)?|tranv[ií]a|stra(ss|ß)enbahn)\b/i.test(raw);
  const wanted = compact(
    raw.replace(
      /^\s*(ligne|line|linie|l[ií]nea|tram(way)?|tranv[ií]a|stra(ss|ß)enbahn|bus|autobus)\s+/i,
      '',
    ),
  );
  if (!wanted) {
    return null;
  }
  // "5" is the bus "05"; "8" is "8+".
  const plain = (value) => compact(value).replace(/^0+(?=\d)/, '');
  const byName =
    lines.find((line) => compact(line.name) === wanted && (!tram || line.mode === MODES.TRAM)) ??
    lines.find((line) => plain(line.name) === plain(wanted) && (!tram || line.mode === MODES.TRAM));
  if (byName) {
    return byName;
  }
  // The trams are "L1", "L2", "L3": "tram 1", "T1" or "1" alone mean "L1".
  const digits = /^t?(\d+)$/.exec(wanted)?.[1];
  return digits
    ? (lines.find((line) => line.mode === MODES.TRAM && compact(line.name) === `l${digits}`) ??
        null)
    : null;
}

/**
 * @description Find a stop among the known ones.
 * @param {object[]} stops - The known stops.
 * @param {string} typed - A name, a stop code ("massena") or a platform code.
 * @returns {object|null} The stop.
 * @example
 * findStop(stops, 'massena'); // -> { code: 'massena', name: 'Masséna', … }
 */
function findStop(stops, typed) {
  const raw = String(typed ?? '').trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  const byCode = stops.find(
    (stop) =>
      stop.code === lower ||
      stop.platforms.some((code) => code.toLowerCase() === lower) ||
      stop.ids.includes(raw),
  );
  if (byCode) {
    return byCode;
  }
  const wanted = fold(raw);
  if (!wanted) {
    return null;
  }
  const exact = stops.filter((stop) => fold(stop.name) === wanted);
  if (exact.length > 0) {
    return exact.length === 1 ? exact[0] : null;
  }
  // A unique stop holding every typed word ("garib" -> "Garibaldi").
  const words = wanted.split(' ');
  const holding = stops.filter((stop) =>
    words.every((word) => ` ${fold(stop.name)} `.includes(` ${word}`)),
  );
  return holding.length === 1 ? holding[0] : null;
}

/**
 * @description Search stops by name, for the "Find a stop" button.
 * @param {object[]} stops - The known stops.
 * @param {string} query - Words of the name.
 * @param {number} [max] - The most stops returned.
 * @returns {object[]} The stops, exact names first, then names starting so.
 */
function searchStops(stops, query, max = 8) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const wanted = words.join(' ');
  const rank = (stop) => {
    const name = fold(stop.name);
    if (name === wanted) {
      return 0;
    }
    return name.startsWith(wanted) ? 1 : 2;
  };
  return stops
    .filter((stop) => words.every((word) => ` ${fold(stop.name)} `.includes(` ${word}`)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, max);
}

/**
 * @description A GTFS date, from a local date.
 * @param {number} instant - The instant (ms).
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} "20261027".
 */
const gtfsDate = (instant, timeZone) => localClock(instant, timeZone).date.replace(/-/g, '');

/**
 * @description The reference data and the timetables, through the API, kept
 * in the store and in a zip next to it.
 * @param {object} options - Options.
 * @param {object} options.api - The Lignes d'Azur client.
 * @param {object} options.store - The store (`data.network`).
 * @param {string} options.zipPath - Where the GTFS zip is kept.
 * @param {Function} options.now - `() => number` in ms.
 * @param {Function} options.isNewDay - `(readAt) => boolean`: a 04:00 passed since.
 * @param {string} [options.timeZone] - IANA timezone of the network.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The network.
 */
function createNetwork({ api, store, zipPath, now, isNewDay, timeZone = 'Europe/Paris', logger }) {
  // In memory only: rebuilt from the zip.
  let timetable = null;
  let checking = null;
  let building = null;
  let zipCache = null;

  const data = () => {
    if (!store.data.network || typeof store.data.network !== 'object') {
      store.data.network = { lines: null, stops: null, lastModified: '', checkedAt: 0 };
    }
    return store.data.network;
  };

  /**
   * @description The zip kept, read once.
   * @returns {Promise<Buffer|null>} Its bytes, null when absent.
   */
  async function readZip() {
    if (zipCache) {
      return zipCache;
    }
    try {
      zipCache = await readFile(zipPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger?.warn(`Unable to read ${zipPath}: ${err.message}`);
      }
      return null;
    }
    return zipCache;
  }

  /**
   * @description Keep a new zip (atomically).
   * @param {Buffer} zip - The archive.
   * @returns {Promise<void>}
   */
  async function writeZip(zip) {
    zipCache = zip;
    try {
      await mkdir(dirname(zipPath), { recursive: true });
      await writeFile(`${zipPath}.tmp`, zip);
      await rename(`${zipPath}.tmp`, zipPath);
    } catch (err) {
      logger?.warn(`Unable to write ${zipPath}: ${err.message}`);
    }
  }

  /**
   * @description Read the lines and stops of a zip into the store.
   * @param {Buffer} zip - The archive.
   * @returns {Promise<void>}
   */
  async function adopt(zip) {
    const gtfs = await readGtfs(zip);
    const lines = gtfs.routes.map(lineOf).sort(byLine);
    const stops = groupStops(gtfs.stops, gtfs.linesByStop);
    if (lines.length === 0 || stops.length === 0) {
      throw Object.assign(new Error('empty timetable'), { kind: 'invalid' });
    }
    Object.assign(data(), { lines, stops });
  }

  /**
   * @description Ask for the zip again when a new day began (or when forced),
   * and read it when it changed. A failure keeps what is known.
   * @param {boolean} [force] - Ask even when checked today.
   * @returns {Promise<void>}
   */
  function check(force = false) {
    const kept = data();
    const fresh = kept.lines && kept.stops && !isNewDay(kept.checkedAt);
    if (fresh && !force) {
      return Promise.resolve();
    }
    checking ??= (async () => {
      try {
        const zipKept = await readZip();
        // Without the zip on disk, the lines alone are not enough.
        const answer = await api.gtfs(zipKept ? kept.lastModified : '');
        if (answer) {
          await adopt(answer.zip);
          await writeZip(answer.zip);
          kept.lastModified = answer.lastModified;
          timetable = null;
          logger?.info(
            `Lignes d'Azur timetable read (${answer.zip.length} bytes, ${answer.lastModified})`,
          );
        } else if (!kept.lines || !kept.stops) {
          await adopt(zipKept);
        }
        kept.checkedAt = now();
        await store.save();
      } catch (err) {
        if (!kept.lines || !kept.stops) {
          throw err;
        }
        logger?.warn(
          `Lignes d'Azur timetable not read again (${err.kind ?? 'error'}): ${err.message}`,
        );
      } finally {
        checking = null;
      }
    })();
    return checking;
  }

  /**
   * @description The lines.
   * @param {boolean} [force] - Ask for the timetable again.
   * @returns {Promise<object[]>} The lines.
   */
  async function lines(force = false) {
    await check(force);
    return data().lines;
  }

  /**
   * @description The stops.
   * @param {boolean} [force] - Ask for the timetable again.
   * @returns {Promise<object[]>} The stops.
   */
  async function stops(force = false) {
    await check(force);
    return data().stops;
  }

  /**
   * @description The timetable holding some stops, built from the zip when
   * the day, the zip or the stops changed. The stops already held stay.
   * @param {object[]} wanted - The stops (`code`, `ids`).
   * @returns {Promise<object|null>} `{ from, to, codes, services, trips,
   * rows }`, null without a zip.
   */
  async function timetableOf(wanted) {
    await check();
    const current = now();
    const from = gtfsDate(current - DAY_MS, timeZone);
    const to = gtfsDate(current + 6 * DAY_MS, timeZone);
    const valid = timetable && timetable.from === from && timetable.version === data().lastModified;
    if (valid && wanted.every((stop) => timetable.codes.includes(stop.code))) {
      return timetable;
    }
    building ??= (async () => {
      try {
        const zip = await readZip();
        if (!zip) {
          return null;
        }
        const codes = [
          ...new Set([...(valid ? timetable.codes : []), ...wanted.map((stop) => stop.code)]),
        ];
        const known = data().stops ?? [];
        const ids = new Set(
          codes.flatMap((code) => known.find((stop) => stop.code === code)?.ids ?? []),
        );
        const started = Date.now();
        const gtfs = await readGtfs(zip, { stopIds: ids, from, to });
        timetable = { ...gtfs.timetable, codes, version: data().lastModified, builtAt: now() };
        logger?.info(
          `Lignes d'Azur timetable of ${codes.length} stop(s): ${timetable.rows.length} departures, ` +
            `${Date.now() - started} ms`,
        );
        return timetable;
      } finally {
        building = null;
      }
    })();
    await building;
    // Another stop may have been asked while building.
    return wanted.every((stop) => timetable?.codes.includes(stop.code))
      ? timetable
      : timetableOf(wanted);
  }

  return {
    check,
    lines,
    stops,
    timetable: timetableOf,
    /**
     * @description A line known without reading anything.
     * @param {string} id - The route id ("L1").
     * @returns {object|null} The line.
     */
    peekLine: (id) => data().lines?.find((line) => line.id === String(id)) ?? null,
    /**
     * @description The lines calling at a platform, known without reading.
     * @param {string} stopId - The platform id.
     * @returns {string[]} The route ids.
     */
    linesOfPlatform: (stopId) =>
      data().stops?.find((stop) => stop.ids.includes(String(stopId)))?.lines ?? [],
    /**
     * @description Resolve a typed line.
     * @param {string} typed - The line as typed.
     * @returns {Promise<object|null>} The line, null when unknown.
     */
    resolveLine: async (typed) => findLine(await lines(), typed),
    /**
     * @description Resolve a typed stop.
     * @param {string} typed - A name or a code.
     * @returns {Promise<object|null>} The stop.
     */
    resolveStop: async (typed) => findStop(await stops(), typed),
    /**
     * @description Search stops by name.
     * @param {string} query - Words of the name.
     * @returns {Promise<object[]>} The stops.
     */
    searchStops: async (query) => searchStops(await stops(), query),
    /**
     * @description What the diagnostic tells of the timetable.
     * @returns {object|null} Its window, stops and size.
     */
    describeTimetable: () =>
      timetable
        ? {
            from: timetable.from,
            to: timetable.to,
            stops: timetable.codes,
            departures: timetable.rows.length,
            builtAt: new Date(timetable.builtAt).toISOString(),
          }
        : null,
  };
}

export {
  MODES,
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
};
