// Babybuch PWA · Lokaler Pi · Einstellungen (wie app.py Teil 4) – je Kind
// Name, Geburtsdatum, Geschlecht und Geburtsgewicht stehen beim Kind selbst (Kind-Datensatz), alles andere als Einstellung.

import * as speicher from "../../kern/speicher.js";
import * as t from "../tabellen.js";
import { ApiFehler, STANDARD_EINSTELLUNGEN, STANDARD_BAUSTEINE, BAUSTEINE_MAX, BAUSTEIN_LAENGE, NAME_MAX, DATUM_MUSTER,
         grammAusText, einfach, hat } from "../hilfen.js";

export const BERICHT_TEILE = ["zusammenfassung", "vergleich", "tage", "mahlzeiten", "notizen", "windeln", "medikamente", "krank", "zeitleiste",
  "verlauf", "gewicht", "groesse", "kopf", "vorsorge", "g_groesse", "g_rhythmus", "g_dauer", "g_trend", "g_gewicht"];   // wie app.py 3.0.2

async function kindDaten() {
  const d = await speicher.holen(t.kind());
  return d?.daten || {};
}

export async function einstellungenLesen() {
  const k = await kindDaten(), roh = await t.einstellungenAlle();
  const w = { ...STANDARD_EINSTELLUNGEN, bausteine: [...STANDARD_BAUSTEINE], geburtsdatum: k.geburtsdatum || "", geschlecht: k.geschlecht || "",
    name: k.name || "", geburtsgewicht: k.geburtsgewicht ?? null, nachtmodus: true, notfall_praxis: "", notfall_gift: "",
    erinnern_geraete: [], bericht_vorlagen: {} };
  for (const [s, wert] of Object.entries(roh)) {
    try {
      if (s in STANDARD_EINSTELLUNGEN) { const n = parseInt(wert, 10); if (Number.isInteger(n)) w[s] = n; }
      else if (s === "notfall_praxis" || s === "notfall_gift") w[s] = wert;
      else if (s === "nachtmodus") w.nachtmodus = wert === "1";
      else if (s === "bausteine") w.bausteine = JSON.parse(wert);
      else if (s === "bericht_vorlagen") {
        const v = JSON.parse(wert);
        w.bericht_vorlagen = Object.fromEntries(["hebamme", "kinderaerztin"].filter(x => Array.isArray(v[x])).map(x => [x, v[x].filter(tl => BERICHT_TEILE.includes(tl))]));
      }
    } catch (_) { /* kaputter Wert → Standard behalten */ }
  }
  return w;
}

export function routen(r) {
  r.get("einstellungen", () => einstellungenLesen());
  r.put("einstellungen", async ({ daten }) => {
    for (const s of Object.keys(STANDARD_EINSTELLUNGEN)) {
      if (!hat(daten, s)) continue;
      const stunde = Number(daten[s]);
      if (!Number.isInteger(stunde) || stunde < 0 || stunde > 23) throw new ApiFehler("Bitte eine volle Stunde (0–23) wählen.");
      await t.einstellungSetzen(s, String(stunde));
    }
    // Baby: am Kind-Datensatz
    const kindAlt = await speicher.holen(t.kind());
    const kd = { ...(kindAlt?.daten || {}) };
    let kindGeaendert = false;
    if (hat(daten, "geburtsdatum")) {
      const wert = String(daten.geburtsdatum || "");
      if (wert && !DATUM_MUSTER.test(wert)) throw new ApiFehler("Geburtsdatum bitte als Datum angeben.");
      kd.geburtsdatum = wert; kindGeaendert = true;
    }
    if (hat(daten, "geschlecht")) {
      const wert = String(daten.geschlecht || "");
      if (!["", "m", "w"].includes(wert)) throw new ApiFehler("Geschlecht bitte als Junge oder Mädchen wählen.");
      kd.geschlecht = wert; kindGeaendert = true;
    }
    if (hat(daten, "name")) {
      const name = einfach(daten.name, NAME_MAX);
      if (!name) throw new ApiFehler("Bitte einen Namen eingeben – er unterscheidet die Kinder im Babybuch.");
      kd.name = name; kindGeaendert = true;
    }
    if (hat(daten, "geburtsgewicht")) {
      const roh = daten.geburtsgewicht;
      if (roh == null || roh === "") kd.geburtsgewicht = null;
      else {
        const g = grammAusText(roh);
        if (g == null || g > 7000) throw new ApiFehler("Geburtsgewicht bitte in Gramm (z. B. 3350) oder kg (3,35) angeben.");
        kd.geburtsgewicht = g;
      }
      kindGeaendert = true;
    }
    if (kindGeaendert) await speicher.speichern({ uid: t.kind(), typ: "kind", kind: t.kind(), daten: kd });
    if (hat(daten, "nachtmodus")) await t.einstellungSetzen("nachtmodus", daten.nachtmodus ? "1" : "0");
    for (const s of ["notfall_praxis", "notfall_gift"])
      if (hat(daten, s)) await t.einstellungSetzen(s, String(daten[s] || "").replace(/[^\d+ /()-]/g, "").slice(0, 30).trim());
    if (hat(daten, "bericht_vorlagen")) {
      const v = daten.bericht_vorlagen;
      if (!v || typeof v !== "object" || Array.isArray(v) || Object.entries(v).some(([k, l]) =>
        !["hebamme", "kinderaerztin"].includes(k) || !Array.isArray(l) || l.some(tl => !BERICHT_TEILE.includes(tl))))
        throw new ApiFehler("Ungültige Bericht-Auswahl.");
      const alt = (await einstellungenLesen()).bericht_vorlagen;
      await t.einstellungSetzen("bericht_vorlagen", JSON.stringify({ ...alt, ...v }));
    }
    // erinnern_geraete: gibt es in der Web-App nicht (Erinnerung über Home Assistant) – wird ignoriert
    if (hat(daten, "bausteine")) {
      const liste = daten.bausteine;
      if (!Array.isArray(liste) || liste.length > BAUSTEINE_MAX) throw new ApiFehler(`Höchstens ${BAUSTEINE_MAX} Bausteine.`);
      const sauber = [];
      for (const text of liste) {
        const x = einfach(String(text).replaceAll(",", " "), BAUSTEIN_LAENGE);   // Komma trennt Bausteine in der Notiz
        if (x && !sauber.includes(x)) sauber.push(x);
      }
      await t.einstellungSetzen("bausteine", JSON.stringify(sauber));
    }
    return einstellungenLesen();
  });
}
