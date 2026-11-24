// Babybuch PWA · Kern · Aufbau und Prüfung der Backup-Datei (reine Logik, testbar)
//
// Eine Datei = ein oder mehrere Kinder mit allen Datensätzen inkl. Löschmarkern (damit Löschen beim Partner ankommt).
// Format: JSON, Dateiendung .babybuch (öffnet in jedem Texteditor, falls man nachschauen will).

export const FORMAT = "babybuch-pwa";
export const FORMAT_VERSION = 1;
const ERLAUBTE_FELDER = ["uid", "typ", "kind", "daten", "erstellt", "geaendert", "geraet", "geloescht", "feldZeiten"];
const UID_MUSTER = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * @param {object[]} datensaetze  alle Datensätze des Geräts (inkl. Löschmarker)
 * @param {string[]} kinderUids   ausgewählte Kinder (Häkchen beim Teilen)
 * @param {{ geraet: string, appVersion: string, jetzt: number }} meta
 */
export function backupErstellen(datensaetze, kinderUids, meta) {
  const auswahl = new Set(kinderUids);
  const enthalten = datensaetze.filter(d => auswahl.has(d.kind));
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    app: meta.appVersion,
    erstellt: meta.jetzt,
    geraet: meta.geraet,
    kinder: [...auswahl],
    datensaetze: enthalten.map(d => Object.fromEntries(ERLAUBTE_FELDER.filter(f => f in d).map(f => [f, d[f]]))),
  };
}

export function dateiname(jetzt, kinderNamen = []) {
  const d = new Date(jetzt), z = n => String(n).padStart(2, "0");
  const name = kinderNamen.length === 1 ? "_" + kinderNamen[0].replace(/[^\p{L}\p{N}-]+/gu, "") : "";
  return `babybuch${name}_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.babybuch`;
}

/**
 * Liest den Text einer Datei und prüft ihn gründlich, bevor irgendetwas übernommen wird.
 * @returns {{ ok: true, datei: object, datensaetze: object[], verworfen: number } | { ok: false, fehler: string }}
 */
export function backupPruefen(text) {
  let datei;
  try { datei = JSON.parse(String(text).replace(/^﻿/, "")); }
  catch (_) { return { ok: false, fehler: "Das ist keine Babybuch-Datei (Inhalt nicht lesbar)." }; }
  if (!datei || datei.format !== FORMAT) return { ok: false, fehler: "Das ist keine Babybuch-Datei." };
  if (typeof datei.version !== "number" || datei.version > FORMAT_VERSION)
    return { ok: false, fehler: "Diese Datei stammt aus einer neueren Babybuch-Version – bitte die App aktualisieren (Seite neu laden)." };
  if (!Array.isArray(datei.datensaetze)) return { ok: false, fehler: "Die Datei ist unvollständig." };
  const datensaetze = [];
  let verworfen = 0;
  for (const d of datei.datensaetze) {
    if (datensatzGueltig(d)) datensaetze.push(d); else verworfen++;
  }
  return { ok: true, datei, datensaetze, verworfen };
}

export function datensatzGueltig(d) {
  return Boolean(d) && typeof d === "object" &&
    typeof d.uid === "string" && UID_MUSTER.test(d.uid) &&
    typeof d.typ === "string" && /^[a-z_]{2,30}$/.test(d.typ) &&
    typeof d.kind === "string" && UID_MUSTER.test(d.kind) &&
    Number.isFinite(d.geaendert) && d.geaendert > 0 &&
    (d.geloescht == null || Number.isFinite(d.geloescht)) &&
    d.daten !== null && typeof d.daten === "object" && !Array.isArray(d.daten) &&
    (d.feldZeiten == null || (typeof d.feldZeiten === "object" && Object.values(d.feldZeiten).every(z =>
      Array.isArray(z) && z.length === 2 && Number.isFinite(z[0]) && typeof z[1] === "string")));
}
