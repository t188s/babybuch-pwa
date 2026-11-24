// Babybuch PWA · Lokaler Pi · U-Heft, Zahnarzt, Impfungen, Arztbesuche, Maßnahmen, Kopfumfang (wie app.py Teil 4c)
// Das gelbe Heft bleibt das gültige Dokument – das Babybuch begleitet es.
// Anders als auf dem Pi: keine eingebauten Startdaten (die gehörten zu einer Familie) – jede Familie trägt ihr Heft selbst ein.

import * as t from "../tabellen.js";
import { ApiFehler, DATUM_MUSTER, ZEIT_MUSTER, TEXT_MAX, einfach, grammAusText, cmAusText, pyRound, heute, istGanzzahl, hat, nichtGefunden } from "../hilfen.js";

export const U_ARTEN = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U7a", "U8", "U9", "Z1", "Z2", "Z3", "Z4", "Z5", "Z6"];
const SCREENINGS = ["Pulsoxymetrie-Screening", "Erweitertes Neugeborenen-Screening", "Mukoviszidose-Screening",
  "Neugeborenen-Hörscreening", "Hüft-Ultraschall", "Vitamin K (U1)", "Vitamin K (U2)", "Vitamin K (U3)"];

const U_LEER = { vom: "", bis: "", termin: "", praxis: "", am: "", erledigt: 0, ergebnis: "", impfstatus: "", g: null, cm: null, kopf: null, bemerkung: "" };

/** Legt U1–U9/Z1–Z6 und die Abhakliste je Kind einmal an (feste ids → gleich auf beiden Handys). */
export async function heftEinrichten() {
  await t.grundzeilenAnlegen("untersuchungen", U_ARTEN.map(art => ({ schluessel: art, werte: { art, ...U_LEER } })));
  await t.grundzeilenAnlegen("screenings", SCREENINGS.map((name, i) => ({ schluessel: name, werte: { name, am: "", erledigt: 0, notiz: "", reihenfolge: i } })));
}

function feldPruefen(art, wert, laenge = TEXT_MAX) {
  if (art === "text") return einfach(wert, laenge);
  if (art === "datum") { wert = String(wert || ""); if (wert && !DATUM_MUSTER.test(wert)) throw new ApiFehler("Datum ungültig."); return wert; }
  if (art === "zeitpunkt") { wert = String(wert || ""); if (wert && !ZEIT_MUSTER.test(wert)) throw new ApiFehler("Termin ungültig (Datum und Uhrzeit)."); return wert; }
  if (art === "bool") return wert ? 1 : 0;
  if (art === "gramm") { if (wert == null || wert === "") return null; const g = grammAusText(wert); if (!g) throw new ApiFehler("Gewicht bitte in g oder kg."); return g; }
  if (art === "cm") { if (wert == null || wert === "") return null; const c = cmAusText(wert); if (!c) throw new ApiFehler("Länge bitte in cm."); return c; }
  if (art === "kopf") {
    if (wert == null || wert === "") return null;
    const roh = Number(String(wert).replace(",", ".").replace("cm", "").trim());
    const c = Number.isFinite(roh) ? pyRound(roh, 1) : 0;
    if (c < 25 || c > 60) throw new ApiFehler("Kopfumfang bitte in cm (25–60).");
    return c;
  }
  if (art === "liste") {
    if (!Array.isArray(wert) || !wert.every(x => typeof x === "string") || wert.length > 20) throw new ApiFehler("Liste ungültig.");
    return JSON.stringify(wert.filter(x => x.trim()).map(x => einfach(x, 40)));
  }
  if (art.startsWith("wahl:")) { if (!art.slice(5).split("|").includes(wert)) throw new ApiFehler("Ungültige Auswahl."); return wert; }
  if (art === "id") { if (!(wert == null || istGanzzahl(wert))) throw new ApiFehler("Ungültige Nummer."); return wert ?? null; }
  throw new ApiFehler("Unbekanntes Feld.");
}

