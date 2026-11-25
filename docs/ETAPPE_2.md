# Etappe 2 – Bericht, CSV, Kalender

Entscheidungen 23.11.2026:

| Thema | Entscheidung |
|---|---|
| Bericht | Seite zum Ansehen, „Drucken“ bzw. „Als PDF sichern“ über das Teilen-Menü – wie auf dem Pi |
| Ablage | erstellte Berichte auf dem Handy, die letzten 50; **nicht** im Backup |
| CSV | Export **und** Import – der Import liest auch die CSV-Dateien der Pi-Version (Umzug vom Pi möglich) |
| Kalender | Vorsorge-Termine wie Pi; **neu:** nach dem Anlegen einer regelmäßigen Gabe fragt die App, ob sie täglich (je Uhrzeit, Erinnerung zur Uhrzeit) in den Kalender soll |

## Stand

- [x] **Kalender** (0.3.0) – `js/pwa/kalender.js`. Termin-Datei identisch mit `/kalender.ics` des Pi 3.0.2 (geprüft),
      Serientermin für Gaben. Noch auf echten Handys prüfen: iPhone öffnet „Zum Kalender hinzufügen“, Android lädt die Datei.
- [ ] **CSV-Export** – Pi `app.py` Teil 7 (Zeile ~1897–2100, 3.0.2): stillen, windeln, gewicht, groesse, fieber, symptome,
      medikamente, gaben, impfungen, uheft, Vorlagen. Ziel: `js/lokal/csv/export.js`; Weiche fängt `a[href^="export/"]` ab
      und gibt die Datei über Teilen-Menü/Download aus (UTF-8 mit BOM, `;`, CRLF wie Pi).
- [ ] **CSV-Import** – Pi `import_auswerten` + `/api/import/<art>` (Zeile ~2100–2355): Vorschau, Doppelte überspringen,
      alte Formate (0.3–1.x), Excel/Numbers-tolerant. Ziel: `js/lokal/csv/import.js`, Route `import/:art` ersetzt den Platzhalter
      in `js/lokal/api/sonstiges.js`. Testdatei-Regeln aus der Pi-Wunschliste (8 Zeilen mit allen Fallstricken) übernehmen.
- [ ] **Bericht** – Pi `app.py` Teil 8 (Zeile ~2356–3010) + `templates/bericht.html` (Jinja, 453 Zeilen):
      Daten (`bericht()`), Grafiken (`svg_rhythmus`, `svg_zeitleiste`, `svg_balken`, `svg_wachstum`, `trend_eimer`) und Vorlage
      nach JavaScript. Ziel: `bericht.html` (statische Seite der Web-App, liest dieselben Parameter wie `/bericht?…`),
      `js/lokal/bericht/{daten,grafiken,vorlage}.js`. `pi_uebernehmen.py`: Link `bericht?` → `bericht.html?`.
      Ablage (letzte 50) in IndexedDB, Liste in „Kinder, Backup & Abgleich“; Route `berichte` liefert sie.
- [ ] **Bericht: Fläschchen, Abpumpen, Beikost** (seit Web 0.7.0, gibt es auf dem Pi noch nicht) – eigener Berichtsteil
      „ernaehrung“ (Kennzahlen wie Auswertung › Fläschchen, Beikost-Liste mit „zum ersten Mal“); Daten über `js/kern/ernaehrung.js`.
- [ ] **Vergleichstest** erweitern: CSV-Export und Bericht gegen den Pi-Server (gleiche Daten → gleicher Text bzw. gleiche Zahlen).
