# Lignes d'Azur Nice

## Überblick

Diese Integration bringt **Lignes d’Azur**, die Trams und Busse der Métropole Nice Côte d’Azur, in Gladys. Sie liefert die **nächsten Abfahrten, in Echtzeit korrigiert, mit ihrer Verspätung**, an den Haltestellen deiner Wahl (drei im Formular, bis zu 10 weitere per Schaltfläche), gefiltert nach Linie und Richtung. Jede Haltestelle wird ein Gerät, das du auf einem Dashboard anzeigen und in Szenen nutzen kannst, und **ausgefallene Fahrten** werden gemeldet.

Die Daten stammen aus den **offiziellen Open Data von Lignes d’Azur**, veröffentlicht auf `transport.data.gouv.fr` unter der Licence Ouverte 2.0 (Etalab): kein Konto, kein Schlüssel. Der **Fahrplan** (GTFS) wird einmal am Tag heruntergeladen, wenn er sich geändert hat, und von der Integration gespeichert. Die **Echtzeit** (GTFS-RT) des ganzen Netzes wird in **einer einzigen Anfrage für alle verfolgten Haltestellen** gelesen, standardmäßig jede Minute (alle 10 Minuten, solange keine Haltestelle in der nächsten halben Stunde etwas ankündigt, also nachts).

Eine Abfahrt wird **in Echtzeit verfolgt**, kurz bevor sie ihre Endhaltestelle verlässt: Ihre geschätzte Zeit und ihre Verspätung werden angegeben. Davor gilt der **Fahrplan**, markiert mit „(Fahrplan)“. Die Trams fahren im Takt: Die Echtzeit kündigt sie oft einige Minuten vor dem Fahrplan an und gibt dann keine Verspätung.

Lignes d’Azur veröffentlicht **keine Verkehrsmeldungen** als Open Data (keine Meldung im GTFS-RT, keine in seinem SIRI-Feed): Die Integration zeigt keine Verkehrslage der Linien.

Dies ist eine **Cloud**-Integration: Sie kontaktiert `chouette.enroute.mobi` (Fahrplan) und `ara-api.enroute.mobi` (Echtzeit), die Open-Data-Server des Netzes. Sonst verlässt nichts dein Netzwerk.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Sonst nichts: Die Open Data von Lignes d’Azur brauchen weder Konto noch Schlüssel.

## Konfiguration

| Feld                | Was einzugeben ist                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Haltestelle 1, 2, 3 | Der Name der Haltestelle, wie er dort steht („Masséna“, „Gare Thiers / Poste“), oder der Code eines Bahnsteigs („MASSE2“). |
| Linie               | Nur diese Linie: „L1“, „tram 2“, „5“, „Exp2“. Leer: alle Linien der Haltestelle.                                           |
| Richtung            | Nur die Ziele, die diese Wörter enthalten: „Hôpital Pasteur“, „Aéroport \| Port Lympia“. Leer: beide Richtungen.           |
| Lesen der Echtzeit  | Alle 30 Sekunden, jede Minute, alle 2 Minuten oder alle 5 Minuten.                                                         |
| Sprache der Texte   | Namen der Geräte, Zusammenfassungen und Ausgaben der Szenen. Haltestellennamen und Ziele bleiben auf Französisch.          |

Eine Haltestelle fasst die Bahnsteige eines Namens an einem Ort zusammen, Trams und Busse: „Jean Médecin“ liefert beide Richtungen der Trams L1, L2 und L3 und die Busse, die dort halten. Derselbe Name an zwei Orten (etwa „Le Château“ in Nizza und in Cagnes-sur-Mer) ergibt zwei Haltestellen: Gib dann den Code eines ihrer Bahnsteige ein. Die Schaltfläche **Haltestelle suchen** liefert die Haltestellen mit einigen Wörtern, mit den Codes ihrer Bahnsteige und ihren Linien („Masséna [MASSE0, MASSE2, MASSV7] → L1, 8+, 12+, Exp3“). Einige Wörter genügen, wenn nur eine Haltestelle sie enthält. **Verbindung testen** fragt den Fahrplan erneut ab und liest jede Haltestelle sofort.

Eine Linie wird geschrieben wie auf dem Fahrzeug: „L1“, „L2“, „L3“ und „B“ für die Trams („tram 1“ oder „T1“ gehen auch), „5“, „8+“, „Exp2“, „C“…

Mehr Haltestellen als die drei des Formulars (Zuhause, Arbeit, Schule…): **Haltestelle hinzufügen** nimmt dieselben drei Felder — Haltestelle, Linie, Richtung — und verfolgt bis zu 10 weitere Haltestellen. **Haltestellen auflisten** zeigt alle verfolgten Haltestellen, nummeriert; **Haltestelle entfernen** nimmt diese Nummer (oder den Namen). Die hinzugefügten Haltestellen werden in der Konfiguration von Gladys gespeichert und sind so in seinen Sicherungen enthalten.

