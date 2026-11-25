# Vergleich: Pi-Server 3.0.2 (Flask, leere DB) und lokaler Pi der Web-App bekommen dieselben Anfragen –
# Aufruf: python3 tests/vergleich_mit_pi.py <Ordner der Web-App> <Ordner mit app.py + templates der Pi-Version, ohne startdaten_uheft.json>
# Braucht Flask, Playwright und Chrome. Der Pi-Ordner bekommt eine frische stillen.sqlite (vorher löschen).
# die Antworten müssen gleich sein (ids werden auf beiden Seiten in Platzhalter übersetzt).
import pathlib, asyncio, json, subprocess, sys, time, urllib.request, urllib.error, http.server, threading, functools, datetime
from playwright.async_api import async_playwright

WEB = sys.argv[1]
gestern = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
vorgestern = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
heute = datetime.date.today().isoformat()
G = gestern

# (Methode, Pfad, Daten, Name für die id der Antwort)
AUFRUFE = [
    ("PUT", "einstellungen", {"name": "Mila", "geburtsdatum": "2026-10-05", "geschlecht": "w", "geburtsgewicht": "3,35", "nacht_von": 21}, None),
    ("GET", "einstellungen", None, None),
    ("POST", "stillen", {"start": f"{G}T08:00", "dauer": 20, "seite": "L", "notiz": "  gut angelegt  "}, "s1"),
    ("POST", "stillen", {"start": f"{G}T08:22", "dauer": 10, "seite": "R"}, "s2"),
    ("POST", "stillen", {"start": f"{G}T11:00", "dauer": 25, "seite": "B", "zuletzt": "L"}, "s3"),
    ("POST", "stillen", {"start": f"{G}T11:00", "dauer": 0, "seite": "B"}, None),
    ("POST", "stillen", {"start": "kaputt", "dauer": 5, "seite": "L"}, None),
    ("PATCH", "stillen/{s2}", {"seite": "B", "zuletzt": "R", "notiz": "x"}, None),
    ("PATCH", "stillen/{s1}", {}, None),
    ("GET", f"stillen?von={G}&bis={G}", None, None),
    ("GET", "stillen/letzte", None, None),
    ("DELETE", "stillen/{s3}", None, None),
    ("DELETE", "stillen/{s3}", None, None),
    ("GET", f"stillen?von={G}&bis={heute}", None, None),
    ("GET", "stillen?von=x&bis=y", None, None),
    ("POST", "windeln", {"zeit": f"{G}T09:00", "art": "voll", "stuhlfarbe": "gelb"}, "w1"),
    ("POST", "windeln", {"zeit": f"{G}T10:00", "art": "nass", "stuhlfarbe": "gelb"}, "w2"),
    ("PATCH", "windeln/{w1}", {"art": "nass"}, None),
    ("PATCH", "windeln/{w2}", {"art": "beides", "stuhlfarbe": "hell"}, None),
    ("GET", f"windeln?von={G}&bis={G}", None, None),
    ("POST", "gewicht", {"datum": gestern, "gramm": "3,79"}, "g1"),
    ("POST", "gewicht", {"datum": vorgestern, "gramm": "3650 g"}, "g2"),
    ("POST", "gewicht", {"datum": gestern, "gramm": "12"}, None),
    ("POST", "gewicht", {"datum": gestern, "gramm": "abc"}, None),
    ("PATCH", "gewicht/{g1}", {"gramm": 3800}, None),
    ("GET", "gewicht", None, None),
    ("POST", "groesse", {"datum": gestern, "cm": "52,5"}, "c1"),
    ("POST", "groesse", {"datum": gestern, "cm": "0,51 m"}, "c2"),
    ("GET", "groesse", None, None),
    ("DELETE", "groesse/{c2}", None, None),
    ("PUT", "stoppuhr", {"stoppuhr": {"abschnitte": [{"seite": "L", "start": f"{G}T07:00:05", "ende": None}]}}, None),
    ("GET", "stoppuhr", None, None),
    ("PUT", "stoppuhr", {"stoppuhr": {"abschnitte": []}}, None),
    ("DELETE", "stoppuhr", None, None),
    ("GET", "stoppuhr", None, None),
    ("POST", "fieber", {"zeit": f"{G}T12:00", "temp": "38,24", "art": "Po", "notiz": " warm "}, "f1"),
    ("POST", "fieber", {"zeit": f"{G}T12:00", "temp": "44"}, None),
    ("POST", "fieber", {"zeit": "2099-01-01T10:00", "temp": "38"}, None),
    ("POST", "symptome", {"zeit": f"{G}T12:05", "art": "erbricht", "menge": "schwall"}, "y1"),
    ("POST", "symptome", {"zeit": f"{G}T12:06", "art": "husten", "menge": "schwall"}, "y2"),
    ("POST", "symptome", {"zeit": f"{G}T12:07", "art": "notiz"}, None),
    ("POST", "medikamente", {"zeit": f"{G}T12:10", "name": "Nasentropfen", "menge": "1 Hub"}, "m1"),
    ("POST", "taegliche-gaben", {"name": "Vitamin D", "zeiten": ["08:00"], "ab": vorgestern}, "t1"),
    ("POST", "taegliche-gaben", {"name": "Eisen", "zeiten": ["20:00", "08:00"], "ab": vorgestern, "bis": gestern, "erinnern": False}, "t2"),
    ("POST", "taegliche-gaben", {"name": "X", "zeiten": ["25:00"]}, None),
    ("GET", "taegliche-gaben", None, None),
    ("PATCH", "taegliche-gaben/{t2}", {"pausiert": True, "bis": vorgestern}, None),
    ("POST", "gaben", {"gabe_id": "{t1}", "slot": 0, "zeit": f"{G}T08:05"}, "a1"),
    ("POST", "gaben", {"gabe_id": "{t1}", "slot": 0, "zeit": f"{G}T09:05"}, None),
    ("POST", "gaben", {"gabe_id": 12345, "slot": 0, "zeit": f"{G}T09:05"}, None),
    ("PATCH", "fieber/{f1}", {"temp": 37.9}, None),
    ("GET", f"gesundheit?von={G}&bis={G}", None, None),
    ("DELETE", "taegliche-gaben/{t2}", None, None),
    ("GET", f"gesundheit?von={G}&bis={G}", None, None),
    ("POST", "taegliche-gaben/{t2}/wiederherstellen", {"name": "Eisen", "zeiten": ["08:00"], "ab": vorgestern}, None),
    ("POST", "taegliche-gaben/{t2}/wiederherstellen", {"name": "Eisen", "zeiten": ["08:00"], "ab": vorgestern}, None),
    ("GET", "taegliche-gaben", None, None),
    ("GET", "heft", None, "HEFT"),
    ("PATCH", "heft/untersuchungen/{U3}", {"termin": f"{heute}T09:30", "praxis": "Dr. A", "g": "4,1", "cm": "54", "kopf": "37,25"}, None),
    ("PATCH", "heft/untersuchungen/{U2}", {"am": gestern, "erledigt": True, "ergebnis": "ok"}, None),
    ("PATCH", "heft/untersuchungen/{U2}", {"ergebnis": "falsch"}, None),
    ("PATCH", "heft/screenings/{SCR0}", {"am": gestern, "erledigt": 1}, None),
    ("POST", "heft/impfungen", {"am": gestern, "gegen": ["Rotaviren", " ", "Tetanus"], "stoff": "X"}, "i1"),
    ("POST", "heft/impfungen", {"gegen": []}, None),
    ("POST", "heft/impfplan", {"gegen": ["Rotaviren"], "dosis": "1", "alter_text": "6 Wochen", "ab": heute, "impfung_id": "{i1}"}, "p1"),
    ("POST", "heft/arztbesuche", {"grund": "Infekt"}, None),
    ("POST", "heft/arztbesuche", {"grund": "Infekt", "termin": f"{heute}T10:00", "kopf": "70"}, None),
    ("POST", "heft/arztbesuche", {"grund": "Infekt", "am": gestern, "g": "4000"}, "b1"),
    ("POST", "heft/massnahmen", {"text": "Hüfte kontrollieren", "von": "U3", "faellig": heute}, "n1"),
    ("POST", "heft/kopfumfang", {"datum": gestern, "cm": "36,5"}, "k1"),
    ("POST", "heft/kopfumfang", {"datum": "2099-01-01", "cm": "36,5"}, None),
    ("POST", "heft/untersuchungen", {"art": "U1"}, None),
    ("DELETE", "heft/impfungen/{i1}", None, None),
    ("DELETE", "heft/untersuchungen/{U3}", None, None),
    ("GET", "heft", None, None),
    ("GET", "kopfumfang", None, None),
    ("PUT", "einstellungen", {"bausteine": ["a,b", "a b", " c ", "a b"], "notfall_praxis": "0841 / 12-34 abc", "nachtmodus": False}, None),
    ("PUT", "einstellungen", {"bericht_vorlagen": {"hebamme": ["tage", "windeln"]}}, None),
    ("PUT", "einstellungen", {"bericht_vorlagen": {"hebamme": ["unbekannt"]}}, None),
    ("PUT", "einstellungen", {"nacht_bis": 24}, None),
    ("PUT", "einstellungen", {"geschlecht": "x"}, None),
    ("GET", "einstellungen", None, None),
    ("POST", "nutzung", {"ereignisse": [{"v": "t", "g": "abc", "tag": heute, "typ": "tipp", "ziel": "#x"}]}, None),
    ("GET", "nutzung/versionen", None, None),
    ("DELETE", "nutzung?version=t", None, None),
    ("GET", "nutzung", None, None),
]
# Bekannte, gewollte Unterschiede (Web-App ≠ Pi)
UNTERSCHIEDE_ERLAUBT = {
    "PUT einstellungen#0": "Kind-Name kommt aus dem Kind-Datensatz",
}

