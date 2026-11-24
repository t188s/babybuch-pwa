// Babybuch PWA · Kern · Speicher auf dem Handy (IndexedDB)
//
// Alle Module speichern über diese eine Stelle. Ein Datensatz wird nie wirklich sofort gelöscht,
// sondern bekommt einen Löschmarker (Papierkorb 30 Tage) – nur so kommt ein Löschen auch beim Partner an.

import { abgelaufen, feldZeitenNachAenderung } from "./zusammenfuehren.js";

const DB_NAME = "babybuch";
const DB_VERSION = 1;
let dbVersprechen = null;
const zuhoerer = new Set();

function anfrage(r) {
  return new Promise((ok, fehler) => { r.onsuccess = () => ok(r.result); r.onerror = () => fehler(r.error); });
}

export function oeffnen() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((ok, fehler) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      // Nur ergänzen, nie löschen oder umbenennen (gleiche Regel wie auf dem Pi)
      if (!db.objectStoreNames.contains("datensaetze")) {
        const s = db.createObjectStore("datensaetze", { keyPath: "uid" });
        s.createIndex("kind", "kind");
        s.createIndex("kind_typ", ["kind", "typ"]);
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
    r.onblocked = () => fehler(new Error("Babybuch ist in einem anderen Fenster geöffnet – bitte dort schließen."));
  });
  return dbVersprechen;
}

async function transaktion(stores, modus, arbeit) {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const t = db.transaction(stores, modus);
    let ergebnis;
    Promise.resolve(arbeit(t)).then(e => { ergebnis = e; }, fehler);
    t.oncomplete = () => ok(ergebnis);
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error || new Error("Speichern abgebrochen"));
  });
}

// ── Meta (Gerätekennung, Einstellungen, letztes Backup …) ──
export async function metaLesen(schluessel, standard = null) {
  const wert = await transaktion("meta", "readonly", t => anfrage(t.objectStore("meta").get(schluessel)));
  return wert === undefined ? standard : wert;
}
export function metaSchreiben(schluessel, wert) {
  return transaktion("meta", "readwrite", t => anfrage(t.objectStore("meta").put(wert, schluessel)));
}

// ── Kennungen ──
export function neueUid() {
  const zufall = crypto.getRandomValues(new Uint8Array(10));
  return Date.now().toString(36) + "-" + [...zufall].map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}
let geraetCache = null;
/** Zufällige Kennung dieses Handys (kein Gerätename) – entscheidet bei gleich alten Änderungen. */
export async function geraet() {
  if (geraetCache) return geraetCache;
  geraetCache = await metaLesen("geraet");
  if (!geraetCache) { geraetCache = neueUid(); await metaSchreiben("geraet", geraetCache); }
  return geraetCache;
}

// ── Lesen ──
export function alle() {
  return transaktion("datensaetze", "readonly", t => anfrage(t.objectStore("datensaetze").getAll()));
}
export function holen(uid) {
  return transaktion("datensaetze", "readonly", t => anfrage(t.objectStore("datensaetze").get(uid)));
}
/** Aktive (nicht gelöschte) Datensätze eines Kindes, optional nur ein Typ – sortiert nach daten.zeit bzw. erstellt. */
export async function liste(kind, typ = null) {
  const roh = await transaktion("datensaetze", "readonly", t => {
    const s = t.objectStore("datensaetze");
    return anfrage(typ ? s.index("kind_typ").getAll([kind, typ]) : s.index("kind").getAll(kind));
  });
  return roh.filter(d => !d.geloescht).sort(sortierung);
}
export function sortierung(a, b) {
  const za = a.daten?.zeit || a.daten?.start || a.daten?.datum || "", zb = b.daten?.zeit || b.daten?.start || b.daten?.datum || "";
  return za < zb ? -1 : za > zb ? 1 : a.erstellt - b.erstellt;
}

