#!/usr/bin/env python3
"""Erzeugt js/lokal/pi/who.js aus den WHO-Tabellen in app.py der Pi-Version (gleiche Zahlen, nie von Hand pflegen).

Aufruf:  python3 werkzeuge/who_uebernehmen.py <still_tracker.zip>
"""
import ast, json, pathlib, re, sys, zipfile

with zipfile.ZipFile(sys.argv[1]) as z:
    name = next(n for n in z.namelist() if n.endswith("still_tracker/app.py"))
    quelle = z.read(name).decode("utf-8")
tabellen = {}
for var in ("WHO_LMS", "WHO_LAENGE"):
    m = re.search(rf"^{var} = (\{{.*?^\}})", quelle, re.S | re.M)
    tabellen[var] = {k: [list(z) for z in v] for k, v in ast.literal_eval(m.group(1)).items()}
ziel = pathlib.Path(__file__).resolve().parent.parent / "js/lokal/pi/who.js"
ziel.write_text("// Erzeugt von werkzeuge/who_uebernehmen.py aus app.py der Pi-Version – nicht von Hand ändern.\n"
                "// WHO Child Growth Standards: [Alter in Tagen, L, M, S] – Gewicht (M in kg) und Länge (M in cm).\n"
                + "".join(f"export const {k} = {json.dumps(v, separators=(',', ':'))};\n" for k, v in tabellen.items()), encoding="utf-8")
print("who.js erzeugt:", {k: {g: len(v) for g, v in t.items()} for k, t in tabellen.items()})
