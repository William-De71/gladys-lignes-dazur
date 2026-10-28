# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-10-28

### Added

- One device per followed stop of the Lignes d'Azur network of Nice (three in the form and up to 10 more with the "Add a stop" button, typed by name or by platform code, filtered by line and direction): the next departure as text, the wait of the next two departures and the delay of the next one, from the timetable corrected in real time.
- Scene triggers: departure soon (2 to 20 minutes before, on the real-time estimate) and departure cancelled (a cancelled trip or a skipped stop).
- Scene action: read the next departures of a stop (with the delay), with a ready-made sentence.
- Dashboard widget: the next departures of one or several stops, like the screens of the stops, with cancelled trips and delays highlighted (any stop can be typed in the widget).
- Configuration actions: test the connection, find a stop by name (with the codes of its platforms and its lines), add, list and remove stops, and a diagnostic written to the Logs tab.
- Cloud transport: the official open data of Lignes d'Azur (GTFS and GTFS-RT), no account and no key; the timetable downloaded once a day when it changed and kept in /data, the real time of every followed stop in one request every 30 seconds to 5 minutes.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-lignes-dazur/releases/tag/v0.1.0
