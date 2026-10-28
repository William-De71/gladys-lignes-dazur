import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  zipEntries,
  readEntry,
  eachEntryRow,
  splitCsvLine,
  eachRow,
  gtfsSeconds,
  serviceDates,
  readGtfs,
} from '../src/gtfs.js';
import { GTFS_ZIP, makeZip, gtfsFiles } from './helpers/fixtures.js';

test('a zip, deflated or stored, read through its central directory', async () => {
  for (const store of [false, true]) {
    const zip = makeZip({ 'a.txt': 'héllo', 'dir/b.txt': 'b' }, { store });
    const entries = zipEntries(zip);
    assert.deepEqual([...entries.keys()], ['a.txt', 'b.txt']);
    assert.equal((await readEntry(zip, entries, 'a.txt')).toString('utf8'), 'héllo');
    assert.equal(await readEntry(zip, entries, 'none.txt'), null);
  }
  assert.throws(() => zipEntries(Buffer.from('not a zip at all, not at all')), {
    kind: 'invalid',
  });
});

test('CSV: quotes, CRLF, a byte order mark', () => {
  assert.deepEqual(splitCsvLine('a,"b, c",d'), ['a', 'b, c', 'd']);
  assert.deepEqual(splitCsvLine('"say ""hi""",x'), ['say "hi"', 'x']);
  const rows = [];
  eachRow(Buffer.from('﻿id,name\r\n1,"Gare, Thiers"\r\n\r\n2,Masséna'), (row, column) =>
    rows.push([row[column('id')], row[column('name')]]),
  );
  assert.deepEqual(rows, [
    ['1', 'Gare, Thiers'],
    ['2', 'Masséna'],
  ]);
  eachRow(null, () => assert.fail('no row'));
});

test('GTFS times beyond midnight; the dates of the services', () => {
  assert.equal(gtfsSeconds('06:43:00'), 6 * 3600 + 43 * 60);
  assert.equal(gtfsSeconds('25:10:30'), 25 * 3600 + 10 * 60 + 30);
  assert.equal(gtfsSeconds('soon'), null);
  const calendar = Buffer.from(
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WEEK,1,1,1,1,1,0,0,20261001,20261231\n',
  );
  const dates = Buffer.from(
    'service_id,date,exception_type\nWEEK,20261028,2\nSUN,20261101,1\nOLD,20250101,1\n',
  );
  assert.deepEqual(Object.fromEntries(serviceDates(calendar, dates, '20261026', '20261102')), {
    WEEK: ['20261026', '20261027', '20261029', '20261030', '20261102'],
    SUN: ['20261101'],
  });
});

test('a big file inflated as a stream: lines across chunks, CRLF, no final newline', async () => {
  // Over 1 MB of rows of every length: many cut between two chunks of 256 KB.
  const lines = ['trip_id,stop_id,name'];
  for (let index = 0; lines.join('\r\n').length < 1200000; index += 1) {
    lines.push(`T${index},${index % 977},"Arrêt, ${'é'.repeat(index % 53)}"`);
  }
  const text = `\uFEFF${lines.join('\r\n')}`;
  const expected = [];
  eachRow(Buffer.from(text), (row, column) => expected.push(row[column('name')]));
  assert.equal(expected.length, lines.length - 1);
  for (const store of [false, true]) {
    const zip = makeZip({ 'stop_times.txt': text }, { store });
    const rows = [];
    await eachEntryRow(zip, zipEntries(zip), 'stop_times.txt', (row, column) => {
      rows.push(row[column('name')]);
    });
    assert.deepEqual(rows, expected);
  }
  // The last line, without its line break, is read too.
  assert.equal(expected.at(-1), `Arrêt, ${'é'.repeat((lines.length - 2) % 53)}`);
  const zip = makeZip({ 'a.txt': 'a' });
  await eachEntryRow(zip, zipEntries(zip), 'none.txt', () => assert.fail('no row'));
});

test('the GTFS of Lignes d’Azur: reference data, then the departures of some platforms', async () => {
  const reference = await readGtfs(GTFS_ZIP);
  assert.equal(reference.routes.length, 17);
  assert.equal(reference.stops.length, 555);
  assert.equal(reference.timetable, null);
  // Jean Médecin, the platform of the trams L2 and L3 towards Port Lympia.
  assert.deepEqual(reference.linesByStop['2608'], ['L3', 'L2']);
  const { timetable } = await readGtfs(GTFS_ZIP, {
    stopIds: new Set(['2522', '2523']),
    from: '20261027',
    to: '20261029',
  });
  assert.ok(timetable.rows.length > 20);
  for (const [tripId, stopId, seconds] of timetable.rows) {
    assert.ok(['2522', '2523'].includes(stopId));
    assert.ok(seconds > 10 * 3600 && seconds < 12 * 3600);
    const trip = timetable.trips[tripId];
    assert.equal(trip[0], 'L1', tripId);
    assert.ok(['Hôpital Pasteur', 'Henri Sappia'].includes(trip[2]), trip[2]);
    // The services come from calendar.txt: the weekdays.
    assert.ok(timetable.services[trip[1]].includes('20261028'));
  }
  // A terminus is an arrival, never a departure (the rows are not in order).
  const rows = gtfsFiles()
    ['stop_times.txt'].trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','));
  const [tripId] = rows[0];
  const last = rows
    .filter((row) => row[0] === tripId)
    .sort((a, b) => Number(b[4]) - Number(a[4]))[0];
  const { timetable: end } = await readGtfs(GTFS_ZIP, {
    stopIds: new Set([last[3]]),
    from: '20261027',
    to: '20261029',
  });
  assert.ok(!end.rows.some((row) => row[0] === tripId));
});

test('a trip without a headsign heads for its last stop', async () => {
  // The trams L3 and B have no headsign in the GTFS of Lignes d'Azur.
  const { timetable } = await readGtfs(GTFS_ZIP, {
    stopIds: new Set(['2812']),
    from: '20261028',
    to: '20261028',
  });
  const tram = Object.values(timetable.trips).filter((trip) => trip[0] === 'B');
  assert.ok(tram.length > 0);
  assert.ok(tram.every((trip) => trip[2] === 'CADAM / Centre Administratif'));
  const zip = makeZip({
    'routes.txt': 'route_id,route_short_name,route_type\nX,X,3\n',
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nA,Alpha,43.7,7.2\nB,Bêta,43.7,7.3\n',
    'trips.txt': 'route_id,service_id,trip_id,trip_headsign\nX,S,T1,\nX,S,T2,Ailleurs\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nS,20261028,1\n',
    'stop_times.txt':
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,10:00:00,10:00:00,A,1\nT1,10:10:00,10:10:00,B,2\n' +
      'T2,11:00:00,11:00:00,A,1\nT2,11:10:00,11:10:00,B,2\n',
  });
  const small = await readGtfs(zip, { stopIds: new Set(['A']), from: '20261028', to: '20261028' });
  assert.equal(small.timetable.trips.T1[2], 'Bêta');
  assert.equal(small.timetable.trips.T2[2], 'Ailleurs');
});

test('a GTFS without its files is refused', async () => {
  await assert.rejects(readGtfs(makeZip({ 'agency.txt': 'agency_id\nlignes-d-azur\n' })), {
    kind: 'invalid',
  });
});
