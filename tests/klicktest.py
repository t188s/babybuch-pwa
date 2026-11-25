# Klicktest der Web-App mit der Pi-Oberfläche 3.0.2: erster Start, alle Reiter, Einträge per Oberfläche, Bildschirmgrößen
import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]
os.makedirs(AUS, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8767), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8767/"

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 402, "height": 778}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")
        p = await ctx.new_page()
        fehler = []
        p.on("pageerror", lambda e: fehler.append("pageerror: " + str(e)))
        p.on("console", lambda m: fehler.append("console: " + m.text) if m.type == "error" else None)
        await p.goto(URL); await p.wait_for_timeout(1200)
        await p.screenshot(path=f"{AUS}/01_willkommen.png")
        await p.fill("#pk-name", "Mila"); await p.fill("#pk-geburt", "2026-11-16")
        await p.locator("dialog[open] .umschalter button[data-g=w]").click()
        await p.fill("#pk-gg", "3350")
        await p.locator("dialog[open]").get_by_role("button", name="Anlegen").click()
        await p.wait_for_timeout(1500)
        await p.screenshot(path=f"{AUS}/02_stillen.png")
        # Stillen speichern (Nachtragen mit Standarddauer)
        await p.click("#speichern"); await p.wait_for_timeout(500)
        if await p.locator("#zuletzt-dialog[open]").count(): await p.locator("#zuletzt-dialog [data-z=L]").click()
        await p.wait_for_timeout(700)
        await p.screenshot(path=f"{AUS}/03_gespeichert.png")
        # Windeln
        await p.evaluate("bereichZeigen('windeln')"); await p.wait_for_timeout(500)
        await p.locator("#wt-wahl [data-art=voll]").click(); await p.wait_for_timeout(700)
        await p.screenshot(path=f"{AUS}/04_windeln.png")
        # Wachstum: Gewicht
        await p.click("#tab-gewicht"); await p.wait_for_timeout(500)
        await p.click("#gewicht-neu"); await p.fill("#gewicht-gramm", "3,6"); await p.click("#gewicht-speichern"); await p.wait_for_timeout(700)
        await p.screenshot(path=f"{AUS}/05_wachstum.png")
        # Gesundheit, Vorsorge, Auswertung
        for tab in ["gesundheit", "vorsorge", "auswertung"]:
            await p.click(f"#tab-{tab}"); await p.wait_for_timeout(900)
            await p.screenshot(path=f"{AUS}/06_{tab}.png")
        # Einstellungen → Kinder, Backup & Abgleich
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(400)
        await p.click("#pwa-daten"); await p.wait_for_timeout(600)
        await p.screenshot(path=f"{AUS}/07_backup.png")
        await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.wait_for_timeout(300)
        # Zweites Kind → Kind-Knopf oben
        await p.evaluate("(async () => { const k = await import('./js/kern/kinder.js'); const a = await k.aktivesKind(); await k.kindSpeichern({ name: 'Ben' }); await k.aktivSetzen(a.uid); })()")
        await p.reload(); await p.wait_for_timeout(1500)
        print("Kind-Knopf:", await p.locator("#pwa-kind").is_visible(), await p.inner_text("#pwa-kind"))
        daten = await p.evaluate("""async () => { const s = await import('./js/kern/speicher.js'); const a = await s.alle();
            const z = {}; for (const d of a.filter(d => !d.geloescht)) z[d.typ] = (z[d.typ] || 0) + 1; return z; }""")
        print("Gespeichert:", daten)
        # Bildschirmgrößen (wie Pi-Prüfung 3.0.2): kein seitlicher Überlauf
        for w, h in [(360, 550), (375, 667), (402, 778), (430, 839), (1024, 768)]:
            await p.set_viewport_size({"width": w, "height": h})
            await p.click("#tab-eintragen"); await p.wait_for_timeout(400)
            ueber = await p.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            scroll = await p.evaluate("(() => { const m = document.getElementById('scroll'); return m.scrollHeight - m.clientHeight; })()")
            print(f"{w}×{h}: seitlicher Überlauf {ueber} · Stillen muss scrollen {scroll}")
            await p.screenshot(path=f"{AUS}/08_{w}x{h}.png")
        print("Fehler:", fehler or "keine")
        await b.close()
asyncio.run(main())
