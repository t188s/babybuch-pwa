# Zwei Handys mit Pi-Oberfläche: A trägt ein und teilt, B startet mit „Backup vom Partner laden“, beide ändern, Austausch zurück
# Aufruf: python3 tests/zwei_handys.py <Ordner der Web-App>   (braucht Playwright und Chrome)
import asyncio, sys, http.server, threading, functools, json, datetime
from playwright.async_api import async_playwright
WEB = sys.argv[1]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8768), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8768/"
G = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

async def api(p, m, pfad, d=None):
    return await p.evaluate("""async ([m, p, d]) => { const r = await fetch('api/' + p, { method: m, headers: d ? {'Content-Type':'application/json'} : {}, body: d ? JSON.stringify(d) : undefined }); return r.json(); }""", [m, pfad, d])

async def teilen(p, datei):
    await p.evaluate("einstellungenOeffnen()"); await p.click("#pwa-daten"); await p.wait_for_timeout(400)
    await p.evaluate("() => { navigator.canShare = () => false; }")
    await p.locator("dialog[open]").last.get_by_role("button", name="Backup teilen").click(); await p.wait_for_timeout(200)
    async with p.expect_download() as dl:
        await p.locator("dialog[open]").last.get_by_role("button", name="Teilen", exact=True).click()
    await (await dl.value).save_as(datei)
    for _ in range(3): await p.keyboard.press("Escape")

async def laden(p, datei, knopf="Backup laden"):
    async with p.expect_file_chooser() as fc:
        await p.locator("dialog[open]").last.get_by_role("button", name=knopf).click()
    await (await fc.value).set_files(datei); await p.wait_for_timeout(500)
    zahlen = await p.locator("dialog[open]").last.locator(".zahlen").inner_text()
    await p.locator("dialog[open]").last.get_by_role("button", name="Übernehmen").click()
    await p.wait_for_timeout(1800)
    return zahlen

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        fehler = []
        async def handy(name):
            ctx = await b.new_context(viewport={"width": 402, "height": 778}, accept_downloads=True, locale="de-DE")
            p = await ctx.new_page()
            p.on("pageerror", lambda e: fehler.append(f"{name}: {e}"))
            await p.goto(URL); await p.wait_for_timeout(1000)
            return p
        A = await handy("A")
        await A.fill("#pk-name", "Mila"); await A.fill("#pk-geburt", "2026-10-05")
        await A.locator("dialog[open]").get_by_role("button", name="Anlegen").click(); await A.wait_for_timeout(1200)
        s1 = await api(A, "POST", "stillen", {"start": f"{G}T08:00", "dauer": 20, "seite": "L"})
        s2 = await api(A, "POST", "stillen", {"start": f"{G}T11:00", "dauer": 15, "seite": "R"})
        await api(A, "POST", "windeln", {"zeit": f"{G}T09:00", "art": "nass"})
        heft = await api(A, "GET", "heft")
        u2 = next(u for u in heft["untersuchungen"] if u["art"] == "U2")
        await api(A, "PATCH", f"heft/untersuchungen/{u2['id']}", {"am": G, "erledigt": True})
        await teilen(A, "/tmp/a1.babybuch")
        B = await handy("B")
        print("B lädt beim ersten Start:", await laden(B, "/tmp/a1.babybuch", "Backup vom Partner laden"))
        print("B Stillen:", len(await api(B, "GET", f"stillen?von={G}&bis={G}")), "· Kopfzeile:", (await B.inner_text("#seit")).strip())
        hb = await api(B, "GET", "heft")
        print("B: U2 erledigt:", next(u for u in hb["untersuchungen"] if u["art"] == "U2")["erledigt"], "· U-Zeilen:", len(hb["untersuchungen"]))
        # beide ändern parallel
        await api(B, "POST", "windeln", {"zeit": f"{G}T13:00", "art": "voll"})
        await api(B, "PATCH", f"stillen/{s1['id']}", {"dauer": 25})
        await A.wait_for_timeout(50)
        await api(A, "DELETE", f"stillen/{s2['id']}")
        await api(A, "PATCH", f"stillen/{s1['id']}", {"notiz": "von A"})   # A ändert später → gewinnt
        await teilen(B, "/tmp/b1.babybuch")
        await A.evaluate("einstellungenOeffnen()"); await A.click("#pwa-daten"); await A.wait_for_timeout(300)
        print("A lädt von B:", await laden(A, "/tmp/b1.babybuch"))
        st = await api(A, "GET", f"stillen?von={G}&bis={G}")
        print("A Stillen:", [(x["start"][11:], x["dauer"], x["notiz"]) for x in st], "· Windeln:", len(await api(A, "GET", f"windeln?von={G}&bis={G}")))
        await teilen(A, "/tmp/a2.babybuch")
        await B.evaluate("einstellungenOeffnen()"); await B.click("#pwa-daten"); await B.wait_for_timeout(300)
        print("B lädt von A:", await laden(B, "/tmp/a2.babybuch"))
        st = await api(B, "GET", f"stillen?von={G}&bis={G}")
        print("B Stillen:", [(x["start"][11:], x["dauer"], x["notiz"]) for x in st], "· Windeln:", len(await api(B, "GET", f"windeln?von={G}&bis={G}")))
        hb = await api(B, "GET", "heft")
        print("B: U-Zeilen nach Austausch:", len(hb["untersuchungen"]), "(16 = keine Doppelten)")
        print("Fehler:", fehler or "keine")
        await b.close()
asyncio.run(main())
