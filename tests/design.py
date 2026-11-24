import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8773), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")
        p = await ctx.new_page(); fehler = []
        p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto("http://127.0.0.1:8773/"); await p.wait_for_timeout(1000)
        print("Start-Design:", await p.evaluate("document.documentElement.dataset.design"))
        await p.locator("dialog[open]").get_by_role("button", name="Beispielkind ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        await p.reload(); await p.wait_for_timeout(1500)
        for design in ("blau", "gold"):
            await p.evaluate(f"window.PWA_DESIGN.setzen('{design}')")
            for nacht in (False, True):
                await p.evaluate(f"document.documentElement.classList.toggle('nachtmodus', {str(nacht).lower()})")
                for tab in ("eintragen", "auswertung"):
                    await p.click(f"#tab-{tab}"); await p.wait_for_timeout(500)
                    await p.screenshot(path=f"{AUS}/{design}_{'nacht' if nacht else 'tag'}_{tab}.png")
            await p.evaluate("document.documentElement.classList.remove('nachtmodus')")
            await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(500)
            await p.locator("#pwa-design").scroll_into_view_if_needed()
            await p.screenshot(path=f"{AUS}/{design}_einstellungen.png")
            await p.keyboard.press("Escape"); await p.wait_for_timeout(300)
        # Umschalter per Klick + bleibt nach Neuladen
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(400)
        await p.click("#pwa-design button[data-design='blau']")
        await p.reload(); await p.wait_for_timeout(1000)
        print("nach Klick+Neuladen:", await p.evaluate("document.documentElement.dataset.design"))
        await p.goto("http://127.0.0.1:8773/hilfe.html"); await p.wait_for_timeout(500)
        await p.screenshot(path=f"{AUS}/hilfe_blau.png", clip={"x":0,"y":0,"width":390,"height":400})
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
