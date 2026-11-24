# Aufruf: python3 tests/kalender_mit_pi.py <Ordner der Web-App> <Pi-Ordner>  – Kalenderdateien gleich wie /kalender.ics des Pi
import pathlib, asyncio, sys, http.server, threading, functools, subprocess, time, urllib.request, urllib.parse
from playwright.async_api import async_playwright
WEB = sys.argv[1]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8769), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    pi = subprocess.Popen([sys.executable, str(pathlib.Path(__file__).with_name("pi_starten.py")), sys.argv[2]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
            ctx = await b.new_context(accept_downloads=True, locale="de-DE"); p = await ctx.new_page()
            fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
            await p.goto("http://127.0.0.1:8769/"); await p.wait_for_timeout(800); print("geladen", flush=True)
            await p.fill("#pk-name", "Mila"); await p.locator("dialog[open]").get_by_role("button", name="Anlegen").click(); await p.wait_for_timeout(1200)
            for q in ["titel=U3 · Kinderärztin&start=2026-12-10T09:30&ort=Dr. A, Musterstadt", "titel=U4&tag=2027-01-16&bis=2027-03-17"]:
                async with p.expect_download(timeout=8000) as dl:
                    await p.evaluate("q => window.PWA_KALENDER(q)", q)
                web = open(await (await dl.value).path(), newline="").read()
                pi_text = urllib.request.urlopen("http://127.0.0.1:8770/kalender.ics?" + urllib.parse.quote(q, safe="=&")).read().decode()
                ohne = lambda t: [z for z in t.split("\r\n") if not z.startswith(("UID:", "DTSTAMP:"))]
                print("Termin gleich wie Pi:", ohne(web) == ohne(pi_text), flush=True)
                if ohne(web) != ohne(pi_text): print(ohne(web), ohne(pi_text), flush=True)
            await p.evaluate("""() => { window.PWA_GABE_KALENDER({ name: 'Vitamin D', menge: '1 Tablette', zeiten: ['08:00', '18:30'], ab: '2026-11-24', bis: '', pausiert: false }); }""")
            await p.wait_for_timeout(600)
            async with p.expect_download(timeout=8000) as dl:
                await p.locator("dialog[open]").last.get_by_role("button", name="In Kalender").click()
            gabe = open(await (await dl.value).path(), newline="").read()
            print("Gabe:", [z for z in gabe.split("\r\n") if z.startswith(("SUMMARY", "DTSTART", "RRULE", "TRIGGER"))])
            print("Fehler:", fehler or "keine")
            await b.close()
    finally:
        pi.terminate()
asyncio.run(main())
