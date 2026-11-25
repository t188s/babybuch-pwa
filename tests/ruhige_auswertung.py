import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8777), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        p = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")).new_page()
        fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto("http://127.0.0.1:8777/"); await p.wait_for_timeout(1000)
        print("Standard:", await p.evaluate("document.documentElement.dataset.vergleich"))
        await p.locator("dialog[open]").last.get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        await p.reload(); await p.wait_for_timeout(1500)
        async def davor():
            await p.click("#tab-auswertung"); await p.wait_for_timeout(1200)
            return await p.evaluate("[...document.querySelectorAll('#kacheln .davor')].map(d => d.innerText + ' [' + getComputedStyle(d.querySelector('.dz') || d).color + ']')")
        print("ruhig:", await davor())
        await p.locator("#kacheln").scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/ruhig.png")
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(400)
        await p.click("#pwa-vergleich button[data-vergleich='farbig']"); await p.wait_for_timeout(300)
        await p.locator("#pwa-vergleich").scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/einstellung.png")
        await p.keyboard.press("Escape"); await p.wait_for_timeout(300)
        print("farbig:", await davor())
        await p.screenshot(path=f"{AUS}/farbig.png")
        await p.reload(); await p.wait_for_timeout(1000)
        print("nach Neuladen:", await p.evaluate("document.documentElement.dataset.vergleich"))
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
