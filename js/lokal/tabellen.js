// Babybuch PWA · Lokaler Pi · „Tabellen“ wie in der SQLite-Datenbank des Pi – aber je Kind und mit Löschmarkern
//
// Eine Zeile ist ein Datensatz im Kern-Speicher:  typ = Tabellenname, kind = aktives Kind, daten = Spalten inkl. id.
// Die Oberfläche der Pi-Version arbeitet mit ganzzahligen ids (Number(id)) – deshalb bekommt jede Zeile eine große
// Zufallszahl als id (eindeutig auch über beide Handys) und die uid "e<id>". So passen Zusammenführen und Pi-Oberfläche.

import * as speicher from "../kern/speicher.js";
import { nichtGefunden } from "./hilfen.js";

let aktivesKind = null;
export function kindSetzen(uid) { aktivesKind = uid; }
export function kind() {
  if (!aktivesKind) throw new Error("Kein Kind ausgewählt.");
  return aktivesKind;
}

const uidVon = id => "e" + id;
/** Neue id: Zeit + Zufall, sicher unter 2^53 (Number bleibt exakt). */
export function neueId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
/** Feste id aus einem Text (für Zeilen, die jedes Handy selbst anlegt, z. B. U1–U9) – gleich auf beiden Handys. */
export function festeId(text) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const z of text) { const c = z.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return 1e15 + ((h1 * 2097152 + (h2 & 0x1fffff)) % 8e15);
}

const zeile = d => ({ ...d.daten });

/** Alle Zeilen einer Tabelle des aktiven Kindes (ohne gelöschte), in Anlege-Reihenfolge. */
export async function alle(tabelle) {
  const liste = await speicher.liste(kind(), tabelle);
  return liste.sort((a, b) => a.erstellt - b.erstellt || a.daten.id - b.daten.id).map(zeile);
}

/** Sortieren wie „ORDER BY feld, id“ (bei gleichem Feld zählt die Anlege-Reihenfolge, die alle() schon liefert). */
export function sortiert(liste, feld, absteigend = false) {
  const s = [...liste].sort((a, b) => (a[feld] < b[feld] ? -1 : a[feld] > b[feld] ? 1 : 0));
  return absteigend ? s.reverse() : s;
}

export async function holen(tabelle, id) {
  const d = await speicher.holen(uidVon(id));
  return d && !d.geloescht && d.typ === tabelle && d.kind === kind() ? zeile(d) : null;
}

/** INSERT – gibt die neue Zeile zurück. Mit id: genau diese id (z. B. „Rückgängig“ nach dem Entfernen). */
export async function einfuegen(tabelle, werte, id = null) {
  const neuId = id ?? neueId();
  const daten = { ...werte, id: neuId };
  await speicher.speichern({ uid: uidVon(neuId), typ: tabelle, kind: kind(), daten });
  return daten;
}

/** UPDATE … WHERE id = ? – gibt die geänderte Zeile zurück oder null. */
export async function aendern(tabelle, id, aenderungen) {
  const alt = await holen(tabelle, id);
  if (!alt) return null;
  const daten = { ...alt, ...aenderungen, id: alt.id };
  await speicher.speichern({ uid: uidVon(alt.id), typ: tabelle, kind: kind(), daten });
  return daten;
}
export async function aendernOderFehler(tabelle, id, aenderungen) {
  const z = await aendern(tabelle, id, aenderungen);
  if (!z) throw nichtGefunden();
  return z;
}

/** DELETE – setzt einen Löschmarker (Papierkorb 30 Tage, Löschen kommt beim Partner an). */
export async function loeschen(tabelle, id) {
  const alt = await holen(tabelle, id);
  if (!alt) throw nichtGefunden();
  await speicher.loeschen(uidVon(alt.id));
  return { ok: true };
}

/** Gibt es diese id (auch gelöscht)? Für „wiederherstellen mit gleicher id“. */
export async function existiert(tabelle, id) {
  const d = await speicher.holen(uidVon(id));
  return Boolean(d && !d.geloescht && d.typ === tabelle);
}

/** Zeilen, die jedes Handy selbst anlegt (U1–U9, Abhakliste): feste id, uralter Zeitstempel → jede echte Änderung gewinnt. */
export async function grundzeilenAnlegen(tabelle, eintraege) {
  const k = kind(), fehlen = [];
  for (const [i, { schluessel, werte }] of eintraege.entries()) {
    const id = festeId(`${k}:${tabelle}:${schluessel}`);
    if (!(await speicher.holen(uidVon(id))))
      fehlen.push({ uid: uidVon(id), typ: tabelle, kind: k, daten: { ...werte, id }, erstellt: i + 1, geaendert: 1, geraet: "grundstock", geloescht: null });
  }
  if (fehlen.length) await speicher.standSchreiben(fehlen);
}

// ── Einstellungen je Kind (wie Tabelle „einstellungen“: Schlüssel → Wert) ──
// Feste uid je Schlüssel → ändern beide Eltern dieselbe Einstellung, gewinnt die neueste.
const einstellungUid = schluessel => `s-${kind()}-${schluessel}`.slice(0, 64);
export async function einstellungLesen(schluessel) {
  const d = await speicher.holen(einstellungUid(schluessel));
  return d && !d.geloescht ? d.daten.wert : null;
}
export async function einstellungenAlle() {
  const liste = await speicher.liste(kind(), "einstellung");
  return Object.fromEntries(liste.map(d => [d.daten.schluessel, d.daten.wert]));
}
export function einstellungSetzen(schluessel, wert) {
  return speicher.speichern({ uid: einstellungUid(schluessel), typ: "einstellung", kind: kind(), daten: { schluessel, wert: String(wert) } });
}
export async function einstellungLoeschen(schluessel) {
  const d = await speicher.holen(einstellungUid(schluessel));
  if (d && !d.geloescht) await speicher.loeschen(d.uid);
}