// Tabelle → [{Feld: Art}, Pflichtfelder, darf neu angelegt/gelöscht werden?]
const HEFT = {
  untersuchungen: [{ vom: "datum", bis: "datum", termin: "zeitpunkt", praxis: "text", am: "datum", erledigt: "bool",
                     ergebnis: "wahl:|ok|beob|mass", impfstatus: "wahl:|ja|nein", g: "gramm", cm: "cm", kopf: "kopf", bemerkung: "text" }, [], false],
  screenings: [{ am: "datum", erledigt: "bool", notiz: "text" }, [], false],
  impfungen: [{ am: "datum", gegen: "liste", stoff: "text", charge: "text", praxis: "text", notiz: "text" }, ["am"], true],
  impfplan: [{ gegen: "liste", dosis: "text", alter_text: "text", ab: "datum", nachholen: "text", termin: "zeitpunkt", impfung_id: "id", notiz: "text" }, ["gegen"], true],
  arztbesuche: [{ am: "datum", termin: "zeitpunkt", grund: "text", praxis: "text", ergebnis: "text", g: "gramm", cm: "cm", kopf: "kopf" }, ["grund"], true],
  massnahmen: [{ text: "text", von: "text", faellig: "datum", erledigt: "datum" }, ["text"], true],
  kopfumfang: [{ datum: "datum", cm: "kopf" }, ["datum", "cm"], true],
};
// Standardwerte der Spalten (wie DEFAULT in SQLite), damit neue Zeilen vollständig sind
const LEER = {
  impfungen: { am: "", gegen: "[]", stoff: "", charge: "", praxis: "", notiz: "" },
  impfplan: { gegen: "[]", dosis: "", alter_text: "", ab: "", nachholen: "", termin: "", impfung_id: null, notiz: "" },
  arztbesuche: { am: "", termin: "", grund: "", praxis: "", ergebnis: "", g: null, cm: null, kopf: null },
  massnahmen: { text: "", von: "", faellig: "", erledigt: "" },
  kopfumfang: {},
};
const PFLICHT_TEXTE = { am: "Bitte ein Datum angeben.", grund: "Bitte den Grund eintragen.", text: "Bitte eintragen, was vereinbart wurde.",
  gegen: "Bitte antippen, wogegen.", datum: "Bitte ein Datum angeben.", cm: "Bitte den Kopfumfang angeben." };

function heftWerte(tabelle, daten, allesNoetig) {
  const [felder, pflicht] = HEFT[tabelle];
  const w = {};
  for (const [feld, art] of Object.entries(felder))
    if (hat(daten, feld) || (allesNoetig && pflicht.includes(feld))) w[feld] = feldPruefen(art, daten[feld]);
  for (const feld of pflicht)
    if (hat(w, feld) && (w[feld] === "" || w[feld] == null || w[feld] === "[]")) throw new ApiFehler(PFLICHT_TEXTE[feld] || "Angabe fehlt.");
  if ((tabelle !== "impfplan" && w.am && w.am > heute()) || (tabelle === "kopfumfang" && (w.datum || "") > heute()))
    throw new ApiFehler("„Gemacht am“ liegt in der Zukunft – dafür bitte „Termin“ nehmen.");
  return w;
}

function heftZeile(z) {
  if (!z || !hat(z, "gegen")) return z;
  let gegen; try { gegen = JSON.parse(z.gegen); } catch (_) { gegen = []; }
  return { ...z, gegen };
}

export function routen(r) {
  r.get("heft", async () => {
    await heftEinrichten();
    const antwort = {};
    for (const tabelle of Object.keys(HEFT)) antwort[tabelle] = (await t.alle(tabelle)).map(heftZeile);
    antwort.untersuchungen.sort((a, b) => U_ARTEN.indexOf(a.art) - U_ARTEN.indexOf(b.art));
    antwort.screenings.sort((a, b) => a.reihenfolge - b.reihenfolge);
    return antwort;
  });
  r.post("heft/:tabelle", async ({ params, daten }) => {
    const tabelle = params.tabelle;
    if (!HEFT[tabelle] || !HEFT[tabelle][2]) throw new ApiFehler("Hier kann nichts neu angelegt werden.", 404);
    const w = heftWerte(tabelle, daten, true);
    if (tabelle === "arztbesuche") {
      if (!w.am && !w.termin) throw new ApiFehler("Bitte einen Termin oder „gemacht am“ angeben.");
      w.am ??= "";
    }
    return [201, heftZeile(await t.einfuegen(tabelle, { ...LEER[tabelle], ...w }))];
  });
  r.patch("heft/:tabelle/:id", async ({ params, id, daten }) => {
    const tabelle = params.tabelle;
    if (!HEFT[tabelle]) throw new ApiFehler("Unbekannt.", 404);
    const w = heftWerte(tabelle, daten, false);
    if (!Object.keys(w).length) throw new ApiFehler("Nichts zu ändern.");
    return heftZeile(await t.aendernOderFehler(tabelle, id, w));
  });
  r.delete("heft/:tabelle/:id", async ({ params, id }) => {
    const tabelle = params.tabelle;
    if (!HEFT[tabelle]) throw new ApiFehler("Unbekannt.", 404);
    if (!HEFT[tabelle][2]) {                 // U/Z und Abhakliste: nicht löschen, sondern zurücksetzen
      const leer = Object.fromEntries(Object.entries(HEFT[tabelle][0]).map(([f, a]) => [f, a === "bool" ? 0 : ["gramm", "cm", "kopf"].includes(a) ? null : ""]));
      if (!(await t.aendern(tabelle, id, leer))) throw nichtGefunden();
      return { ok: true };
    }
    if (tabelle === "impfungen")
      for (const p of (await t.alle("impfplan")).filter(p => p.impfung_id === id)) await t.aendern("impfplan", p.id, { impfung_id: null });
    return t.loeschen(tabelle, id);
  });
}
