import asyncio, sys, http.server, threading, functools, os, datetime
from playwright.async_api import async_playwright
WEB, AUS = sys.argv[1], sys.argv[2]; os.makedirs(AUS, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8772), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
async def api(p, m, pfad, d=None):
    return await p.evaluate("""async ([m, p, d]) => (await fetch('api/' + p, { method: m, headers: d ? {'Content-Type':'application/json'} : {}, body: d ? JSON.stringify(d) : undefined })).json()""", [m, pfad, d])
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 402, "height": 778}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="de-DE")
        p = await ctx.new_page(); fehler = []
        p.on("pageerror", lambda e: fehler.append(str(e)))
        await p.goto("http://127.0.0.1:8772/"); await p.wait_for_timeout(1000)
        await p.locator("dialog[open]").get_by_role("button", name="Beispielkind ansehen").click()
        await p.wait_for_function("!document.querySelector('dialog[open]')", timeout=30000)
        await p.evaluate("(async () => { const k = await import('./js/kern/kinder.js'); const a = await k.aktivesKind(); await k.kindSpeichern({ name: 'Maximilian' }); await k.aktivSetzen(a.uid); })()")
        jetzt = datetime.datetime.now() - datetime.timedelta(minutes=3)
        await api(p, "POST", "taegliche-gaben", {"name": "Eisen", "zeiten": ["00:01"], "ab": datetime.date.today().isoformat()})
        await api(p, "PUT", "stoppuhr", {"stoppuhr": {"abschnitte": [{"seite": "L", "start": jetzt.strftime("%Y-%m-%dT%H:%M:%S"), "ende": None}]}})
        await p.reload(); await p.wait_for_timeout(1500)
        for w in (360,):
            await p.set_viewport_size({"width": w, "height": 780})
            for tab in ("eintragen", "auswertung"):
                await p.click(f"#tab-{tab}"); await p.wait_for_timeout(500)
                m = await p.evaluate("""() => { const k = document.querySelector('.kopf-innen'), knopf = document.getElementById('pwa-kind'), t = document.getElementById('kopf-titel');
                    const r = knopf.getBoundingClientRect(), tr = t.getBoundingClientRect();
                    return { ueberlauf: k.scrollWidth > k.clientWidth + 1, knopfSichtbar: r.width > 30 && r.right <= innerWidth, titelAbgeschnitten: t.scrollWidth > t.clientWidth + 1,
                             text: knopf.innerText.replace(/\\n/g, ' '), knopfBreite: Math.round(r.width) }; }""")
                print(w, tab, m, flush=True)
                await p.screenshot(path=f"{AUS}/kopf_{w}_{tab}.png", clip={"x": 0, "y": 0, "width": w, "height": 70})
        await p.click("#pwa-kind"); await p.wait_for_timeout(400)
        await p.screenshot(path=f"{AUS}/liste.png")
        await p.locator("dialog[open] .menue-knoepfe button").filter(has_text="Maximilian").click(); await p.wait_for_timeout(1800)
        print("nach Wechsel:", await p.inner_text("#pwa-kind"), flush=True)
        print("Fehler:", fehler or "keine")
        await b.close()
asyncio.run(main())