def pi_aufruf(methode, pfad, daten):
    req = urllib.request.Request("http://127.0.0.1:8770/api/" + pfad, method=methode,
                                 data=json.dumps(daten).encode() if daten is not None else None,
                                 headers={"Content-Type": "application/json"} if daten is not None else {})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")

def ids_einsetzen(x, ids):
    if isinstance(x, str):
        if x.startswith("{") and x.endswith("}") and x[1:-1] in ids: return ids[x[1:-1]]
        for k, v in ids.items(): x = x.replace("{" + k + "}", str(v))
        return x
    if isinstance(x, list): return [ids_einsetzen(y, ids) for y in x]
    if isinstance(x, dict): return {k: ids_einsetzen(v, ids) for k, v in x.items()}
    return x

def ids_merken(name, antwort, ids):
    if name == "HEFT":
        for u in antwort["untersuchungen"]: ids[u["art"]] = u["id"]
        for i, s in enumerate(antwort["screenings"]): ids[f"SCR{i}"] = s["id"]
    elif name and isinstance(antwort, dict) and "id" in antwort:
        ids[name] = antwort["id"]

def normal(x, idnamen=None):
    """ids (auf dem Pi je Tabelle 1, 2, 3 …, in der Web-App große Zufallszahlen) nicht vergleichen – nur, ob sie da sind."""
    if isinstance(x, dict):
        if all(k.isdigit() for k in x) and x: return {"ID": sorted(x.values())}        # entfernte_gaben: id → Name
        return {k: ("ID" if k in ("id", "gabe_id", "impfung_id") and isinstance(v, int) else normal(v)) for k, v in x.items()}
    if isinstance(x, list): return [normal(y) for y in x]
    return x