// ── Schreiben ──
/** Neu anlegen oder ändern. Gibt den gespeicherten Datensatz zurück (mit vorherigem Stand für „Rückgängig“). */
export async function speichern({ uid = null, typ, kind, daten }) {
  const jetzt = Date.now(), ich = await geraet();
  const vorher = uid ? await holen(uid) : null;
  const lebendVorher = vorher && !vorher.geloescht ? vorher : null;
  const d = { uid: uid || neueUid(), typ, kind, daten, erstellt: vorher?.erstellt || jetzt, geaendert: jetzt, geraet: ich, geloescht: null,
              feldZeiten: feldZeitenNachAenderung(lebendVorher, daten, jetzt, ich) };   // je Feld, wann geändert (feldweise mischen)
  if (typ === "kind") d.kind = d.uid;
  await transaktion("datensaetze", "readwrite", t => anfrage(t.objectStore("datensaetze").put(d)));
  melden({ art: vorher ? "geaendert" : "neu", datensatz: d, vorher });
  return { datensatz: d, vorher: vorher || null };
}

/** Löschen = Löschmarker setzen (bleibt 30 Tage im Papierkorb). */
export async function loeschen(uid) {
  const vorher = await holen(uid);
  if (!vorher || vorher.geloescht) return null;
  const jetzt = Date.now();
  const d = { ...vorher, geloescht: jetzt, geaendert: jetzt, geraet: await geraet() };
  await transaktion("datensaetze", "readwrite", t => anfrage(t.objectStore("datensaetze").put(d)));
  melden({ art: "geloescht", datensatz: d, vorher });
  return { datensatz: d, vorher };
}

/** Aus dem Papierkorb zurückholen. */
export async function wiederherstellen(uid) {
  const vorher = await holen(uid);
  if (!vorher || !vorher.geloescht) return null;
  const jetzt = Date.now();
  const d = { ...vorher, geloescht: null, geaendert: jetzt, geraet: await geraet() };
  await transaktion("datensaetze", "readwrite", t => anfrage(t.objectStore("datensaetze").put(d)));
  melden({ art: "wiederhergestellt", datensatz: d, vorher });
  return { datensatz: d, vorher };
}

/** Einen früheren Stand exakt zurückschreiben (für „Rückgängig“ und das Zusammenführen). */
export async function standSchreiben(datensaetze) {
  if (!datensaetze.length) return;
  await transaktion("datensaetze", "readwrite", t => {
    const s = t.objectStore("datensaetze");
    for (const d of datensaetze) s.put(d);
  });
  melden({ art: "mehrere", anzahl: datensaetze.length });
}

/** Papierkorb eines Kindes (neueste zuerst). */
export async function papierkorb(kind) {
  const roh = await transaktion("datensaetze", "readonly", t => anfrage(t.objectStore("datensaetze").index("kind").getAll(kind)));
  return roh.filter(d => d.geloescht && !abgelaufen(d, Date.now())).sort((a, b) => b.geloescht - a.geloescht);
}

/** Löschmarker nach 30 Tagen endgültig entfernen (beim Start). */
export async function aufraeumen() {
  const jetzt = Date.now();
  const weg = (await alle()).filter(d => abgelaufen(d, jetzt));
  if (!weg.length) return 0;
  await transaktion("datensaetze", "readwrite", t => { const s = t.objectStore("datensaetze"); for (const d of weg) s.delete(d.uid); });
  return weg.length;
}

/** Den Browser bitten, die Daten dauerhaft zu behalten (nicht bei Speichermangel löschen). */
export async function dauerhaftAnfordern() {
  try {
    if (!navigator.storage?.persist) return null;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch (_) { return null; }
}

// ── Änderungen melden (Oberfläche zeichnet neu) ──
export function beobachten(f) { zuhoerer.add(f); return () => zuhoerer.delete(f); }
function melden(ereignis) { for (const f of zuhoerer) { try { f(ereignis); } catch (e) { console.error(e); } } }
