# Lignes d'Azur Nice

## Overview

This integration brings **Lignes d'Azur**, the trams and buses of the Métropole Nice Côte d'Azur, into Gladys. It gives the **next departures, corrected in real time, with their delay**, at the stops you choose (three in the form, up to 10 more with a button), filtered by line and direction. Each stop becomes a device to show on a dashboard and to use in scenes, and **cancelled trips** are reported.

The data come from the **official open data of Lignes d'Azur**, published on `transport.data.gouv.fr` under the Licence Ouverte 2.0 (Etalab): no account, no key. The **timetable** (GTFS) is downloaded once a day when it changed, and kept by the integration. The **real time** (GTFS-RT) of the whole network is read in **one request for every followed stop**, every minute by default (every 10 minutes while no stop announces anything in the next half hour, at night).

A departure is **followed in real time** a little before it leaves its terminus: its estimated time and its delay are given. Before that it is the **timetable**, marked "(timetable)". The trams are run to a frequency: the real time often announces them a few minutes before the timetable, and then gives no delay.

Lignes d'Azur publishes **no traffic information** in open data (no alert in the GTFS-RT, none in its SIRI feed): the integration does not show the traffic of the lines.

This is a **cloud** integration: it contacts `chouette.enroute.mobi` (timetable) and `ara-api.enroute.mobi` (real time), the open data servers of the network. Nothing else leaves your network.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Nothing else: the open data of Lignes d'Azur need no account and no key.

## Configuration

| Field                    | What to type                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Stop 1, 2, 3             | The name of the stop as written on it ("Masséna", "Gare Thiers / Poste") or the code of a platform ("MASSE2"). |
| Line                     | Only this line: "L1", "tram 2", "5", "Exp2". Empty: every line of the stop.                                    |
| Direction                | Only the destinations holding these words: "Hôpital Pasteur", "Aéroport \| Port Lympia". Empty: both ways.     |
| Reading of the real time | Every 30 seconds, minute, 2 minutes or 5 minutes.                                                              |
| Language of the texts    | Names of the devices, summaries and outputs of the scenes. Stop names and destinations stay in French.         |

A stop gathers the platforms of one name in one place, trams and buses: "Jean Médecin" gives both directions of the trams L1, L2 and L3 and the buses calling there. The same name in two places (such as "Le Château" in Nice and in Cagnes-sur-Mer) makes two stops: type the code of one of its platforms then. The **Find a stop** button gives the stops holding a few words, with the codes of their platforms and their lines ("Masséna [MASSE0, MASSE2, MASSV7] → L1, 8+, 12+, Exp3"). A few words are enough when only one stop holds them. **Test the connection** asks for the timetable again and reads each stop right away.

A line is written as on the vehicle: "L1", "L2", "L3" and "B" for the trams ("tram 1" or "T1" work too), "5", "8+", "Exp2", "C"…

More stops than the three of the form (home, work, school…): **Add a stop** takes the same three fields — stop, line, direction — and follows up to 10 more stops. **List the stops** shows every followed stop, numbered; **Remove a stop** takes that number (or the name). The added stops are kept in the configuration of Gladys, so they follow its backups.

## Usage

### Devices

In the **Discover** tab, create the devices you want. **Lignes d'Azur \<stop\>** gives the next departure as text ("L1 → Hôpital Pasteur · 3 min (+2 min late)"), the wait of the next departure and of the one after (minutes), and the delay of the next one (minutes, published only when it is followed in real time; a departure announced early counts 0).

At night, without any departure in the next three hours, the device shows the first departure of the morning.

### Dashboard widget

![The Lignes d'Azur departures widget at Jean Médecin and at several stops (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-lignes-dazur/main/docs/assets/widgets.en.png)

**Lignes d'Azur departures** shows the next departures of a stop, compact. One row per line and destination, with its next departures in a row ("2 · 17 min"). A cancelled trip is shown ("cancelled 10:48") and turns the row orange, like a delay of 5 minutes or more. The **Routes shown** setting sets the number of rows. Choose a followed stop, or type any stop (and a line) in the widget settings. With **Several stops**, one widget shows several stop devices: the devices of one stop are merged under its name; for different stops, each stop opens with a row of its own.

### Scenes

Triggers, once per change (the first reading is only a baseline):

- **Lignes d'Azur: departure soon**: a departure at a followed stop leaves in 2, 3, 5, 10, 15 or 20 minutes, counted on its real-time estimate.
- **Lignes d'Azur: departure cancelled**: a trip of the next hour at a followed stop is cancelled, or does not serve the stop.

Each gives a ready-made sentence, `{{triggerEvent.data.summary}}`, and its values (line, destination, time, delay…). The action **Lignes d'Azur: next departures** returns the same kind of values, to put in a message or to test in a condition.

Examples:

- When the tram L1 towards Hôpital Pasteur leaves Masséna in 5 minutes → turn the hall lamp green.
- When a departure of your stop is cancelled → send the summary to your phone before you leave.
- Every weekday at 7:30 → read the next departures of your stop and have the kitchen speaker announce them.

### Transport

Cloud only: the data come from the internet. The timetable once a day, the real time of the whole network in one request.

## Troubleshooting

- **"Unknown or ambiguous"**: use **Find a stop**, then copy the exact name or a platform code (a name found in two places needs a platform code); for a line, its name as on the vehicle ("L1", "5", "Exp2").
- **"(timetable)" for a departure**: the trip is not followed in real time yet (it has not left its terminus), or Lignes d'Azur does not follow it; the time is the one of the timetable.
- **A tram earlier than the timetable**: the trams run to a frequency, and the real time gives the time of the tram really coming; the delay then stays at 0.
- **No departure in the direction typed**: the destinations are the ones written on the vehicles ("Hôpital Pasteur", "Henri Sappia", "CADAM / Centre Administratif"); empty the direction to see them all.
- **No line traffic**: Lignes d'Azur publishes no traffic alert in open data; see lignesdazur.com.
- **"The open data of Lignes d’Azur do not answer"**: the integration tries again at each reading; meanwhile the departures come from the timetable kept.
- **To report a problem**: press **Diagnostic**, then copy the lines starting with "Lignes d’Azur diagnostic" from the Logs tab into a GitHub issue or a reply on the forum, with the versions of Gladys and of the integration.
