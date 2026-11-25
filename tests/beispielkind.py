# Aufruf: python3 tests/beispielkind.py <Ordner der Web-App> <Ordner für Bildschirmfotos> – Demo-Knopf, Anzeige, Kind entfernen/zurückholen
import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8771), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 402, "height": 778}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")
        p = await ctx.new_page(); fehler = []
        p.on("pageerror", lambda e: fehler.append("pageerror: " + str(e)))
        p.on("console", lambda m: fehler.append("console: " + m.text) if m.type == "error" else None)
        await p.goto("http://127.0.0.1:8771/"); await p.wait_for_timeout(1000)
        await p.screenshot(path=f"{AUS}/00_willkommen.png", full_page=True)
        import time; t0 = time.time()
        await p.locator("dialog[open]").get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        print(f"Beispielkind angelegt in {time.time()-t0:.1f} s", flush=True)
        await p.wait_for_timeout(1500)
        zahl = await p.evaluate("""async () => { const s = await import('./js/kern/speicher.js'); const z = {};
            for (const d of await s.alle()) if (!d.geloescht) z[d.typ] = (z[d.typ] || 0) + 1; return z; }""")
        print("Datensätze:", zahl, flush=True)
        await p.screenshot(path=f"{AUS}/01_stillen.png")
        for tab in ["gewicht", "gesundheit", "vorsorge", "auswertung"]:
            await p.click(f"#tab-{tab}"); await p.wait_for_timeout(1200)
            await p.screenshot(path=f"{AUS}/02_{tab}.png", full_page=True)
        # Einstellungen → Kinder → Ändern → entfernen
        await p.evaluate("einstellungenOeffnen()"); await p.click("#pwa-daten"); await p.wait_for_timeout(600)
        await p.locator("dialog[open]").last.get_by_role("button", name="Ändern").click(); await p.wait_for_timeout(300)
        await p.locator("dialog[open]").last.get_by_role("button", name="Kind entfernen").click(); await p.wait_for_timeout(300)
        await p.locator("dialog[open]").last.get_by_role("button", name="Entfernen", exact=True).click()
        await p.wait_for_timeout(2500)
        print("Nach Entfernen Willkommen sichtbar:", await p.locator("#pk-name").is_visible(), flush=True)
        lebend = await p.evaluate("async () => (await (await import('./js/kern/speicher.js')).alle()).filter(d => !d.geloescht).length")
        print("Lebende Datensätze:", lebend, flush=True)
        # Zurückholen über Kern
        n = await p.evaluate("""async () => { const k = await import('./js/kern/kinder.js'); const [e] = await k.entfernteKinder(); return k.kindZurueckholen(e.uid); }""")
        print("Zurückgeholt:", n, flush=True)
        print("Fehler:", fehler or "keine")
        await b.close()
asyncio.run(main())
