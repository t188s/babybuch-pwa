# Großer Bericht-Vergleich: Demo-Kind Lea (4 Monate) der Web-App → per CSV in den Pi-Server 3.0.2 → beide Berichte gleich?
# Aufruf: python3 tests/bericht_gross_mit_pi.py <Web-App-Ordner> <Pi-Ordner (frische DB)>
import pathlib, asyncio, json, subprocess, sys, time, urllib.request, http.server, threading, functools, datetime, re
from playwright.async_api import async_playwright
WEB = sys.argv[1]
heute = datetime.date.today()
def pi(m, pfad, daten=None):
    req = urllib.request.Request("http://127.0.0.1:8770/" + pfad, method=m, data=json.dumps(daten).encode() if daten is not None else None,
                                 headers={"Content-Type": "application/json"} if daten is not None else {})
    with urllib.request.urlopen(req) as r: return r.read().decode("utf-8")
def norm(h):
    h = re.sub(r"\s+", " ", h)
    return re.sub(r"\s*(<[^>]+>)\s*", r"\1", h).strip()
async def main():
    p = subprocess.Popen([sys.executable, str(pathlib.Path(__file__).with_name("pi_starten.py")), sys.argv[2]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8767), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(1.5)
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
            s = await (await b.new_context(timezone_id="Europe/Berlin")).new_page()
            await s.goto("http://127.0.0.1:8767/index.html"); await s.wait_for_timeout(800)
            await s.evaluate("""async () => { const b = await import('./js/pwa/beispiel.js'); const k = await import('./js/kern/kinder.js');
                const [lea] = await b.demoAnlegen(); await k.aktivSetzen(lea.uid); for (const d of document.querySelectorAll('dialog[open]')) d.close(); }""")
            e = json.loads(await s.evaluate("fetch('api/einstellungen').then(r => r.text())"))
            pi("PUT", "api/einstellungen", {k: e[k] for k in ("geburtsdatum", "geschlecht", "geburtsgewicht", "nacht_von", "nacht_bis")} | {"name": e["name"]})
            for art in ("stillen", "windeln", "gewicht", "groesse"):
                text = json.loads(await s.evaluate(f"fetch('api/export/{art}.csv').then(r => r.text())"))["text"]
                r = json.loads(pi("POST", f"api/import/{art}", {"text": text, "bestaetigen": True}))
                print(f"Pi übernimmt {art}: {r['eingespielt']} (Fehler {r['fehler_anzahl']}, doppelt {r['vorhanden']})")
            teile = "zusammenfassung,vergleich,tage,mahlzeiten,notizen,windeln,gewicht,groesse,g_groesse,g_rhythmus,g_dauer,g_trend,g_gewicht"
            gb = e["geburtsdatum"]
            abw = 0
            for q in [f"von={gb}&bis={heute}&teile={teile}", f"von={heute - datetime.timedelta(days=6)}&bis={heute}&teile={teile}",
                      f"von={heute - datetime.timedelta(days=30)}&bis={heute}&teile={teile}&fuer=hebamme",
                      f"von={heute - datetime.timedelta(days=1)}T08:00&bis={heute}T08:00&teile={teile}", f"von={gb}&bis={gb}&teile={teile}",
                      f"von={heute - datetime.timedelta(days=90)}&bis={heute}&teile=g_trend,tage"]:
                h1 = pi("GET", f"bericht?{q}")
                h2 = await s.evaluate("""async q => { const k = await import('./js/kern/kinder.js'); const t = await import('./js/lokal/tabellen.js');
                    t.kindSetzen((await k.aktivesKind()).uid);
                    const w = await (await import('./js/lokal/bericht/daten.js')).berichtDaten(new URLSearchParams(q));
                    return (await import('./js/lokal/bericht/vorlage.js')).berichtHtml(w); }""", q)
                n1, n2 = norm(h1), norm(h2)
                n2 = re.sub(r"<section><h2>Fläschchen, Abpumpen &amp; Beikost</h2>.*?</section>", "", n2)   # gewollt: nur Web-App
                gleich = n1 == n2
                print(f"{'gleich ' if gleich else 'ANDERS '} {len(n1):7d} Zeichen · {q[:70]}")
                if not gleich:
                    abw += 1
                    i = next((k for k in range(min(len(n1), len(n2))) if n1[k] != n2[k]), min(len(n1), len(n2)))
                    print("   Pi :", n1[max(0, i - 200):i + 150]); print("   Web:", n2[max(0, i - 200):i + 150])
            print(f"Abweichungen: {abw}")
            await b.close()
    finally:
        p.terminate(); srv.shutdown()
asyncio.run(main())
