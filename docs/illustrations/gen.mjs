// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The departures widget on a real Wednesday morning in Nice: the open data of
// Lignes d'Azur read on 2026-10-28 at 10:37 and kept in test/fixtures (the
// GTFS of the day and the trip updates of that minute) go through the real
// code (src/gtfs.js, src/departures.js) and the real widget builder
// (src/widgets.js): Jean Médecin alone, then Masséna and Gare Thiers / Poste
// in one list. Added to show what the widget does: a cancelled tram L2.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildDeparturesWidget } = await load('src/widgets.js');
const { LANGUAGES } = await load('src/i18n.js');
const { NOW, TZ, fixturePassages } = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const passages = await fixturePassages('Jean Médecin');
// The second tram L2 towards the airport cancelled.
const airport = passages.filter((p) => p.lineId === 'L2' && p.destination.startsWith('Aéroport'));
airport[1].cancelled = true;
const boards = [
  { title: 'Masséna', passages: await fixturePassages('Masséna'), readAt: NOW },
  {
    title: 'Gare Thiers / Poste',
    passages: await fixturePassages('Gare Thiers / Poste'),
    readAt: NOW,
  },
];

const contents = {};
for (const language of LANGUAGES) {
  const options = { count: 6, language, now: NOW, timeZone: TZ };
  contents[language] = {
    departures: buildDeparturesWidget({
      title: 'Jean Médecin',
      passages,
      readAt: NOW,
      ...options,
    }),
    several: buildDeparturesWidget({ boards, ...options, count: 3 }),
  };
}
const card = manifest.widgets.find((w) => w.key === 'departures');
// The second card is the same widget, set to several stops.
const widgets = {
  departures: { icon: card.icon, label: card.label },
  several: { icon: card.icon, label: card.label },
};
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
