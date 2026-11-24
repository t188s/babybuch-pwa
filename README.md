# Babybuch – Web-App (PWA)

Eigenständige Web-App für Familien, getrennt von der Home-Assistant-Version (Pi).
Verbesserungen fließen nur in eine Richtung: von der Pi-Version in die Web-App.

- Läuft auf iPhone (Safari) und Android (Chrome), installierbar über „Zum Home-Bildschirm“, offline nutzbar
- **Alle Daten bleiben auf dem Handy** (IndexedDB) – kein Server, keine Anmeldung
- Abgleich zwischen den Eltern über eine **Backup-Datei** (Teilen-Menü), mit Zusammenführen, Papierkorb (30 Tage) und Rückgängig
  - **feldweise**: ändert ein Elternteil die Dauer und der andere die Notiz, bleiben beide Änderungen erhalten; beim selben Feld gewinnt die neueste
- Mehrere Kinder; Kind entfernen (30 Tage Papierkorb, zurückholbar)
- **Beispielkind** zum Ausprobieren und Vorführen: „Beispielkind ansehen“ im Willkommensfenster bzw. „+ Beispielkind“ unter Kinder (≈ 6 Wochen, alle Bereiche, frei erfunden)

## Aufbau: Pi-Oberfläche 1:1 + „lokaler Pi“ (Hybrid, Stand 0.2.0)

Die Oberfläche ist die der Pi-Version (derzeit **3.0.2**), inklusive automatischer Anpassung an jede Bildschirmgröße.
Sie fragt wie gewohnt `api/…` an. Die **Weiche** fängt diese Anfragen ab und beantwortet sie im Handy –
mit denselben Regeln wie `app.py` auf dem Pi, aber je Kind und mit Löschmarkern fürs Zusammenführen.

```
index.html                 Oberfläche der Pi-Version – NICHT von Hand ändern, sondern erzeugen (siehe unten)
css/pwa.css                Ergänzungen (Backup-Hinweis, Kind-Knopf)
js/lokal/weiche.js         leitet fetch("api/…") an den lokalen Pi um
js/lokal/server.js         Router: Anfrage → passendes Modul
js/lokal/api/*.js          ein Modul je Schnittstellen-Gruppe (Stillen/Windeln/Stoppuhr, Wachstum, Gesundheit, U-Heft, Einstellungen, Nutzung)
js/lokal/tabellen.js       „Tabellen“ wie in SQLite – je Kind, ganzzahlige ids für die Oberfläche
js/kern/                   Speicher, Zusammenführen, Backup-Datei, Abgleich-Wege, Kinder (unabhängig von der Oberfläche)
js/pwa/kinder-backup.js    Web-App-eigene Fenster: Kind anlegen/wechseln, Backup teilen/laden, Papierkorb
werkzeuge/pi_uebernehmen.py  erzeugt index.html aus einer Pi-Version
```

### Neue Pi-Version übernehmen

```
python3 werkzeuge/pi_uebernehmen.py still_tracker_X.Y.Z.zip
```

Das Skript nimmt `templates/index.html` und ändert nur genau benannte Stellen (Version, Weiche, Kind-Knopf,
Backup statt Sicherungen, ohne Widget/Home-Assistant-Erinnerung). Hat sich eine dieser Stellen geändert,
bricht es mit klarer Meldung ab. Neue Schnittstellen der Pi-Version müssen in `js/lokal/api/` nachgezogen werden –
der Vergleichstest zeigt, wo.

## Unterschiede zur Pi-Version

| Pi | Web-App |
|---|---|
| Daten auf dem Pi, beide iPhones live | Daten im Handy, Abgleich per Backup-Datei |
| Sicherungskopien auf dem Pi | Backup teilen/laden, Papierkorb 30 Tage |
| Widget, Kurzbefehle, Erinnerung über die HA-App | entfallen; Erinnerung über den Kalender des Handys |
| Startdaten U-Heft (eigener Datensatz) | entfallen – jede Familie trägt selbst ein |
| Kalender (.ics) | wie Pi, dazu täglicher Serientermin für regelmäßige Gaben (0.3.0) |
| Bericht, CSV-Tabellen | **folgen** (Plan: docs/ETAPPE_2.md) |

## Testen

```
npm test                                             # Kern: Zusammenführen, Backup-Datei
python3 tests/vergleich_mit_pi.py . <pi-ordner>      # gleiche Antworten wie der Pi-Server (Flask)
python3 tests/zwei_handys.py .                       # zwei Handys tauschen Backups aus
python3 tests/klicktest.py . /tmp/fotos              # alle Reiter, 360×550 bis 1024×768
```

Stand 0.2.0: 86 Anfragen gegen den Pi-Server 3.0.2 – 85 gleich, 1 gewollte Abweichung (Text „Handy“ statt „iPhone“).

## Neue Version ausliefern

`js/kern/version.js` und `CACHE` in `sw.js` gleich hochzählen, dann `werkzeuge/pi_uebernehmen.py` erneut ausführen
(die Versionsnummer steht auch in der Oberfläche). Neue Dateien in die Liste `DATEIEN` in `sw.js` eintragen.

## Grundsätze

Reine Dokumentation: keine Diagnose, keine Dosis-Berechnung, keine Fotos. Ersetzt keine Hebamme und keinen Arzt.
