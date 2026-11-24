"""Babybuch PWA · Oberfläche der Pi-Version übernehmen

Aufruf:  python3 werkzeuge/pi_uebernehmen.py <still_tracker_X.Y.Z.zip oder Ordner still_tracker>

Erzeugt index.html der Web-App aus templates/index.html der Pi-Version – mit wenigen, genau benannten Änderungen.
Jede Änderung prüft, dass ihre Stelle genau einmal vorkommt. Hat sich die Pi-Oberfläche an einer dieser Stellen
geändert, bricht das Skript mit einer klaren Meldung ab, statt still etwas Falsches zu bauen.
So lässt sich jede neue Pi-Version mit einem Befehl übernehmen.
"""

import pathlib
import re
import sys
import zipfile

WEB_VERSION_DATEI = pathlib.Path(__file__).resolve().parent.parent / "js" / "kern" / "version.js"
ZIEL = pathlib.Path(__file__).resolve().parent.parent / "index.html"


def pi_lesen(quelle):
    q = pathlib.Path(quelle)
    if q.is_dir():
        index = (q / "templates" / "index.html").read_text(encoding="utf-8")
        config = (q / "config.yaml").read_text(encoding="utf-8")
    else:
        with zipfile.ZipFile(q) as z:
            name = lambda ende: next(n for n in z.namelist() if n.endswith(ende))
            index = z.read(name("templates/index.html")).decode("utf-8")
            config = z.read(name("config.yaml")).decode("utf-8")
    pi_version = re.search(r'^version:\s*"?([^"\n]+)"?', config, re.M).group(1)
    return index, pi_version


def ersetzen(text, alt, neu, anzahl=1, was=""):
    gefunden = text.count(alt)
    if gefunden != anzahl:
        sys.exit(f"Stelle nicht eindeutig ({gefunden}× statt {anzahl}×): {was or alt[:70]!r}")
    return text.replace(alt, neu)


