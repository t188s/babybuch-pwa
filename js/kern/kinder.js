// Babybuch PWA · Kern · Kinder (mehrere Kinder, Umschalter oben)
// Ein Kind ist selbst ein Datensatz (typ "kind") – so wird es mit geteilt und zusammengeführt wie jeder Eintrag.

import * as speicher from "./speicher.js";

export async function alleKinder() {
  return (await speicher.alle()).filter(d => d.typ === "kind" && !d.geloescht)
    .sort((a, b) => (a.daten.geburtsdatum || "").localeCompare(b.daten.geburtsdatum || "") || a.erstellt - b.erstellt);
}

export async function aktivesKind() {
  const kinder = await alleKinder();
  const gemerkt = await speicher.metaLesen("aktivesKind");
  return kinder.find(k => k.uid === gemerkt) || kinder[0] || null;
}

export function aktivSetzen(uid) { return speicher.metaSchreiben("aktivesKind", uid); }

/** daten: { name, geburtsdatum (JJJJ-MM-TT), geschlecht ("w" | "m" | ""), geburtsgewicht (g) } */
export async function kindSpeichern(daten, uid = null) {
  const sauber = {
    name: String(daten.name || "").trim().replace(/\s+/g, " ").slice(0, 40),
    geburtsdatum: /^\d{4}-\d{2}-\d{2}$/.test(daten.geburtsdatum || "") ? daten.geburtsdatum : "",
    geschlecht: ["w", "m"].includes(daten.geschlecht) ? daten.geschlecht : "",
    geburtsgewicht: Number.isInteger(daten.geburtsgewicht) && daten.geburtsgewicht >= 500 && daten.geburtsgewicht <= 7000 ? daten.geburtsgewicht : null,
  };
  if (!sauber.name) throw new Error("Bitte einen Namen eingeben.");
  const { datensatz } = await speicher.speichern({ uid, typ: "kind", kind: uid, daten: sauber });
  if (!uid) await aktivSetzen(datensatz.uid);
  return datensatz;
}

export function alterText(geburtsdatum, heute = new Date()) {
  if (!geburtsdatum) return "";
  const [j, m, t] = geburtsdatum.split("-").map(Number);
  const tage = Math.round((new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()) - new Date(j, m - 1, t)) / 864e5);
  if (tage < 0) return "";
  if (tage === 0) return "heute geboren";
  if (tage < 56) return `${tage} ${tage === 1 ? "Tag" : "Tage"} alt`;
  if (tage < 365) return `${Math.floor(tage / 7)} Wochen alt`;
  return `${Math.floor(tage / 30.44)} Monate alt`;
}

// ── Kind entfernen (Entscheidung 24.11.: für alle Kinder, mit Rückfrage) ──
// Kind und alle seine Einträge bekommen denselben Löschzeitpunkt → 30 Tage im Papierkorb, gemeinsam zurückholbar.
export async function kindEntfernen(uid) {
  const jetzt = Date.now(), ich = await speicher.geraet();
  const betroffen = (await speicher.alle()).filter(d => d.kind === uid && !d.geloescht);
  await speicher.standSchreiben(betroffen.map(d => ({ ...d, geloescht: jetzt, geaendert: jetzt, geraet: ich })));
  if ((await speicher.metaLesen("aktivesKind")) === uid) {
    const [naechstes] = await alleKinder();
    await speicher.metaSchreiben("aktivesKind", naechstes?.uid || null);
  }
  return betroffen.length;
}

/** Entfernte Kinder, die noch im Papierkorb liegen (neueste zuerst). */
export async function entfernteKinder() {
  const grenze = Date.now() - 30 * 864e5;
  return (await speicher.alle()).filter(d => d.typ === "kind" && d.geloescht && d.geloescht > grenze).sort((a, b) => b.geloescht - a.geloescht);
}

/** Kind mit allen Einträgen zurückholen, die zusammen mit ihm entfernt wurden. */
export async function kindZurueckholen(uid) {
  const kind = await speicher.holen(uid);
  if (!kind?.geloescht) return 0;
  const jetzt = Date.now(), ich = await speicher.geraet();
  const zurueck = (await speicher.alle()).filter(d => d.kind === uid && d.geloescht === kind.geloescht);
  await speicher.standSchreiben(zurueck.map(d => ({ ...d, geloescht: null, geaendert: jetzt, geraet: ich })));
  return zurueck.length;
}
