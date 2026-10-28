// -----------------------------------------------------------------------------
// HTTP client of the open data of Lignes d'Azur, the trams and buses of the
// Métropole Nice Côte d'Azur:
// https://transport.data.gouv.fr/datasets/donnees-statiques-et-dynamiques-du-reseau-de-transport-lignes-dazur
// No key, Licence Ouverte 2.0 (Etalab). Two servers of the same publisher:
//   GTFS_URL          the timetable (10 MB zip, published every few days):
//                     read with If-Modified-Since (304 when unchanged), at
//                     most daily;
//   TRIP_UPDATES_URL  GTFS-RT trip updates of the whole network (450 KB,
//                     times only, no delay): ONE request for every followed
//                     stop.
// The vehicle positions are not used. The network publishes no service
// alerts: neither in GTFS-RT nor in its SIRI (no GeneralMessage, no
// SituationExchange), so the integration shows no line traffic.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { decodeFeed } from './gtfs-rt.js';

const GTFS_URL =
  process.env.RLA_GTFS_URL || 'https://chouette.enroute.mobi/api/v1/datas/OpendataRLA/gtfs.zip';
const TRIP_UPDATES_URL =
  process.env.RLA_TRIP_UPDATES_URL || 'https://ara-api.enroute.mobi/rla/gtfs/trip-updates';
const TIMEOUT_MS = 20000;
const GTFS_TIMEOUT_MS = 120000;
// The zip is about 10 MB: anything far bigger is not the timetable.
const GTFS_MAX_BYTES = 64 * 1024 * 1024;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-lignes-dazur/${version} (+https://github.com/William-De71/gladys-lignes-dazur)`;

const ENDPOINTS = {
  GTFS: 'gtfs',
  TRIP_UPDATES: 'trip_updates',
};

class RlaError extends Error {
  /**
   * @param {string} kind - `busy`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'RlaError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description A client of the open data of Lignes d'Azur.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {string} [options.gtfsUrl] - The timetable (tests, end-to-end runs).
 * @param {string} [options.tripUpdatesUrl] - The trip updates (same).
 * @returns {object} The methods, and `requests` for the diagnostic.
 */
function createRlaClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  gtfsUrl = GTFS_URL,
  tripUpdatesUrl = TRIP_UPDATES_URL,
} = {}) {
  // Requests made, per endpoint, for the diagnostic.
  const requests = { total: 0, byEndpoint: {}, failed: 0, notModified: 0, last: null };

  /**
   * @description Get a file of the open data.
   * @param {string} endpoint - ENDPOINTS, for the counters.
   * @param {string} url - The URL.
   * @param {object} [options] - `{ headers, timeout }`.
   * @returns {Promise<Response>} The answer (200 or 304).
   */
  async function call(endpoint, url, { headers = {}, timeout = TIMEOUT_MS } = {}) {
    requests.total += 1;
    requests.byEndpoint[endpoint] = (requests.byEndpoint[endpoint] ?? 0) + 1;
    requests.last = now();
    let response;
    try {
      response = await fetchFn(url, {
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      requests.failed += 1;
      throw new RlaError('unreachable', err.cause?.code ?? err.message);
    }
    if (response.status === 304) {
      requests.notModified += 1;
      return response;
    }
    if (!response.ok) {
      requests.failed += 1;
      let kind = 'unreachable';
      if (response.status === 429 || response.status === 503) {
        kind = 'busy';
      } else if (response.status >= 400 && response.status < 500) {
        kind = 'invalid';
      }
      throw new RlaError(kind, `${endpoint}: HTTP ${response.status}`, {
        status: response.status,
      });
    }
    return response;
  }

  /**
   * @description The bytes of an answer.
   * @param {string} endpoint - ENDPOINTS.
   * @param {Response} response - The answer.
   * @param {number} [max] - The largest accepted size.
   * @returns {Promise<Buffer>} The bytes.
   */
  async function bytesOf(endpoint, response, max = GTFS_MAX_BYTES) {
    let body;
    try {
      body = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      requests.failed += 1;
      throw new RlaError('unreachable', `${endpoint}: ${err.message}`);
    }
    if (body.length > max) {
      requests.failed += 1;
      throw new RlaError('invalid', `${endpoint}: ${body.length} bytes`);
    }
    return body;
  }

  /**
   * @description A GTFS-RT feed.
   * @param {string} endpoint - ENDPOINTS.
   * @param {string} url - The URL.
   * @returns {Promise<object>} decodeFeed().
   */
  async function feed(endpoint, url) {
    const response = await call(endpoint, url);
    const body = await bytesOf(endpoint, response, 8 * 1024 * 1024);
    try {
      return decodeFeed(body);
    } catch (err) {
      requests.failed += 1;
      throw new RlaError('invalid', `${endpoint}: ${err.message}`);
    }
  }

  return {
    requests,
    /**
     * @description The timetable, when it changed.
     * @param {string} [lastModified] - The Last-Modified of the copy kept.
     * @returns {Promise<{ zip: Buffer, lastModified: string }|null>} The
     * archive, null when unchanged (304).
     */
    gtfs: async (lastModified = '') => {
      const response = await call(ENDPOINTS.GTFS, gtfsUrl, {
        headers: lastModified ? { 'if-modified-since': lastModified } : {},
        timeout: GTFS_TIMEOUT_MS,
      });
      if (response.status === 304) {
        return null;
      }
      const zip = await bytesOf(ENDPOINTS.GTFS, response);
      return { zip, lastModified: response.headers.get('last-modified') ?? '' };
    },
    /**
     * @description The trip updates of the whole network.
     * @returns {Promise<object>} `{ timestamp, tripUpdates }`.
     */
    tripUpdates: () => feed(ENDPOINTS.TRIP_UPDATES, tripUpdatesUrl),
  };
}

export { GTFS_URL, TRIP_UPDATES_URL, USER_AGENT, ENDPOINTS, RlaError, createRlaClient };
