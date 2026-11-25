import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8782), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="de-DE", timezone_id="Europe/Berlin", accept_downloads=True)
        p = await ctx.new_page(); fehler = []
        p.on("pageerror", lambda e: fehler.append(str(e))); p.on("console", lambda m: fehler.append(m.text) if m.type == "error" else None)
        await p.goto("http://127.0.0.1:8782/"); await p.wait_for_timeout(1000)
        await p.locator("dialog[open]").last.get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=60000)
        await p.reload(); await p.wait_for_timeout(1500)
        await p.click("#tab-auswertung"); await p.wait_for_timeout(800)
        await p.click("#kopf-bericht"); await p.wait_for_timeout(500)
        await p.screenshot(path=f"{AUS}/1_dialog.png")
        href = await p.get_attribute("#bericht-link", "href"); print("Link:", href[:90])
        async with p.expect_navigation():
            await p.click("#bericht-link")
        await p.wait_for_selector("h1", timeout=20000); await p.wait_for_timeout(800)
        print("Seite:", p.url.split("/")[-1][:60], "·", await p.inner_text("h1"), "·", await p.title())
        print("Abschnitte:", await p.evaluate("[...document.querySelectorAll('h2')].map(h => h.innerText)"))
        print("Grafiken:", await p.evaluate("document.querySelectorAll('svg.grafik').length"))
        await p.screenshot(path=f"{AUS}/2_bericht_oben.png")
        await p.evaluate("document.querySelector('h2:nth-of-type(1)')?.scrollIntoView()")
        sec = p.locator("section", has_text="Fläschchen, Abpumpen")
        if await sec.count(): await sec.first.scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/3_flaeschchen.png")
        async with p.expect_download() as d:
            await p.click("#pwa-teilen")
        print("Teilen →", (await d.value).suggested_filename)
        await p.pdf(path=f"{AUS}/bericht.pdf") if False else None
        async with p.expect_navigation():
            await p.click("text=Zurück")
        await p.wait_for_timeout(1500)
        await p.evaluate("import('./js/pwa/kinder-backup.js').then(m => m.oeffnen())"); await p.wait_for_timeout(800)
        print("Ablage:", await p.evaluate("[...document.querySelectorAll('dialog[open] .abschnitt')].filter(a => a.querySelector('h3')?.innerText === 'Erstellte Berichte').map(a => a.innerText.replace(/\\n/g, ' | '))"))
        async with p.expect_navigation():
            await p.locator("dialog[open]").get_by_role("button", name="Öffnen").first.click()
        await p.wait_for_selector("h1"); await p.wait_for_timeout(500)
        print("Abgelegt geöffnet:", await p.inner_text("h1"), "· Fußzeile:", (await p.inner_text("main > p:last-of-type"))[:80])
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
