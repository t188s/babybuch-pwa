import asyncio, sys, http.server, threading, functools, os
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8781), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB))
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        p = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="de-DE")).new_page()
        fehler = []; p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto("http://127.0.0.1:8781/"); await p.wait_for_timeout(1000)
        await p.locator("dialog[open]").last.get_by_role("button", name="Demo ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=60000)
        await p.reload(); await p.wait_for_timeout(1200)
        # Export von Lea holen, dann ein neues leeres Kind anlegen und dort einlesen
        texte = {a: (await p.evaluate(f"fetch('api/export/{a}.csv').then(r => r.json())"))["text"] for a in ("stillen", "windeln", "gewicht", "groesse")}
        for a, t in texte.items(): open(f"{AUS}/{a}.csv", "w", encoding="utf-8", newline="").write(t)
        await p.evaluate("(async () => { const k = await import('./js/kern/kinder.js'); const n = await k.kindSpeichern({ name: 'Leer', geburtsdatum: '2026-07-26', geschlecht: 'w' }); await k.aktivSetzen(n.uid); })()")
        await p.reload(); await p.wait_for_timeout(1200)
        await p.evaluate("einstellungenOeffnen()"); await p.wait_for_timeout(300)
        await p.click("#import-oeffnen"); await p.wait_for_timeout(300)
        for a in ("stillen", "windeln", "gewicht", "groesse"):
            await p.click(f"#im-art [data-art='{a}']"); await p.wait_for_timeout(200)
            await p.set_input_files("#im-datei", f"{AUS}/{a}.csv"); await p.wait_for_timeout(1200)
            vorschau = (await p.inner_text("#im-ergebnis")).replace("\n", " | ")[:160]
            if a == "stillen": await p.screenshot(path=f"{AUS}/vorschau.png")
            await p.click("#im-einspielen"); await p.wait_for_timeout(300)
            await p.locator("#frage-ja").click(); await p.wait_for_timeout(4000 if a == "stillen" else 1200)
            print(a, "· Vorschau:", vorschau, "\n    → ", (await p.inner_text("#im-ergebnis")).replace("\n", " | ")[:120])
        # Rundreise: Export des neuen Kindes = Export von Lea?
        for a in ("stillen", "windeln", "gewicht", "groesse"):
            neu = (await p.evaluate(f"fetch('api/export/{a}.csv').then(r => r.json())"))["text"]
            print("Rundreise", a, "gleich:", neu == texte[a], "" if neu == texte[a] else (len(neu), len(texte[a])))
            if neu != texte[a]:
                x, y = texte[a].split("\r\n"), neu.split("\r\n")
                print("   nur im Original:", [l for l in x if l not in y][:3], "· nur neu:", [l for l in y if l not in x][:3])
        print("Fehler:", fehler or "keine"); await b.close()
asyncio.run(main())