def uebernehmen(index, pi_version, web_version):
    v = f"Web {web_version} · Pi {pi_version}"
    s = index
    # 1) Versionsnummer (Flask-Vorlage) – Nutzungsstatistik zählt je Web-Version
    s = ersetzen(s, 'const VERSION = "{{ version }}"', f'const VERSION = "web-{web_version}"', was="Version Nutzung")
    s = ersetzen(s, "{{ version }}", v, anzahl=2, was="Version sichtbar")
    if "{{" in s or "{%" in s:
        sys.exit("Unbekannte Vorlagen-Stelle ({{ … }}) in der Pi-Oberfläche – bitte prüfen.")
    # 2) Symbole und Weiche (vor dem Skript der Oberfläche)
    s = ersetzen(s, 'href="static/icon-180.png"', 'href="icons/icon-180.png"')
    s = ersetzen(s, 'href="static/icon-192.png"', 'href="icons/icon-192.png"')
    s = ersetzen(s, "</head>", '  <script src="js/pwa/design.js"></script>\n  <script src="js/lokal/weiche.js"></script>\n  <link rel="stylesheet" href="css/pwa.css">\n</head>')
    # Design-Wahl (Web-Version): Schwarz-Dusty-Blue (Standard) oder Schwarz-Gold, vor dem Nachtmodus-Schalter
    s = ersetzen(s, '''  <div class="einstellung">
    <label for="nachtmodus">Gedimmt in der Nacht''', '''  <div class="einstellung pwa-design">
    <label>Design<br><span class="zuletzt-hinweis">gilt nur für dieses Handy</span></label>
    <div class="umschalter" id="pwa-design" role="group" aria-label="Design">
      <button type="button" data-design="blau">Dusty Blue</button><button type="button" data-design="gold">Gold</button>
    </div>
  </div>
  <div class="einstellung">
    <label for="nachtmodus">Gedimmt in der Nacht''')
    # Einstellungen gelten in der Web-App pro Kind und Handy (nicht „für alle Geräte“ wie beim Pi-Server)
    s = ersetzen(s, '<p class="unter">Gelten für alle Geräte der Familie.</p>',
                 '<p class="unter">Gelten für das angezeigte Kind. Aufs Partnerhandy kommen sie mit dem Backup.</p>')
    # Kinddaten nur an einer Stelle bearbeiten: im Abschnitt „Baby“ steht eine Zusammenfassung mit „Ändern“ (Kind-Dialog);
    # die Pi-Felder bleiben unsichtbar im Dokument, damit der Pi-Code unverändert läuft.
    s = ersetzen(s, '<h3>Baby</h3>\n    <div class="einstellung">\n      <label for="baby-name">',
                 '<h3>Baby</h3>\n    <div id="pwa-baby"></div>\n    <div id="pi-baby-felder" hidden>\n    <div class="einstellung">\n      <label for="baby-name">')
    s = ersetzen(s, '<p class="unter" id="baby-gg-vorschlag" style="margin:-4px 0 0;text-align:right" hidden></p>',
                 '<p class="unter" id="baby-gg-vorschlag" style="margin:-4px 0 0;text-align:right" hidden></p>\n    </div>')
    # 3) Kopfzeile: Kind-Knopf „Name ▾“ – immer sichtbar (Entscheidung 24.11.), links neben dem Seitentitel.
    #    Auf schmalen Handys ersetzt er den Seitentitel (welcher Reiter offen ist, zeigt die Leiste unten) – so bleibt
    #    rechts Platz für Stoppuhr, „○ Vitamin D“ und „Bericht“ wie in der Pi-Version.
    s = ersetzen(s, '<h1 id="kopf-titel">Stillen</h1>',
                 '<h1 id="kopf-titel">Stillen</h1>\n      <button type="button" class="pwa-kind" id="pwa-kind" hidden aria-label="Kind wechseln"></button>')
    # 4) Backup-Hinweis oben im Inhalt
    s = ersetzen(s, '<div class="inhalt">', '<div class="inhalt">\n  <div class="pwa-hinweis" id="pwa-hinweis" hidden></div>')
    # 5) Widget-Seite gibt es nicht → Kinder & Backup
    s = ersetzen(s, '<a href="widget">iPhone-Widget einrichten</a>',
                 '<button type="button" id="pwa-daten-2">Kinder, Backup &amp; Abgleich <span class="pfeil">›</span></button>')
    # 6) Pi-Sicherungskopien → Backup der Web-App
    s = ersetzen(s, '<button type="button" id="sicherung-oeffnen">Daten &amp; Sicherungen herunterladen <span class="pfeil">›</span></button>',
                 '<button type="button" id="pwa-daten">Kinder, Backup &amp; Abgleich <span class="pfeil">›</span></button>')
    s = ersetzen(s, '$("sicherung-oeffnen").onclick = sicherungenOeffnen;', "/* Web-App: Sicherungen → Backup (js/pwa/kinder-backup.js) */")
    # 7) Erinnerungen über die Home-Assistant-App gibt es nicht
    s = ersetzen(s, '<p class="unter">Für tägliche Gaben (z. B. Vitamin D): Mitteilung über die Home-Assistant-App an diese iPhones.</p>\n    <div id="ei-geraete"></div>',
                 '<p class="unter">Für regelmäßige Gaben zeigt das Babybuch ab der Uhrzeit oben einen Hinweis. '
                 'Beim Anlegen einer Gabe bietet es an, sie täglich in den Kalender des Handys einzutragen – dann erinnert das Handy.</p>\n    <div id="ei-geraete" hidden></div>')
    s = ersetzen(s, '<div class="g-block-dlg"><p class="label">Erinnerung</p>', '<div class="g-block-dlg" hidden><p class="label">Erinnerung</p>')
    s = ersetzen(s, '<div class="g-block-dlg"><p class="label">Im Widget / Kurzbefehl abhaken</p>',
                 '<div class="g-block-dlg" hidden><p class="label">Im Widget / Kurzbefehl abhaken</p>')
    # 8) Kalender (.ics) erzeugt die Web-App selbst; nach neuer regelmäßiger Gabe Angebot „In Kalender“
    s = ersetzen(s, "location.href = `kalender.ics?${q}`;", "window.PWA_KALENDER(q);")
    s = ersetzen(s, 'else await api("taegliche-gaben", "POST", daten);',
                 'else { const neueGabe = await api("taegliche-gaben", "POST", daten); setTimeout(() => window.PWA_GABE_KALENDER?.(neueGabe), 400); }')
    # 9) Texte: Handys statt „beide iPhones“, kein Pi
    s = ersetzen(s, "sie gelten für beide iPhones.", "sie gelten für dieses Kind (mit dem Backup auch beim Partner).")
    s = ersetzen(s, "– gilt auf beiden iPhones.`", "– gilt für dieses Kind.`")
    s = ersetzen(s, "alle Versionen, beide iPhones", "alle Versionen, dieses Handy")
    s = ersetzen(s, "Vorher legt der Pi automatisch eine Sicherungskopie an.", "Danach lässt es sich nicht automatisch rückgängig machen – vorher ein Backup teilen.")
    # 10) Keine privaten Namen aus der Pi-Version: einzelner Vorname als Ersatzname (Vorschau der Erinnerung) → neutral
    s, n = re.subn(r'einstellungen\.name \|\| "[A-ZÄÖÜ][a-zäöüß]+"', 'einstellungen.name || "euer Kind"', s)
    if n != 1:
        sys.exit(f"Stelle nicht eindeutig ({n}×): Ersatzname für einstellungen.name")
    return s


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    index, pi_version = pi_lesen(sys.argv[1])
    web_version = re.search(r'APP_VERSION = "([^"]+)"', WEB_VERSION_DATEI.read_text(encoding="utf-8")).group(1)
    ZIEL.write_text(uebernehmen(index, pi_version, web_version), encoding="utf-8")
    print(f"index.html erzeugt aus Pi {pi_version} (Web {web_version}).")