async def main():
    pi = subprocess.Popen([sys.executable, str(pathlib.Path(__file__).with_name("pi_starten.py")), sys.argv[2]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8766), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(1.5)
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
            ctx = await b.new_context(viewport={"width": 402, "height": 778})
            seite = await ctx.new_page()
            fehler = []
            seite.on("pageerror", lambda e: fehler.append(str(e)))
            # leere Startseite → Kind über die Kern-Funktion anlegen (ohne Fenster), dann die Schnittstellen vergleichen
            await seite.goto("http://127.0.0.1:8766/index.html"); await seite.wait_for_timeout(800)
            await seite.evaluate("""async () => { const k = await import('./js/kern/kinder.js'); await k.kindSpeichern({ name: 'Test' });
                for (const d of document.querySelectorAll('dialog[open]')) d.close(); }""")
            await seite.wait_for_timeout(300)
            ids_pi, ids_web, namen_pi, namen_web = {}, {}, {}, {}
            abweichungen, n = [], 0
            for i, (m, pfad, daten, name) in enumerate(AUFRUFE):
                p_pi, d_pi = ids_einsetzen(pfad, ids_pi), ids_einsetzen(daten, ids_pi)
                p_web, d_web = ids_einsetzen(pfad, ids_web), ids_einsetzen(daten, ids_web)
                s1, a1 = pi_aufruf(m, p_pi, d_pi)
                s2, a2 = await seite.evaluate("""async ([m, p, d]) => { const r = await fetch('api/' + p, { method: m, headers: d ? {'Content-Type': 'application/json'} : {}, body: d ? JSON.stringify(d) : undefined });
                    return [r.status, await r.json()]; }""", [m, p_web, d_web])
                ids_merken(name, a1, ids_pi); ids_merken(name, a2, ids_web)
                for k, v in ids_pi.items(): namen_pi[v] = k
                for k, v in ids_web.items(): namen_web[v] = k
                # ids aus Antworten ohne Namen (z. B. Listen) auf beiden Seiten in Reihenfolge benennen
                def benennen(x, namen, prefix):
                    if isinstance(x, dict):
                        for k, v in x.items():
                            if k == "id" and isinstance(v, int) and v not in namen: namen[v] = f"{prefix}{len(namen)}"
                            benennen(v, namen, prefix)
                    elif isinstance(x, list):
                        for y in x: benennen(y, namen, prefix)
                benennen(a1, namen_pi, "n"); benennen(a2, namen_web, "n")
                n1, n2 = normal(a1, namen_pi), normal(a2, namen_web)
                if s1 == 201 and isinstance(a1, dict) and "url" in a1: n1["url"] = n2["url"] = "…"
                if (s1, n1) != (s2, n2):
                    abweichungen.append((i, m, pfad, s1, s2, json.dumps(n1, ensure_ascii=False, sort_keys=True)[:600], json.dumps(n2, ensure_ascii=False, sort_keys=True)[:600]))
                n += 1
            # ── CSV-Export (Etappe 2): gleiche Daten → gleiche Datei (Text byte-genau, Dateiname gleich) ──
            csv_n, csv_abw = 0, []
            for art in ["stillen", "windeln", "gewicht", "groesse", "fieber", "symptome", "medikamente", "gaben", "impfungen", "uheft",
                        "vorlage/stillen", "vorlage/windeln", "vorlage/gewicht", "vorlage/groesse"]:
                for q in ["", f"?von={vorgestern}&bis={heute}", f"?von={G}&bis={G}", f"?von={G}T08:10&bis={heute}T23:59", "?von=x&bis=y"]:
                    if art.startswith("vorlage") and q: continue
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:8770/export/{art}.csv{q}") as r:
                            s1, t1 = r.status, r.read().decode("utf-8")
                            n1 = (r.headers.get("Content-Disposition") or "").split('filename="')[-1].rstrip('"')
                    except urllib.error.HTTPError as e:
                        s1, t1, n1 = e.code, json.loads(e.read()).get("fehler"), ""
                    s2, j2 = await seite.evaluate("""async p => { const r = await fetch('api/export/' + p); return [r.status, await r.json()]; }""", f"{art}.csv{q}")
                    t2, n2 = (j2.get("text"), j2.get("name")) if s2 == 200 else (j2.get("fehler"), "")
                    csv_n += 1
                    if (s1, t1, n1) != (s2, t2, n2):
                        csv_abw.append((art + q, s1, s2, n1, n2, repr(t1)[:900], repr(t2)[:900]))
            print(f"CSV: {csv_n} Dateien verglichen, {len(csv_abw)} Abweichungen")
            for a in csv_abw:
                print(f"\nCSV {a[0]}: Pi {a[1]} {a[3]} / Web {a[2]} {a[4]}\n  Pi : {a[5]}\n  Web: {a[6]}")
            print(f"{n} Anfragen verglichen, {len(abweichungen)} Abweichungen, Seitenfehler: {fehler}")
            for a in abweichungen:
                print(f"\n#{a[0]} {a[1]} {a[2]}: Pi {a[3]} / Web {a[4]}\n  Pi : {a[5]}\n  Web: {a[6]}")
            await b.close()
    finally:
        pi.terminate(); srv.shutdown()

asyncio.run(main())
