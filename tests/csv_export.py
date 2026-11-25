import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8780), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True, locale="de-DE")
        p = await ctx.new_page(); fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto("http://127.0.0.1:8780/"); await p.wait_for_timeout(1000)
        await p.locator("dialog[open]").last.get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=60000)
        await p.reload(); await p.wait_for_timeout(1500)
        await p.evaluate("import('./js/pwa/kinder-backup.js').then(m => m.oeffnen())"); await p.wait_for_timeout(800)
        links = p.locator("dialog[open] .export-links a")
        print("Links:", await links.count())
        await p.locator("dialog[open] .export-links").first.scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/csv_abschnitt.png")
        print("gaben direkt:", (await p.evaluate("fetch('api/export/gaben.csv').then(r => r.text())"))[:300])
        for i in range(await links.count()):
            if i == 9:      # Chrome lässt ohne Rückfrage nur ~10 Downloads je Seite zu → neue Seite
                p = await ctx.new_page(); p.on("pageerror", lambda e: fehler.append(str(e)))
                await p.goto("http://127.0.0.1:8780/"); await p.wait_for_timeout(1200)
                await p.evaluate("import('./js/pwa/kinder-backup.js').then(m => m.oeffnen())"); await p.wait_for_timeout(800)
                links = p.locator("dialog[open] .export-links a")
            async with p.expect_download() as d:
                await links.nth(i).evaluate("a => a.click()")
            dl = await d.value; pfad = f"{AUS}/{dl.suggested_filename}"; await dl.save_as(pfad)
            text = open(pfad, encoding="utf-8-sig", newline="").read().split("\r\n")
            print(f"  {dl.suggested_filename}: {len(text) - 2} Zeilen · {text[1][:70] if len(text) > 2 else '(leer)'}")
        # Pi-Link im Import-Fenster
        await p.keyboard.press("Escape"); await p.wait_for_timeout(300)
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(300)
        await p.click("#import-oeffnen"); await p.wait_for_timeout(300)
        async with p.expect_download() as d:
            await p.click("#csv-link")
        print("Import-Fenster-Link:", (await d.value).suggested_filename)
        async with p.expect_download() as d:
            await p.click("#im-vorlage")
        print("Vorlage:", (await d.value).suggested_filename)
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
