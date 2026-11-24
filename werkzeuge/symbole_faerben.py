#!/usr/bin/env python3
"""Färbt die App-Symbole (Home-Bildschirm) um: liest die goldenen Vorlagen aus icons/gold/ und schreibt icons/*.png.

Aufruf:  python3 werkzeuge/symbole_faerben.py            → Dusty Blue (Standard-Design der Web-App)
         python3 werkzeuge/symbole_faerben.py gold       → wieder Gold wie die Pi-Version

Das Symbol ist Gold auf Schwarz mit weichen Kanten. Jeder Pixel ist (Helligkeit × Gold); er wird zu (Helligkeit × Zielfarbe).
"""
import pathlib, sys
from PIL import Image

GOLD = (207, 174, 108)
FARBEN = {"blau": (143, 164, 200), "gold": GOLD}
basis = pathlib.Path(__file__).resolve().parent.parent / "icons"
ziel = FARBEN[sys.argv[1] if len(sys.argv) > 1 else "blau"]
summe = sum(GOLD)
for vorlage in sorted((basis / "gold").glob("*.png")):
    bild = Image.open(vorlage).convert("RGBA")
    px = bild.load()
    for y in range(bild.height):
        for x in range(bild.width):
            r, g, b, a = px[x, y]
            t = (r + g + b) / summe
            px[x, y] = tuple(min(255, round(t * c)) for c in ziel) + (a,)
    bild.save(basis / vorlage.name, optimize=True)
    print("gefärbt:", vorlage.name)