## Verwendung

### Geräte

Lege im Tab **Entdecken** die gewünschten Geräte an. **Lignes d’Azur \<Haltestelle\>** liefert die nächste Abfahrt als Text („L1 → Hôpital Pasteur · 3 Min. (+2 Min. Verspätung)“), die Wartezeit der nächsten Abfahrt und der folgenden (Minuten) und die Verspätung der nächsten (Minuten, nur veröffentlicht, wenn sie in Echtzeit verfolgt wird; eine früher angekündigte Abfahrt zählt 0).

Nachts, ohne Abfahrt in den nächsten drei Stunden, zeigt das Gerät die erste Abfahrt am Morgen.

### Dashboard-Widget

![Das Widget der Lignes-d’Azur-Abfahrten an Jean Médecin und an mehreren Haltestellen (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-lignes-dazur/main/docs/assets/widgets.de.png)

**Lignes d’Azur Abfahrten** zeigt die nächsten Abfahrten einer Haltestelle, kompakt. Eine Zeile pro Linie und Ziel, mit ihren nächsten Abfahrten hintereinander („2 · 17 Min.“). Eine ausgefallene Fahrt wird angezeigt („entfällt 10:48“) und färbt die Zeile orange, wie eine Verspätung ab 5 Minuten. Die Einstellung **Angezeigte Fahrten** legt die Zahl der Zeilen fest. Wähle eine verfolgte Haltestelle oder gib in den Widget-Einstellungen eine beliebige Haltestelle (und eine Linie) ein. Mit **Mehrere Haltestellen** zeigt ein Widget mehrere Haltestellengeräte: Die Geräte einer Haltestelle werden unter ihrem Namen zusammengefasst; bei verschiedenen Haltestellen beginnt jede mit einer eigenen Zeile.

### Szenen

Auslöser, einmal pro Änderung (das erste Lesen dient nur als Ausgangswert):

- **Lignes d’Azur: Abfahrt bald**: Eine Abfahrt an einer verfolgten Haltestelle fährt in 2, 3, 5, 10, 15 oder 20 Minuten, gezählt nach der Echtzeit-Schätzung.
- **Lignes d’Azur: Abfahrt entfällt**: Eine Fahrt der nächsten Stunde an einer verfolgten Haltestelle entfällt oder bedient die Haltestelle nicht.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Linie, Ziel, Uhrzeit, Verspätung…). Die Aktion **Lignes d’Azur: nächste Abfahrten** liefert dieselbe Art von Werten, für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn die Tram L1 Richtung Hôpital Pasteur in 5 Minuten an Masséna abfährt → die Flurlampe grün schalten.
- Wenn eine Abfahrt deiner Haltestelle entfällt → die Zusammenfassung vor dem Losgehen an dein Telefon schicken.
- Jeden Werktag um 7:30 → die nächsten Abfahrten deiner Haltestelle lesen und vom Küchenlautsprecher ansagen lassen.

### Transport

Nur Cloud: Die Daten kommen aus dem Internet. Der Fahrplan einmal am Tag, die Echtzeit des ganzen Netzes in einer Anfrage.

## Fehlerbehebung

- **„Unbekannt oder mehrdeutig“**: Nutze **Haltestelle suchen** und kopiere den genauen Namen oder einen Bahnsteigcode (ein Name an zwei Orten braucht einen Bahnsteigcode); bei einer Linie ihren Namen wie auf dem Fahrzeug („L1“, „5“, „Exp2“).
- **„(Fahrplan)“ bei einer Abfahrt**: Die Fahrt wird noch nicht in Echtzeit verfolgt (sie hat ihre Endhaltestelle noch nicht verlassen), oder Lignes d’Azur verfolgt sie nicht; die Zeit ist die des Fahrplans.
- **Eine Tram früher als im Fahrplan**: Die Trams fahren im Takt, und die Echtzeit gibt die Zeit der Tram, die wirklich kommt; die Verspätung bleibt dann bei 0.
- **Keine Abfahrt in der eingegebenen Richtung**: Die Ziele sind die auf den Fahrzeugen („Hôpital Pasteur“, „Henri Sappia“, „CADAM / Centre Administratif“); leere die Richtung, um alle zu sehen.
- **Keine Verkehrslage der Linien**: Lignes d’Azur veröffentlicht keine Verkehrsmeldungen als Open Data; siehe lignesdazur.com.
- **„Die Open Data von Lignes d’Azur antworten nicht“**: Die Integration versucht es bei jedem Lesen erneut; bis dahin kommen die Abfahrten aus dem gespeicherten Fahrplan.
- **Ein Problem melden**: Drücke **Diagnose**, kopiere dann die Zeilen, die mit „Lignes d’Azur diagnostic“ beginnen, aus dem Tab Protokolle in ein GitHub-Issue oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration.
