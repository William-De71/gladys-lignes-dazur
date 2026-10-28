# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Lignes d'Azur, the trams and
buses of the Métropole Nice Côte d'Azur: a Node.js service (Node 22+, ESM, no
build step) that runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official open data of Lignes d'Azur
(no key, Licence Ouverte 2.0): the timetable (GTFS zip on
`chouette.enroute.mobi`, kept in /data and asked again daily with
If-Modified-Since) and the GTFS-RT trip updates of the whole network
(`ara-api.enroute.mobi`, one request for every followed stop). The passages
of the followed stops — three in the form, up to 10 more added with the "Add
a stop" button — come from the timetable corrected by the real time. The
network publishes no traffic alerts (neither GTFS-RT alerts nor SIRI
GeneralMessage / SituationExchange, checked on 2026-10-28): there is no line
device, no traffic widget, no line trigger.
Transport: cloud only.
Dataset: https://transport.data.gouv.fr/datasets/donnees-statiques-et-dynamiques-du-reseau-de-transport-lignes-dazur

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timers
src/rla-api.js          HTTP client of the open data of Lignes d'Azur: GTFS (304), trip updates, errors
src/gtfs.js             the GTFS zip (central directory + zlib, stop_times streamed) and its CSV
src/gtfs-rt.js          a GTFS Realtime (Protocol Buffers) decoder, without dependency
src/network.js          lines, stops (platforms of one name in one place), the timetable of the followed stops
src/departures.js       timetable + trip updates -> passages (real time, delay, cancelled)
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the stop devices and their states
src/widgets.js          the departures dashboard widget
src/store.js            /data/lignes-dazur.json: network, `seen` (the zip: /data/lignes-dazur-gtfs.zip)
src/time.js             Paris wall-clock times, times of day (TZ), the service day
src/config.js           configuration (three stops + `added_stops`, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real open data of Lignes d'Azur, reduced (Licence Ouverte 2.0): GTFS files, a feed
test/helpers/           the fake Lignes d'Azur: a zip writer, a GTFS-RT encoder, fetch
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`stop:<stop code>_<route id>_<direction>`, e.g.
  `stop:massena_l1_hopital-pasteur`; the stop code is the slug of the stop
  name, another place of the same slug gets "-2", "-3"… in the order of its
  smallest platform code), feature `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widgets and their settings, scene triggers
  (fields, options, variables) and scene actions (fields, outputs), and the
  internal config keys `added_stops` (`[{ stop, line, direction }]`, stored as
  stop codes and route ids) and `last_language`. `test/structure.test.js`
  compares them to `test/fixtures/discovery.baseline.json`: never update the
  baseline to make a test pass without a documented migration.
- **Category / type pairs.** The next passage is `text` / `text`, the waits
  and the delay `duration` / `integer` in minutes (0-180, 0-120). Without a
  passage the waits are not published (a 0 would announce a tram now); without
  real time the delay is not published.
- **`should_poll` stays false**: the integration reads on its own timer — the
  trip updates of the network in ONE request for every followed stop every
  `interval` (30 s to 5 min, 1 min by default; 10 min while no stop announces
  anything in the next half hour); the timetable daily after 04:00
  (If-Modified-Since: 304 when unchanged). A widget or a scene action reuses
  a reading of less than 90 s.
- **Memory.** The container has 256 MB: stop_times.txt (71 MB inflated) is
  inflated as a stream and scanned line by line, never held whole, and only
  the rows of the followed platforms are kept; the heap is bounded in the
  Dockerfile (a real reading peaks at about 150 MB RSS).
  The timetable of the stops lives in memory only (eight service days),
  rebuilt from the zip each day and when a stop is added.
- **Times.** GTFS times count from the noon of the service day in Paris minus
  12 hours (`serviceStart()`), beyond 24:00 after midnight; GTFS-RT times are
  Unix seconds. Never parse a GTFS time as a wall-clock time.
- **Real time.** A trip update is matched by trip id (the GTFS and the
  GTFS-RT share them), a platform by its id and the estimate closest to the
  timetable (loop lines call twice). Lignes d'Azur sends times, never a
  delay: the delay is the estimate minus the timetable. The trams run to a
  frequency and are often announced a few minutes early: an early passage
  has a negative delay, shown as no delay. A cancelled trip or a skipped
  platform is a cancelled passage (left out of the waits, shown in the widget, fired
  once by `departure_cancelled`). Without a trip update, the timetable only
  (say it: "(timetable)"). Never invent a delay.
- **Headsigns.** Some trips have none (the trams L3 and B): the name of their
  last stop stands for it (`gtfs.js`).
- **Events once.** `seen` (in /data) remembers the reminders fired and the
  cancellations reported per stop. The first reading of a stop is a baseline:
  nothing fires. A scene action or a widget never fires an event.
- **Data licence.** Licence Ouverte 2.0: keep "Lignes d’Azur" and the time of
  the reading visible in the widgets, and the credit (Lignes d'Azur, Métropole
  Nice Côte d'Azur) in the README, the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Names of stops and destinations
  stay in French.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `gladys_version` is `>=5.3.0` (widgets, scene triggers, catalog
  `keywords` and `countries`). Transport: `["cloud"]`. No permission, no
  secret.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake API of
  `test/helpers/fixtures.js`).
