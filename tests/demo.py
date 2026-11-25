import asyncio, sys, http.server, threading, functools, os, time
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8779), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        p = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")).new_page()
        fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
        p.on("console", lambda m: fehler.append(m.text) if m.type == "error" else None)
        await p.goto("http://127.0.0.1:8779/"); await p.wait_for_timeout(1000)
        await p.screenshot(path=f"{AUS}/0_willkommen.png")
        t0 = time.time()
        await p.locator("dialog[open]").last.get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=60000)
        print(f"Demo angelegt in {time.time() - t0:.1f} s")
        await p.reload(); await p.wait_for_timeout(1500)
        info = await p.evaluate("""(async () => { const s = await import('./js/kern/speicher.js'); const k = await import('./js/kern/kinder.js');
          const alle = await s.alle(); const kinder = await k.alleKinder(); const a = await k.aktivesKind();
          return { kinder: kinder.map(x => x.daten.name + ' ' + x.daten.geburtsdatum), aktiv: a.daten.name,
                   jeTyp: Object.fromEntries(kinder.map(x => [x.daten.name, alle.filter(d => d.kind === x.uid).reduce((m, d) => (m[d.typ] = (m[d.typ] || 0) + 1, m), {})])) }; })()""")
        print("Kinder:", info["kinder"], "· aktiv:", info["aktiv"])
        for n, t in info["jeTyp"].items(): print(" ", n, t)
        print("Kopf:", await p.inner_text("#pwa-kind"), "· Wahl:", await p.evaluate("[...document.querySelectorAll('#pwa-ern-wahl button')].map(b => b.innerText)"))
        await p.screenshot(path=f"{AUS}/1_lea.png")
        await p.click("#tab-auswertung"); await p.wait_for_timeout(500)
        await p.evaluate("(() => { const r = document.getElementById('aw-regler'); r.value = 7; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); })()")
        await p.wait_for_timeout(1500); await p.screenshot(path=f"{AUS}/2_lea_6m.png")
        print("Auswertung:", await p.inner_text("#zeitraum-titel"), await p.evaluate("[...document.querySelectorAll('#kacheln .kachel b')].map(b => b.innerText)"))
        await p.click("#tab-gewicht"); await p.wait_for_timeout(1200); await p.screenshot(path=f"{AUS}/3_lea_wachstum.png")
        # zu Ben wechseln
        await p.click("#pwa-kind"); await p.wait_for_timeout(300)
        await p.locator("dialog[open] .menue-knoepfe button").filter(has_text="Ben").click(); await p.wait_for_timeout(2000)
        print("Ben – Kopf:", await p.inner_text("#pwa-kind"), "· Reiter:", await p.inner_text('.alltag-wahl button[data-a="eintragen"]'),
              "· Modus:", await p.evaluate("document.getElementById('bereich-eintragen').dataset.pwaModus"))
        await p.click("#tab-eintragen"); await p.wait_for_timeout(600); await p.screenshot(path=f"{AUS}/4_ben.png")
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(500)
        print("Einstellungen-Knopf:", await p.inner_text("#pwa-demo"))
        await p.locator("#pwa-demo").scroll_into_view_if_needed(); await p.screenshot(path=f"{AUS}/5_einstellungen.png")
        await p.click("#pwa-demo"); await p.wait_for_timeout(300)
        async with p.expect_navigation():
            await p.locator("dialog[open]").last.get_by_role("button", name="Entfernen").click()
        await p.wait_for_timeout(1500)
        print("nach Entfernen – Fenster:", await p.evaluate("[...document.querySelectorAll('dialog[open] h3')].map(h => h.innerText)"))
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
