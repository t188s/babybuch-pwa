import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8774), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8774/"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
async def offen_titel(p): return await p.evaluate("[...document.querySelectorAll('dialog[open]')].map(d => d.querySelector('h2,h3')?.innerText || '?')")
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        # ── 1) iPhone-Safari-Tab
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE", user_agent=IPHONE)
        p = await ctx.new_page(); fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto(URL); await p.wait_for_timeout(1200)
        print("iOS Start – offene Fenster:", await offen_titel(p))
        await p.screenshot(path=f"{AUS}/ios_hinweis.png")
        await p.locator("dialog[open]").last.get_by_role("button", name="Nur kurz ansehen").click(); await p.wait_for_timeout(500)
        print("nach 'Nur kurz ansehen':", await offen_titel(p))
        await p.locator("dialog[open]").last.get_by_role("button", name="Beispielkind ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        await p.reload(); await p.wait_for_timeout(1500)
        print("iOS nach Neuladen – Fenster:", await offen_titel(p), "· Banner:", await p.evaluate("(() => { const h = document.getElementById('pwa-hinweis'); return h.hidden ? '-' : h.innerText.replace(/\\n/g,' ') })()"))
        await p.click("#tab-auswertung"); await p.wait_for_timeout(400)
        await p.screenshot(path=f"{AUS}/ios_banner.png", clip={"x":0,"y":0,"width":390,"height":200})
        await ctx.close()
        # ── 2) normales Handy
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")
        p = await ctx.new_page(); p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto(URL); await p.wait_for_timeout(1200)
        print("Android Start – Fenster:", await offen_titel(p))
        await p.locator("dialog[open]").last.get_by_role("button", name="Beispielkind ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        await p.reload(); await p.wait_for_timeout(1500)
        await p.evaluate("window.PWA_DESIGN.setzen('gold')")
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(500)
        print("Einstellungen-Text:", await p.evaluate("document.querySelector('dialog[open] .unter')?.innerText"))
        print("Baby:", (await p.inner_text("#pwa-baby")).replace("\n", " | "), "· Pi-Felder versteckt:", await p.evaluate("document.getElementById('pi-baby-felder').hidden"))
        await p.locator("#pwa-baby").scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/baby.png")
        await p.locator("#pwa-baby").get_by_role("button", name="Ändern").click(); await p.wait_for_timeout(400)
        print("Ändern öffnet:", await offen_titel(p))
        await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.wait_for_timeout(300)
        await p.evaluate("import('./js/pwa/kinder-backup.js').then(m => m.oeffnen())"); await p.wait_for_timeout(600)
        await p.locator("dialog[open]").last.get_by_role("button", name="Alle Daten auf diesem Handy löschen").click(); await p.wait_for_timeout(400)
        await p.screenshot(path=f"{AUS}/loeschen.png")
        await p.locator("dialog[open]").last.get_by_role("button", name="Ohne weiteres Backup löschen").click(); await p.wait_for_timeout(400)
        async with p.expect_navigation():
            await p.locator("dialog[open]").last.get_by_role("button", name="Endgültig löschen").click()
        await p.wait_for_timeout(1500)
        print("nach Löschen – Fenster:", await offen_titel(p), "· Design:", await p.evaluate("document.documentElement.dataset.design"),
              "· Datensätze:", await p.evaluate("import('./js/kern/speicher.js').then(s => s.alle()).then(a => a.length)"))
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
